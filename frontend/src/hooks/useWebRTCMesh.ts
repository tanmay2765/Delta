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

type RemoteParticipant = {
  id: string;
};

function cloneStreamMap(streams: Map<string, MediaStream>) {
  return new Map(streams);
}

export function useWebRTCMesh(
  selfParticipantId: number | undefined,
  localStream: MediaStream | null,
  remoteParticipants: RemoteParticipant[],
  sendSignaling: (message: SignalingMessage) => void,
) {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(() => new Map());

  const updateRemoteStream = useCallback((participantId: string, stream: MediaStream | null) => {
    setRemoteStreams((current) => {
      const next = cloneStreamMap(current);
      if (stream) {
        next.set(participantId, stream);
      } else {
        next.delete(participantId);
      }
      return next;
    });
  }, []);

  const closePeer = useCallback(
    (remoteId: string) => {
      const pc = peersRef.current.get(remoteId);
      if (pc) {
        pc.close();
        peersRef.current.delete(remoteId);
      }
      makingOfferRef.current.delete(remoteId);
      updateRemoteStream(remoteId, null);
    },
    [updateRemoteStream],
  );

  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    if (!localStream) return;

    for (const track of localStream.getTracks()) {
      const sender = pc.getSenders().find((existing) => existing.track?.kind === track.kind);
      if (sender) {
        void sender.replaceTrack(track);
      } else {
        pc.addTrack(track, localStream);
      }
    }
  }, [localStream]);

  const ensureRecvTransceivers = useCallback((pc: RTCPeerConnection) => {
    const kinds: Array<"audio" | "video"> = ["audio", "video"];
    for (const kind of kinds) {
      const hasTransceiver = pc.getTransceivers().some((t) => t.receiver.track?.kind === kind);
      if (!hasTransceiver) {
        pc.addTransceiver(kind, { direction: "recvonly" });
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (remoteId: string) => {
      let pc = peersRef.current.get(remoteId);
      if (pc) return pc;

      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (!event.candidate || !selfParticipantId) return;
        sendSignaling({
          type: "webrtc_ice",
          to: Number(remoteId),
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (event) => {
        const [firstStream] = event.streams;
        const stream = firstStream ?? new MediaStream([event.track]);
        updateRemoteStream(remoteId, stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc && (pc.connectionState === "failed" || pc.connectionState === "closed")) {
          closePeer(remoteId);
        }
      };

      if (!localStream) {
        ensureRecvTransceivers(pc);
      }
      attachLocalTracks(pc);
      peersRef.current.set(remoteId, pc);
      return pc;
    },
    [attachLocalTracks, closePeer, ensureRecvTransceivers, localStream, selfParticipantId, sendSignaling, updateRemoteStream],
  );

  const createOffer = useCallback(
    async (remoteId: string) => {
      if (!selfParticipantId || makingOfferRef.current.has(remoteId)) return;

      makingOfferRef.current.add(remoteId);
      try {
        const pc = createPeerConnection(remoteId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignaling({
          type: "webrtc_offer",
          to: Number(remoteId),
          sdp: offer,
        });
      } catch {
        closePeer(remoteId);
      } finally {
        makingOfferRef.current.delete(remoteId);
      }
    },
    [closePeer, createPeerConnection, selfParticipantId, sendSignaling],
  );

  const handleOffer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      if (!selfParticipantId) return;

      const pc = createPeerConnection(remoteId);

      if (pc.signalingState === "have-local-offer") {
        await pc.setLocalDescription({ type: "rollback" });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignaling({
        type: "webrtc_answer",
        to: Number(remoteId),
        sdp: answer,
      });
    },
    [createPeerConnection, selfParticipantId, sendSignaling],
  );

  const handleAnswer = useCallback(async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
    const pc = peersRef.current.get(remoteId);
    if (!pc) return;
    if (pc.signalingState !== "have-local-offer") return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }, []);

  const handleIce = useCallback(async (remoteId: string, candidate: RTCIceCandidateInit) => {
    const pc = peersRef.current.get(remoteId);
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore late ICE candidates during negotiation.
    }
  }, []);

  const shouldInitiateWith = useCallback(
    (remoteId: string) => {
      if (!selfParticipantId) return false;
      return selfParticipantId < Number(remoteId);
    },
    [selfParticipantId],
  );

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      if (!message.from || message.from === selfParticipantId) return;
      const remoteId = String(message.from);

      switch (message.type) {
        case "webrtc_ready":
          if (shouldInitiateWith(remoteId)) {
            await createOffer(remoteId);
          }
          break;
        case "webrtc_offer":
          if (message.sdp) {
            await handleOffer(remoteId, message.sdp);
          }
          break;
        case "webrtc_answer":
          if (message.sdp) {
            await handleAnswer(remoteId, message.sdp);
          }
          break;
        case "webrtc_ice":
          if (message.candidate) {
            await handleIce(remoteId, message.candidate);
          }
          break;
        case "webrtc_left":
          closePeer(remoteId);
          break;
        default:
          break;
      }
    },
    [
      closePeer,
      createOffer,
      handleAnswer,
      handleIce,
      handleOffer,
      selfParticipantId,
      shouldInitiateWith,
    ],
  );

  useEffect(() => {
    if (!selfParticipantId) return;

    const remoteIds = new Set(remoteParticipants.map((participant) => participant.id));

    for (const remoteId of remoteIds) {
      if (remoteId === String(selfParticipantId)) continue;
      if (!peersRef.current.has(remoteId) && shouldInitiateWith(remoteId)) {
        void createOffer(remoteId);
      }
    }

    for (const remoteId of peersRef.current.keys()) {
      if (!remoteIds.has(remoteId)) {
        closePeer(remoteId);
      }
    }
  }, [closePeer, createOffer, remoteParticipants, selfParticipantId, shouldInitiateWith]);

  useEffect(() => {
    if (!localStream) return;

    for (const [remoteId, pc] of peersRef.current.entries()) {
      let addedTrack = false;
      for (const track of localStream.getTracks()) {
        const sender = pc.getSenders().find((existing) => existing.track?.kind === track.kind);
        if (sender) {
          void sender.replaceTrack(track);
        } else {
          pc.addTrack(track, localStream);
          addedTrack = true;
        }
      }
      if (addedTrack && pc.signalingState === "stable") {
        void createOffer(remoteId);
      }
    }
  }, [createOffer, localStream]);

  useEffect(() => {
    return () => {
      for (const remoteId of [...peersRef.current.keys()]) {
        closePeer(remoteId);
      }
    };
  }, [closePeer]);

  return {
    remoteStreams,
    handleSignalingMessage,
  };
}
