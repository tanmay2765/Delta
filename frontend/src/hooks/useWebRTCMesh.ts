import { useCallback, useEffect, useRef, useState } from "react";
import { fetchIceServers, getFallbackIceServers } from "@/lib/ice-servers";

const OFFER_OPTIONS: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

export type SignalingMessage = {
  type: string;
  from?: number;
  to?: number;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type RemoteParticipant = { id: string };

function cloneStreamMap(streams: Map<string, MediaStream>) {
  return new Map(streams);
}

function isConnected(pc: RTCPeerConnection | undefined) {
  return pc?.connectionState === "connected" || pc?.connectionState === "connecting";
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
  selfParticipantId: number | undefined,
  localStream: MediaStream | null,
  remoteParticipants: RemoteParticipant[],
  sendSignaling: (message: SignalingMessage) => void,
  signalingReady: boolean,
) {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const negotiatingRef = useRef<Set<string>>(new Set());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const knownRemoteIdsRef = useRef<string>("");
  const localTracksRef = useRef<string>("");
  const iceServersRef = useRef<RTCIceServer[]>(getFallbackIceServers());
  const relayOnlyRef = useRef<Map<string, boolean>>(new Map());
  const [iceReady, setIceReady] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    void fetchIceServers().then((servers) => {
      if (cancelled) return;
      iceServersRef.current = servers;
      setIceReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const publishStreams = useCallback(() => {
    setRemoteStreams(cloneStreamMap(remoteStreamsRef.current));
  }, []);

  const addRemoteTrack = useCallback(
    (remoteId: string, track: MediaStreamTrack) => {
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
      peersRef.current.get(remoteId)?.close();
      peersRef.current.delete(remoteId);
      pendingIceRef.current.delete(remoteId);
      negotiatingRef.current.delete(remoteId);
      relayOnlyRef.current.delete(remoteId);
      remoteStreamsRef.current.delete(remoteId);
      publishStreams();
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
      const receiving = pc.getTransceivers().some((transceiver) => {
        const receiverKind = transceiver.receiver.track?.kind;
        return receiverKind === kind || transceiver.direction.includes("recv");
      });
      if (!receiving) {
        pc.addTransceiver(kind, { direction: "recvonly" });
      }
    }
  }, []);

  const flushIce = useCallback(async (remoteId: string) => {
    const pc = peersRef.current.get(remoteId);
    if (!pc?.remoteDescription) return;
    const queued = pendingIceRef.current.get(remoteId) ?? [];
    pendingIceRef.current.set(remoteId, []);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore
      }
    }
  }, []);

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
        if (!event.candidate) return;
        sendSignaling({
          type: "webrtc_ice",
          to: Number(remoteId),
          candidate: event.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc?.connectionState !== "failed") return;
        if (!relayOnlyRef.current.get(remoteId)) {
          relayOnlyRef.current.set(remoteId, true);
          removeRemote(remoteId);
        }
        void reofferRef.current(remoteId, true);
      };

      if (localStream?.active) {
        attachLocalTracks(pc);
      } else {
        ensureRecvOnly(pc);
      }

      peersRef.current.set(remoteId, pc);
      return pc;
    },
    [addRemoteTrack, attachLocalTracks, ensureRecvOnly, localStream, removeRemote, sendSignaling],
  );

  const reofferRef = useRef<(remoteId: string, force?: boolean) => Promise<void>>(async () => {});

  const makeOffer = useCallback(
    async (remoteId: string, force = false) => {
      if (!selfParticipantId || !signalingReady || !iceReady || negotiatingRef.current.has(remoteId)) return;

      const existing = peersRef.current.get(remoteId);
      if (!force && isConnected(existing) && remoteStreamsRef.current.get(remoteId)?.getTracks().length) {
        return;
      }

      negotiatingRef.current.add(remoteId);
      try {
        const pc = getOrCreatePc(remoteId);
        attachLocalTracks(pc);
        if (!localStream?.active) {
          ensureRecvOnly(pc);
        }

        const offer = await pc.createOffer(OFFER_OPTIONS);
        await pc.setLocalDescription(offer);
        await limitOutgoingBitrate(pc);
        sendSignaling({ type: "webrtc_offer", to: Number(remoteId), sdp: offer });
      } catch {
        // Keep the PC — a retry will renegotiate.
      } finally {
        negotiatingRef.current.delete(remoteId);
      }
    },
    [
      attachLocalTracks,
      ensureRecvOnly,
      getOrCreatePc,
      iceReady,
      localStream,
      selfParticipantId,
      sendSignaling,
      signalingReady,
    ],
  );

  reofferRef.current = makeOffer;

  const handleOffer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      if (!selfParticipantId || !signalingReady || !iceReady) return;
      negotiatingRef.current.add(remoteId);
      try {
        const pc = getOrCreatePc(remoteId);
        attachLocalTracks(pc);
        if (!localStream?.active) {
          ensureRecvOnly(pc);
        }

        if (pc.signalingState === "have-local-offer") {
          await pc.setLocalDescription({ type: "rollback" });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer(OFFER_OPTIONS);
        await pc.setLocalDescription(answer);
        await limitOutgoingBitrate(pc);
        sendSignaling({ type: "webrtc_answer", to: Number(remoteId), sdp: answer });
        await flushIce(remoteId);
      } catch {
        removeRemote(remoteId);
      } finally {
        negotiatingRef.current.delete(remoteId);
      }
    },
    [
      attachLocalTracks,
      ensureRecvOnly,
      flushIce,
      getOrCreatePc,
      localStream,
      removeRemote,
      selfParticipantId,
      sendSignaling,
      signalingReady,
    ],
  );

  const handleAnswer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = peersRef.current.get(remoteId);
      if (!pc || pc.signalingState !== "have-local-offer") return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushIce(remoteId);
      } catch {
        removeRemote(remoteId);
      }
    },
    [flushIce, removeRemote],
  );

  const handleIce = useCallback(
    async (remoteId: string, candidate: RTCIceCandidateInit) => {
      if (!peersRef.current.has(remoteId)) {
        getOrCreatePc(remoteId);
      }
      const connection = peersRef.current.get(remoteId);
      if (!connection) return;
      if (!connection.remoteDescription) {
        const queue = pendingIceRef.current.get(remoteId) ?? [];
        queue.push(candidate);
        pendingIceRef.current.set(remoteId, queue);
        return;
      }
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore
      }
    },
    [getOrCreatePc],
  );

  const isPolite = useCallback(
    (remoteId: string) => {
      if (!selfParticipantId) return false;
      return selfParticipantId > Number(remoteId);
    },
    [selfParticipantId],
  );

  const initiateConnection = useCallback(
    (remoteId: string, force = false) => {
      if (force || !isPolite(remoteId)) {
        void makeOffer(remoteId, force);
        return;
      }
      // Polite peer fallback: if impolite side didn't connect within 2s, offer anyway.
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
  }, [initiateConnection, remoteParticipants, removeRemote, selfParticipantId, signalingReady]);

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
  }, [remoteParticipants, selfParticipantId, signalingReady, syncAll]);

  // When OUR camera/mic becomes ready, renegotiate with everyone (critical for host).
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

    sendSignaling({ type: "webrtc_ready" });

    for (const { id: remoteId } of remoteParticipants) {
      if (remoteId === String(selfParticipantId)) continue;
      const pc = peersRef.current.get(remoteId);
      if (pc) attachLocalTracks(pc);
      // Always re-offer when we gain local tracks — polite host must send media to guest.
      void makeOffer(remoteId, true);
    }
  }, [
    attachLocalTracks,
    localStream,
    makeOffer,
    remoteParticipants,
    selfParticipantId,
    sendSignaling,
    signalingReady,
  ]);

  // Retry stale / one-way connections every few seconds.
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
        } else if (pc.connectionState === "connected" && remoteTracks === 0) {
          initiateConnection(remoteId, true);
        }
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [initiateConnection, localStream, makeOffer, remoteParticipants, selfParticipantId, signalingReady]);

  useEffect(() => {
    return () => {
      for (const remoteId of [...peersRef.current.keys()]) {
        removeRemote(remoteId);
      }
    };
  }, [removeRemote]);

  return { remoteStreams, handleSignalingMessage, syncPeers: syncAll };
}
