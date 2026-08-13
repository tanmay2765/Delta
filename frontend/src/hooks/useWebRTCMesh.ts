import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchIceServers,
  hasTurnConfigured,
  isProductionDeploy,
  type IceServerResponse,
} from "@/lib/ice-servers";
import {
  attachPcDiagnostics,
  collectPeerDiagnostics,
  type PeerDiagnostic,
  webrtcError,
  webrtcLog,
} from "@/lib/webrtc-diagnostics";

const OFFER_OPTIONS: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

const MIN_OFFER_GAP_MS = 12_000;
const MIN_FORCE_OFFER_GAP_MS = 4_000;

export type SignalingMessage = {
  type: string;
  from?: number;
  to?: number;
  meetingId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type RemoteParticipant = { id: string };

type PeerState = {
  makingOffer: boolean;
  ignoreOffer: boolean;
  seenCandidates: Set<string>;
  detachDiagnostics?: () => void;
  politeFallbackScheduled?: boolean;
};

function cloneStreamMap(streams: Map<string, MediaStream>) {
  return new Map(streams);
}

function candidateKey(candidate: RTCIceCandidateInit) {
  return `${candidate.sdpMid ?? ""}:${candidate.sdpMLineIndex ?? ""}:${candidate.candidate ?? ""}`;
}

function isConnected(pc: RTCPeerConnection | undefined) {
  return (
    pc?.connectionState === "connected" ||
    pc?.connectionState === "connecting" ||
    pc?.iceConnectionState === "connected" ||
    pc?.iceConnectionState === "completed"
  );
}

function sanitizeIceServers(servers: RTCIceServer[]) {
  return servers.map((server) => ({
    urls: server.urls,
    hasCredentials: Boolean(server.username && server.credential),
  }));
}

async function limitOutgoingBitrate(pc: RTCPeerConnection, maxKbps = 600) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) {
        params.encodings = [{}];
      }
      params.encodings[0] = {
        ...params.encodings[0],
        maxBitrate: maxKbps * 1000,
      };
      await sender.setParameters(params);
    } catch {
      // Browser may reject before negotiation completes.
    }
  }
}

export function useWebRTCMesh(
  meetingId: string,
  selfParticipantId: number | undefined,
  localStream: MediaStream | null,
  remoteParticipants: RemoteParticipant[],
  sendSignaling: (message: SignalingMessage) => void,
  signalingReady: boolean,
) {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerStateRef = useRef<Map<string, PeerState>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const knownRemoteIdsRef = useRef<string>("");
  const localTracksRef = useRef<string>("");
  const lastOfferAtRef = useRef<Map<string, number>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const relayOnlyRef = useRef<Map<string, boolean>>(new Map());
  const [iceReady, setIceReady] = useState(false);
  const [turnAvailable, setTurnAvailable] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [iceConfig, setIceConfig] = useState<IceServerResponse | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(() => new Map());
  const [peerDiagnostics, setPeerDiagnostics] = useState<Map<string, PeerDiagnostic>>(() => new Map());

  const canUseWebRTC =
    iceReady && (!isProductionDeploy() || turnAvailable || hasTurnConfigured(iceServersRef.current));

  const refreshDiagnostics = useCallback(async () => {
    if (!selfParticipantId) return;
    const next = new Map<string, PeerDiagnostic>();
    for (const [remoteId, pc] of peersRef.current.entries()) {
      next.set(
        remoteId,
        await collectPeerDiagnostics(
          remoteId,
          pc,
          remoteStreamsRef.current.get(remoteId),
          relayOnlyRef.current.get(remoteId) ?? false,
        ),
      );
    }
    setPeerDiagnostics(next);
  }, [selfParticipantId]);

  useEffect(() => {
    let cancelled = false;
    void fetchIceServers().then((config) => {
      if (cancelled) return;
      iceServersRef.current = config.ice_servers;
      setIceConfig(config);
      setTurnAvailable(config.turn_configured);
      setTurnError(config.turn_error ?? null);
      setIceReady(true);
      webrtcLog("*", "ice-servers-ready", {
        turn: config.turn_configured,
        sources: config.sources,
        servers: sanitizeIceServers(config.ice_servers),
        error: config.turn_error,
      });
      if (isProductionDeploy() && !config.turn_configured) {
        console.error(
          "[WebRTC] TURN not configured on backend — cross-network calls WILL fail. " +
            (config.turn_error ?? "Set Metered or TURN env vars on Render backend."),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const publishStreams = useCallback(() => {
    setRemoteStreams(cloneStreamMap(remoteStreamsRef.current));
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const getPeerState = useCallback((remoteId: string): PeerState => {
    let state = peerStateRef.current.get(remoteId);
    if (!state) {
      state = { makingOffer: false, ignoreOffer: false, seenCandidates: new Set() };
      peerStateRef.current.set(remoteId, state);
    }
    return state;
  }, []);

  const shouldThrottleOffer = useCallback((remoteId: string, force: boolean) => {
    const last = lastOfferAtRef.current.get(remoteId) ?? 0;
    const gap = force ? MIN_FORCE_OFFER_GAP_MS : MIN_OFFER_GAP_MS;
    return Date.now() - last < gap;
  }, []);

  const markOfferSent = useCallback((remoteId: string) => {
    lastOfferAtRef.current.set(remoteId, Date.now());
  }, []);

  const addRemoteTrack = useCallback(
    (remoteId: string, track: MediaStreamTrack) => {
      webrtcLog(remoteId, "ontrack", { kind: track.kind, id: track.id, enabled: track.enabled });
      let stream = remoteStreamsRef.current.get(remoteId);
      if (!stream) {
        stream = new MediaStream();
        remoteStreamsRef.current.set(remoteId, stream);
      }
      if (!stream.getTracks().some((existing) => existing.id === track.id)) {
        stream.addTrack(track);
      }
      publishStreams();
    },
    [publishStreams],
  );

  const removeRemote = useCallback(
    (remoteId: string) => {
      const state = peerStateRef.current.get(remoteId);
      state?.detachDiagnostics?.();
      peersRef.current.get(remoteId)?.close();
      peersRef.current.delete(remoteId);
      peerStateRef.current.delete(remoteId);
      pendingIceRef.current.delete(remoteId);
      relayOnlyRef.current.delete(remoteId);
      lastOfferAtRef.current.delete(remoteId);
      remoteStreamsRef.current.delete(remoteId);
      publishStreams();
      webrtcLog(remoteId, "peer-removed");
    },
    [publishStreams],
  );

  const attachLocalTracks = useCallback(
    (pc: RTCPeerConnection) => {
      if (!localStream?.active) return false;

      let attached = false;
      for (const track of localStream.getTracks()) {
        const sender = pc.getSenders().find((existing) => existing.track?.kind === track.kind);
        if (sender) {
          void sender.replaceTrack(track);
          attached = true;
        } else {
          pc.addTrack(track, localStream);
          attached = true;
        }
      }
      return attached;
    },
    [localStream],
  );

  const ensureRecvOnly = useCallback((pc: RTCPeerConnection) => {
    for (const kind of ["audio", "video"] as const) {
      const sending = pc.getSenders().some((sender) => sender.track?.kind === kind);
      if (sending) continue;
      const receiving = pc.getTransceivers().some((transceiver) =>
        transceiver.direction.includes("recv"),
      );
      if (!receiving) {
        pc.addTransceiver(kind, { direction: "recvonly" });
      }
    }
  }, []);

  const queueIceCandidate = useCallback(
    (remoteId: string, candidate: RTCIceCandidateInit) => {
      const state = getPeerState(remoteId);
      const key = candidateKey(candidate);
      if (state.seenCandidates.has(key)) return;
      state.seenCandidates.add(key);

      const queue = pendingIceRef.current.get(remoteId) ?? [];
      queue.push(candidate);
      pendingIceRef.current.set(remoteId, queue);
      webrtcLog(remoteId, "remote-ice-queued", candidate.candidate ?? key);
    },
    [getPeerState],
  );

  const flushIce = useCallback(async (remoteId: string) => {
    const pc = peersRef.current.get(remoteId);
    if (!pc?.remoteDescription) return;
    const queued = pendingIceRef.current.get(remoteId) ?? [];
    pendingIceRef.current.set(remoteId, []);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        webrtcLog(remoteId, "remote-ice-added", candidate.candidate ?? candidateKey(candidate));
      } catch (error) {
        webrtcError(remoteId, "addIceCandidate failed", error);
      }
    }
  }, []);

  const sendSignal = useCallback(
    (message: SignalingMessage) => {
      sendSignaling({ ...message, meetingId });
    },
    [meetingId, sendSignaling],
  );

  const getOrCreatePc = useCallback(
    (remoteId: string) => {
      let pc = peersRef.current.get(remoteId);
      if (pc) return pc;

      if (!iceServersRef.current.length) {
        throw new Error("ICE servers not loaded");
      }

      pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        iceTransportPolicy: relayOnlyRef.current.get(remoteId) ? "relay" : "all",
      });

      webrtcLog(remoteId, "peer-created", {
        iceServers: sanitizeIceServers(iceServersRef.current),
        relayOnly: relayOnlyRef.current.get(remoteId) ?? false,
      });

      const state = getPeerState(remoteId);
      state.detachDiagnostics = attachPcDiagnostics(remoteId, pc, () => {
        void refreshDiagnostics();
      });

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          for (const track of event.streams[0].getTracks()) {
            addRemoteTrack(remoteId, track);
          }
        } else {
          addRemoteTrack(remoteId, event.track);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          webrtcLog(remoteId, "local-ice-candidate", {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            candidate: event.candidate.candidate,
          });
          sendSignal({
            type: "webrtc_ice",
            to: Number(remoteId),
            candidate: event.candidate.toJSON(),
          });
        } else {
          webrtcLog(remoteId, "ice-gathering-complete");
        }
      };

      pc.onconnectionstatechange = () => {
        webrtcLog(remoteId, "connectionstatechange", {
          connectionState: pc?.connectionState,
          iceConnectionState: pc?.iceConnectionState,
          signalingState: pc?.signalingState,
        });
        void refreshDiagnostics();
        if (pc?.connectionState !== "failed") return;
        webrtcError(remoteId, "connection-failed", {
          iceConnectionState: pc.iceConnectionState,
          turnAvailable,
        });
        if (!relayOnlyRef.current.get(remoteId) && turnAvailable) {
          relayOnlyRef.current.set(remoteId, true);
          removeRemote(remoteId);
          webrtcLog(remoteId, "retry-with-turn-relay");
          void reofferRef.current(remoteId, true);
        }
      };

      if (localStream?.active) {
        attachLocalTracks(pc);
      } else {
        ensureRecvOnly(pc);
      }

      peersRef.current.set(remoteId, pc);
      return pc;
    },
    [
      addRemoteTrack,
      attachLocalTracks,
      ensureRecvOnly,
      getPeerState,
      localStream,
      refreshDiagnostics,
      removeRemote,
      sendSignal,
      turnAvailable,
    ],
  );

  const reofferRef = useRef<(remoteId: string, force?: boolean) => Promise<void>>(async () => {});

  const isPolite = useCallback(
    (remoteId: string) => {
      if (!selfParticipantId) return false;
      return selfParticipantId > Number(remoteId);
    },
    [selfParticipantId],
  );

  const makeOffer = useCallback(
    async (remoteId: string, force = false) => {
      if (!selfParticipantId || !signalingReady || !canUseWebRTC) return;

      const state = getPeerState(remoteId);
      if (state.makingOffer) return;

      const existing = peersRef.current.get(remoteId);
      if (
        !force &&
        isConnected(existing) &&
        remoteStreamsRef.current.get(remoteId)?.getTracks().length &&
        existing?.getSenders().some((s) => s.track?.readyState === "live")
      ) {
        return;
      }

      if (shouldThrottleOffer(remoteId, force)) {
        webrtcLog(remoteId, "offer-throttled");
        return;
      }

      if (existing && existing.signalingState !== "stable" && !force) {
        webrtcLog(remoteId, "skip-offer-unstable", existing.signalingState);
        return;
      }

      state.makingOffer = true;
      try {
        const pc = getOrCreatePc(remoteId);
        attachLocalTracks(pc);
        if (!localStream?.active) {
          ensureRecvOnly(pc);
        }

        const offer = await pc.createOffer({
          ...OFFER_OPTIONS,
          iceRestart: force && relayOnlyRef.current.get(remoteId) === true,
        });
        await pc.setLocalDescription(offer);
        await limitOutgoingBitrate(pc);
        sendSignal({ type: "webrtc_offer", to: Number(remoteId), sdp: offer });
        markOfferSent(remoteId);
        webrtcLog(remoteId, "local-offer-sent", { force, type: offer.type });
      } catch (error) {
        webrtcError(remoteId, "makeOffer failed", error);
      } finally {
        state.makingOffer = false;
      }
    },
    [
      attachLocalTracks,
      canUseWebRTC,
      ensureRecvOnly,
      getOrCreatePc,
      getPeerState,
      localStream,
      markOfferSent,
      selfParticipantId,
      sendSignal,
      shouldThrottleOffer,
      signalingReady,
    ],
  );

  reofferRef.current = makeOffer;

  const handleOffer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      if (!selfParticipantId || !signalingReady || !canUseWebRTC) return;

      const polite = isPolite(remoteId);
      const state = getPeerState(remoteId);
      const pc = getOrCreatePc(remoteId);

      state.ignoreOffer = !polite && pc.signalingState !== "stable";
      if (state.ignoreOffer) {
        webrtcLog(remoteId, "ignore-offer-glare");
        return;
      }

      state.makingOffer = false;
      try {
        attachLocalTracks(pc);
        if (!localStream?.active) {
          ensureRecvOnly(pc);
        }

        if (pc.signalingState !== "stable") {
          if (!polite) return;
          await pc.setLocalDescription({ type: "rollback" });
          webrtcLog(remoteId, "rollback-local-offer");
        }

        webrtcLog(remoteId, "remote-offer-received", { type: sdp.type });
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer(OFFER_OPTIONS);
        await pc.setLocalDescription(answer);
        await limitOutgoingBitrate(pc);
        sendSignal({ type: "webrtc_answer", to: Number(remoteId), sdp: answer });
        webrtcLog(remoteId, "local-answer-sent");
        await flushIce(remoteId);
      } catch (error) {
        webrtcError(remoteId, "handleOffer failed", error);
        removeRemote(remoteId);
      }
    },
    [
      attachLocalTracks,
      canUseWebRTC,
      ensureRecvOnly,
      flushIce,
      getOrCreatePc,
      getPeerState,
      isPolite,
      localStream,
      removeRemote,
      selfParticipantId,
      sendSignal,
      signalingReady,
    ],
  );

  const handleAnswer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = peersRef.current.get(remoteId);
      if (!pc) return;

      const state = getPeerState(remoteId);
      if (state.ignoreOffer) return;
      if (pc.signalingState !== "have-local-offer") {
        webrtcLog(remoteId, "skip-answer", pc.signalingState);
        return;
      }

      try {
        webrtcLog(remoteId, "remote-answer-received", { type: sdp.type });
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushIce(remoteId);
      } catch (error) {
        webrtcError(remoteId, "handleAnswer failed", error);
        removeRemote(remoteId);
      } finally {
        state.makingOffer = false;
      }
    },
    [flushIce, getPeerState, removeRemote],
  );

  const handleIce = useCallback(
    async (remoteId: string, candidate: RTCIceCandidateInit) => {
      const pc = peersRef.current.get(remoteId);
      if (!pc || !pc.remoteDescription) {
        queueIceCandidate(remoteId, candidate);
        return;
      }

      const state = getPeerState(remoteId);
      const key = candidateKey(candidate);
      if (state.seenCandidates.has(key)) return;
      state.seenCandidates.add(key);

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        webrtcLog(remoteId, "remote-ice-added", candidate.candidate ?? key);
      } catch (error) {
        webrtcError(remoteId, "addIceCandidate failed", error);
      }
    },
    [getPeerState, queueIceCandidate],
  );

  const initiateConnection = useCallback(
    (remoteId: string, force = false) => {
      if (!canUseWebRTC) return;

      if (force || !isPolite(remoteId)) {
        void makeOffer(remoteId, force);
        return;
      }

      const state = getPeerState(remoteId);
      if (state.politeFallbackScheduled) return;
      state.politeFallbackScheduled = true;

      window.setTimeout(() => {
        const pc = peersRef.current.get(remoteId);
        const hasRemoteMedia = Boolean(remoteStreamsRef.current.get(remoteId)?.getTracks().length);
        if (!isConnected(pc) || !hasRemoteMedia) {
          void makeOffer(remoteId, true);
        }
      }, 2500);
    },
    [canUseWebRTC, getPeerState, isPolite, makeOffer],
  );

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      if (!message.from || message.from === selfParticipantId) return;
      if (message.to && message.to !== selfParticipantId) return;

      const remoteId = String(message.from);

      switch (message.type) {
        case "webrtc_ready":
          initiateConnection(remoteId);
          break;
        case "webrtc_offer":
          if (message.sdp) await handleOffer(remoteId, message.sdp);
          break;
        case "webrtc_answer":
          if (message.sdp) await handleAnswer(remoteId, message.sdp);
          break;
        case "webrtc_ice":
          if (message.candidate) await handleIce(remoteId, message.candidate);
          break;
        case "webrtc_left":
          removeRemote(remoteId);
          break;
        default:
          break;
      }
    },
    [handleAnswer, handleIce, handleOffer, initiateConnection, removeRemote, selfParticipantId],
  );

  const syncAll = useCallback(() => {
    if (!selfParticipantId || !signalingReady || !canUseWebRTC) return;

    const remoteIds = remoteParticipants
      .map((participant) => participant.id)
      .filter((id) => id !== String(selfParticipantId));

    for (const remoteId of remoteIds) {
      if (!peersRef.current.has(remoteId)) {
        initiateConnection(remoteId);
      }
    }

    for (const remoteId of peersRef.current.keys()) {
      if (!remoteIds.includes(remoteId)) {
        removeRemote(remoteId);
      }
    }
  }, [
    canUseWebRTC,
    initiateConnection,
    remoteParticipants,
    removeRemote,
    selfParticipantId,
    signalingReady,
  ]);

  useEffect(() => {
    if (!selfParticipantId || !signalingReady || !canUseWebRTC) return;
    const remoteKey = remoteParticipants
      .map((participant) => participant.id)
      .filter((id) => id !== String(selfParticipantId))
      .sort()
      .join(",");
    if (remoteKey === knownRemoteIdsRef.current) return;
    knownRemoteIdsRef.current = remoteKey;
    syncAll();
  }, [canUseWebRTC, remoteParticipants, selfParticipantId, signalingReady, syncAll]);

  // Renegotiate once when local tracks first become available (host camera after join).
  useEffect(() => {
    if (!selfParticipantId || !signalingReady || !canUseWebRTC) return;

    const trackSignature = localStream?.active
      ? localStream
          .getTracks()
          .map((track) => `${track.kind}:${track.id}:${track.enabled}:${track.readyState}`)
          .join("|")
      : "none";

    if (trackSignature === localTracksRef.current) return;
    const hadTracks = localTracksRef.current !== "none";
    localTracksRef.current = trackSignature;

    sendSignal({ type: "webrtc_ready" });

    if (trackSignature === "none") return;

    for (const { id: remoteId } of remoteParticipants) {
      if (remoteId === String(selfParticipantId)) continue;
      const pc = peersRef.current.get(remoteId);
      if (pc) attachLocalTracks(pc);

      const sending = pc?.getSenders().some((s) => s.track?.readyState === "live");
      if (!hadTracks || !sending) {
        void makeOffer(remoteId, true);
      }
    }
  }, [
    attachLocalTracks,
    canUseWebRTC,
    localStream,
    makeOffer,
    remoteParticipants,
    selfParticipantId,
    sendSignal,
    signalingReady,
  ]);

  // Retry only on hard failures — no offer spam.
  useEffect(() => {
    if (!selfParticipantId || !signalingReady || !canUseWebRTC) return;

    const interval = window.setInterval(() => {
      for (const { id: remoteId } of remoteParticipants) {
        if (remoteId === String(selfParticipantId)) continue;
        const pc = peersRef.current.get(remoteId);

        if (
          !pc ||
          pc.connectionState === "failed" ||
          pc.iceConnectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          initiateConnection(remoteId, true);
        }
      }
    }, 8000);

    return () => window.clearInterval(interval);
  }, [canUseWebRTC, initiateConnection, remoteParticipants, selfParticipantId, signalingReady]);

  useEffect(() => {
    return () => {
      for (const remoteId of [...peersRef.current.keys()]) {
        removeRemote(remoteId);
      }
    };
  }, [removeRemote]);

  return {
    remoteStreams,
    handleSignalingMessage,
    syncPeers: syncAll,
    peerDiagnostics,
    turnAvailable,
    turnError,
    iceReady,
    canUseWebRTC,
    iceConfig,
  };
}
