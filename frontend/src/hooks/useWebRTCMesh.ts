import { useCallback, useEffect, useRef, useState } from "react";
import { fetchIceServers, getFallbackIceServers, hasTurnConfigured } from "@/lib/ice-servers";
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
  const iceServersRef = useRef<RTCIceServer[]>(getFallbackIceServers());
  const relayOnlyRef = useRef<Map<string, boolean>>(new Map());
  const [iceReady, setIceReady] = useState(false);
  const [turnAvailable, setTurnAvailable] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(() => new Map());
  const [peerDiagnostics, setPeerDiagnostics] = useState<Map<string, PeerDiagnostic>>(() => new Map());

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
    void fetchIceServers().then((servers) => {
      if (cancelled) return;
      iceServersRef.current = servers;
      setTurnAvailable(hasTurnConfigured(servers));
      setIceReady(true);
      webrtcLog("*", "ice-servers-ready", {
        count: servers.length,
        turn: hasTurnConfigured(servers),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selfParticipantId || !iceReady) return;
    const interval = window.setInterval(() => {
      void refreshDiagnostics();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [iceReady, refreshDiagnostics, selfParticipantId]);

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

  const addRemoteTrack = useCallback(
    (remoteId: string, track: MediaStreamTrack) => {
      webrtcLog(remoteId, "ontrack", { kind: track.kind, id: track.id });
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

  const queueIceCandidate = useCallback((remoteId: string, candidate: RTCIceCandidateInit) => {
    const state = getPeerState(remoteId);
    const key = candidateKey(candidate);
    if (state.seenCandidates.has(key)) return;
    state.seenCandidates.add(key);

    const queue = pendingIceRef.current.get(remoteId) ?? [];
    queue.push(candidate);
    pendingIceRef.current.set(remoteId, queue);
    webrtcLog(remoteId, "remote-ice-queued", key);
  }, [getPeerState]);

  const flushIce = useCallback(async (remoteId: string) => {
    const pc = peersRef.current.get(remoteId);
    if (!pc?.remoteDescription) return;
    const queued = pendingIceRef.current.get(remoteId) ?? [];
    pendingIceRef.current.set(remoteId, []);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        webrtcLog(remoteId, "remote-ice-added", candidateKey(candidate));
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

      pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        iceTransportPolicy: relayOnlyRef.current.get(remoteId) ? "relay" : "all",
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
          webrtcLog(remoteId, "local-ice-candidate", event.candidate.type ?? event.candidate.candidate);
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
        void refreshDiagnostics();
        if (pc?.connectionState !== "failed") return;
        webrtcError(remoteId, "connection-failed", pc.connectionState);
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
      webrtcLog(remoteId, "peer-created", { relayOnly: relayOnlyRef.current.get(remoteId) ?? false });
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
      if (!selfParticipantId || !signalingReady || !iceReady) return;

      const state = getPeerState(remoteId);
      if (state.makingOffer) return;

      const existing = peersRef.current.get(remoteId);
      if (!force && isConnected(existing) && remoteStreamsRef.current.get(remoteId)?.getTracks().length) {
        return;
      }

      state.makingOffer = true;
      try {
        const pc = getOrCreatePc(remoteId);
        attachLocalTracks(pc);
        if (!localStream?.active) {
          ensureRecvOnly(pc);
        }

        if (pc.signalingState !== "stable" && !force) {
          webrtcLog(remoteId, "skip-offer-unstable", pc.signalingState);
          return;
        }

        const offer = await pc.createOffer(OFFER_OPTIONS);
        await pc.setLocalDescription(offer);
        await limitOutgoingBitrate(pc);
        sendSignal({ type: "webrtc_offer", to: Number(remoteId), sdp: offer });
        webrtcLog(remoteId, "local-offer-sent");
      } catch (error) {
        webrtcError(remoteId, "makeOffer failed", error);
      } finally {
        state.makingOffer = false;
      }
    },
    [
      attachLocalTracks,
      ensureRecvOnly,
      getOrCreatePc,
      getPeerState,
      iceReady,
      localStream,
      selfParticipantId,
      sendSignal,
      signalingReady,
    ],
  );

  reofferRef.current = makeOffer;

  const handleOffer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      if (!selfParticipantId || !signalingReady || !iceReady) return;

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
      ensureRecvOnly,
      flushIce,
      getOrCreatePc,
      getPeerState,
      iceReady,
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
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        webrtcLog(remoteId, "remote-answer-applied");
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
        webrtcLog(remoteId, "remote-ice-added", key);
      } catch (error) {
        webrtcError(remoteId, "addIceCandidate failed", error);
      }
    },
    [getPeerState, queueIceCandidate],
  );

  const initiateConnection = useCallback(
    (remoteId: string, force = false) => {
      if (force || !isPolite(remoteId)) {
        void makeOffer(remoteId, force);
        return;
      }
      window.setTimeout(() => {
        const pc = peersRef.current.get(remoteId);
        const hasRemoteMedia = Boolean(remoteStreamsRef.current.get(remoteId)?.getTracks().length);
        if (!isConnected(pc) || !hasRemoteMedia) {
          void makeOffer(remoteId, true);
        }
      }, 2000);
    },
    [isPolite, makeOffer],
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
    if (!selfParticipantId || !signalingReady || !iceReady) return;

    const remoteIds = remoteParticipants
      .map((participant) => participant.id)
      .filter((id) => id !== String(selfParticipantId));

    for (const remoteId of remoteIds) {
      initiateConnection(remoteId);
    }

    for (const remoteId of peersRef.current.keys()) {
      if (!remoteIds.includes(remoteId)) {
        removeRemote(remoteId);
      }
    }
  }, [initiateConnection, iceReady, remoteParticipants, removeRemote, selfParticipantId, signalingReady]);

  useEffect(() => {
    if (!selfParticipantId || !signalingReady || !iceReady) return;
    const remoteKey = remoteParticipants
      .map((participant) => participant.id)
      .filter((id) => id !== String(selfParticipantId))
      .sort()
      .join(",");
    if (remoteKey === knownRemoteIdsRef.current) return;
    knownRemoteIdsRef.current = remoteKey;
    syncAll();
  }, [remoteParticipants, selfParticipantId, signalingReady, iceReady, syncAll]);

  useEffect(() => {
    if (!selfParticipantId || !signalingReady || !iceReady) return;

    const trackSignature = localStream?.active
      ? localStream
          .getTracks()
          .map((track) => `${track.kind}:${track.id}:${track.enabled}:${track.readyState}`)
          .join("|")
      : "none";

    if (trackSignature === localTracksRef.current) return;
    localTracksRef.current = trackSignature;

    sendSignal({ type: "webrtc_ready" });

    for (const { id: remoteId } of remoteParticipants) {
      if (remoteId === String(selfParticipantId)) continue;
      if (peersRef.current.get(remoteId)) {
        attachLocalTracks(peersRef.current.get(remoteId)!);
      }
      void makeOffer(remoteId, true);
    }
  }, [
    attachLocalTracks,
    iceReady,
    localStream,
    makeOffer,
    remoteParticipants,
    selfParticipantId,
    sendSignal,
    signalingReady,
  ]);

  useEffect(() => {
    if (!selfParticipantId || !signalingReady || !iceReady) return;

    const interval = window.setInterval(() => {
      for (const { id: remoteId } of remoteParticipants) {
        if (remoteId === String(selfParticipantId)) continue;
        const pc = peersRef.current.get(remoteId);
        const remoteTracks = remoteStreamsRef.current.get(remoteId)?.getTracks().length ?? 0;
        const sending = pc?.getSenders().some(
          (sender) => sender.track && sender.track.readyState === "live",
        );

        if (!pc || pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          initiateConnection(remoteId, true);
        } else if (localStream?.active && !sending) {
          void makeOffer(remoteId, true);
        } else if (isConnected(pc) && remoteTracks === 0) {
          initiateConnection(remoteId, true);
        }
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [
    initiateConnection,
    iceReady,
    localStream,
    makeOffer,
    remoteParticipants,
    selfParticipantId,
    signalingReady,
  ]);

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
    iceReady,
  };
}
