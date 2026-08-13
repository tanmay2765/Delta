import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

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
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(() => new Map());

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
      remoteStreamsRef.current.delete(remoteId);
      publishStreams();
    },
    [publishStreams],
  );

  const attachLocalTracks = useCallback(
    (pc: RTCPeerConnection) => {
      if (!localStream?.active) return;
      for (const track of localStream.getTracks()) {
        const sender = pc.getSenders().find((existing) => existing.track?.kind === track.kind);
        if (sender) {
          void sender.replaceTrack(track);
        } else {
          pc.addTrack(track, localStream);
        }
      }
    },
    [localStream],
  );

  const ensureRecvOnly = useCallback((pc: RTCPeerConnection) => {
    for (const kind of ["audio", "video"] as const) {
      const sending = pc.getSenders().some((sender) => sender.track?.kind === kind);
      if (sending) continue;
      const receiving = pc.getTransceivers().some((t) => t.receiver.track?.kind === kind);
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

      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

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
        if (pc?.connectionState === "failed") {
          void reofferRef.current(remoteId);
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
    [addRemoteTrack, attachLocalTracks, ensureRecvOnly, localStream, sendSignaling],
  );

  const reofferRef = useRef<(remoteId: string) => Promise<void>>(async () => {});

  const makeOffer = useCallback(
    async (remoteId: string) => {
      if (!selfParticipantId || !signalingReady || negotiatingRef.current.has(remoteId)) return;
      negotiatingRef.current.add(remoteId);
      try {
        const pc = getOrCreatePc(remoteId);
        attachLocalTracks(pc);
        if (localStream?.active) ensureRecvOnly(pc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignaling({ type: "webrtc_offer", to: Number(remoteId), sdp: offer });
      } catch {
        removeRemote(remoteId);
      } finally {
        negotiatingRef.current.delete(remoteId);
      }
    },
    [
      attachLocalTracks,
      ensureRecvOnly,
      getOrCreatePc,
      localStream,
      removeRemote,
      selfParticipantId,
      sendSignaling,
      signalingReady,
    ],
  );

  reofferRef.current = makeOffer;

  const handleOffer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      if (!selfParticipantId || !signalingReady) return;
      negotiatingRef.current.add(remoteId);
      try {
        const pc = getOrCreatePc(remoteId);
        attachLocalTracks(pc);

        if (pc.signalingState === "have-local-offer") {
          await pc.setLocalDescription({ type: "rollback" });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
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
      flushIce,
      getOrCreatePc,
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
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushIce(remoteId);
    },
    [flushIce],
  );

  const handleIce = useCallback(
    async (remoteId: string, candidate: RTCIceCandidateInit) => {
      const pc = peersRef.current.get(remoteId);
      if (!pc) {
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

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      if (!message.from || message.from === selfParticipantId) return;
      const remoteId = String(message.from);

      switch (message.type) {
        case "webrtc_ready":
          if (!isPolite(remoteId)) {
            await makeOffer(remoteId);
          }
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
    [handleAnswer, handleIce, handleOffer, isPolite, makeOffer, removeRemote, selfParticipantId],
  );

  const syncAll = useCallback(() => {
    if (!selfParticipantId || !signalingReady) return;

    const remoteIds = remoteParticipants
      .map((participant) => participant.id)
      .filter((id) => id !== String(selfParticipantId));

    for (const remoteId of remoteIds) {
      if (!isPolite(remoteId) && !peersRef.current.has(remoteId)) {
        void makeOffer(remoteId);
      }
    }

    for (const remoteId of peersRef.current.keys()) {
      if (!remoteIds.includes(remoteId)) {
        removeRemote(remoteId);
      }
    }

    sendSignaling({ type: "webrtc_ready" });
  }, [
    isPolite,
    makeOffer,
    remoteParticipants,
    removeRemote,
    selfParticipantId,
    sendSignaling,
    signalingReady,
  ]);

  useEffect(() => {
    syncAll();
  }, [remoteParticipants, signalingReady, localStream, syncAll]);

  useEffect(() => {
    if (!localStream?.active || !signalingReady) return;
    for (const remoteId of peersRef.current.keys()) {
      const pc = peersRef.current.get(remoteId);
      if (!pc) continue;
      attachLocalTracks(pc);
      if (!isPolite(remoteId) && pc.signalingState === "stable") {
        void makeOffer(remoteId);
      }
    }
    sendSignaling({ type: "webrtc_ready" });
  }, [attachLocalTracks, isPolite, localStream, makeOffer, sendSignaling, signalingReady]);

  useEffect(() => {
    return () => {
      for (const remoteId of [...peersRef.current.keys()]) {
        removeRemote(remoteId);
      }
    };
  }, [removeRemote]);

  return { remoteStreams, handleSignalingMessage, syncPeers: syncAll };
}
