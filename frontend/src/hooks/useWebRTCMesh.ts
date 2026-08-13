import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
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

function mergeRemoteTrack(
  current: Map<string, MediaStream>,
  remoteId: string,
  track: MediaStreamTrack,
): Map<string, MediaStream> {
  const next = cloneStreamMap(current);
  let stream = next.get(remoteId);
  if (!stream) {
    stream = new MediaStream();
    next.set(remoteId, stream);
  }
  if (!stream.getTracks().some((existing) => existing.id === track.id)) {
    stream.addTrack(track);
  }
  return next;
}

export function useWebRTCMesh(
  selfParticipantId: number | undefined,
  localStream: MediaStream | null,
  remoteParticipants: RemoteParticipant[],
  sendSignaling: (message: SignalingMessage) => void,
  signalingReady: boolean,
) {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteParticipantsRef = useRef(remoteParticipants);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(() => new Map());

  remoteParticipantsRef.current = remoteParticipants;

  const updateRemoteStream = useCallback((participantId: string, stream: MediaStream | null) => {
    if (stream) {
      remoteStreamsRef.current.set(participantId, stream);
    } else {
      remoteStreamsRef.current.delete(participantId);
    }
    setRemoteStreams(cloneStreamMap(remoteStreamsRef.current));
  }, []);

  const mergeTrackForRemote = useCallback((remoteId: string, track: MediaStreamTrack) => {
    remoteStreamsRef.current = mergeRemoteTrack(remoteStreamsRef.current, remoteId, track);
    setRemoteStreams(cloneStreamMap(remoteStreamsRef.current));
  }, []);

  const closePeer = useCallback(
    (remoteId: string) => {
      const pc = peersRef.current.get(remoteId);
      if (pc) {
        pc.close();
        peersRef.current.delete(remoteId);
      }
      makingOfferRef.current.delete(remoteId);
      pendingIceRef.current.delete(remoteId);
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
    for (const kind of ["audio", "video"] as const) {
      const hasSender = pc.getSenders().some((sender) => sender.track?.kind === kind);
      if (hasSender) continue;
      const hasRecvForKind = pc
        .getTransceivers()
        .some((transceiver) => transceiver.receiver.track?.kind === kind);
      if (!hasRecvForKind) {
        pc.addTransceiver(kind, { direction: "recvonly" });
      }
    }
  }, []);

  const flushPendingIce = useCallback(async (remoteId: string) => {
    const pc = peersRef.current.get(remoteId);
    if (!pc?.remoteDescription) return;
    const pending = pendingIceRef.current.get(remoteId) ?? [];
    if (pending.length === 0) return;
    pendingIceRef.current.delete(remoteId);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale ICE candidates.
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
        if (firstStream) {
          for (const track of firstStream.getTracks()) {
            mergeTrackForRemote(remoteId, track);
          }
          return;
        }
        mergeTrackForRemote(remoteId, event.track);
      };

      pc.onconnectionstatechange = () => {
        if (pc && (pc.connectionState === "failed" || pc.connectionState === "closed")) {
          closePeer(remoteId);
        }
      };

      if (localStream) {
        attachLocalTracks(pc);
      } else {
        ensureRecvTransceivers(pc);
      }

      peersRef.current.set(remoteId, pc);
      return pc;
    },
    [
      attachLocalTracks,
      closePeer,
      ensureRecvTransceivers,
      localStream,
      mergeTrackForRemote,
      selfParticipantId,
      sendSignaling,
    ],
  );

  const createOffer = useCallback(
    async (remoteId: string) => {
      if (!selfParticipantId || !signalingReady || makingOfferRef.current.has(remoteId)) return;

      makingOfferRef.current.add(remoteId);
      try {
        const pc = createPeerConnection(remoteId);
        attachLocalTracks(pc);
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
    [
      attachLocalTracks,
      closePeer,
      createPeerConnection,
      selfParticipantId,
      sendSignaling,
      signalingReady,
    ],
  );

  const handleOffer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      if (!selfParticipantId || !signalingReady) return;

      const pc = createPeerConnection(remoteId);
      attachLocalTracks(pc);

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
      await flushPendingIce(remoteId);
    },
    [
      attachLocalTracks,
      createPeerConnection,
      flushPendingIce,
      selfParticipantId,
      sendSignaling,
      signalingReady,
    ],
  );

  const handleAnswer = useCallback(
    async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = peersRef.current.get(remoteId);
      if (!pc) return;
      if (pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingIce(remoteId);
    },
    [flushPendingIce],
  );

  const handleIce = useCallback(
    async (remoteId: string, candidate: RTCIceCandidateInit) => {
      const pc = peersRef.current.get(remoteId);
      if (!pc || !candidate) return;
      if (!pc.remoteDescription) {
        const queue = pendingIceRef.current.get(remoteId) ?? [];
        queue.push(candidate);
        pendingIceRef.current.set(remoteId, queue);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore late ICE candidates during negotiation.
      }
    },
    [],
  );

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

  const syncPeers = useCallback(() => {
    if (!selfParticipantId || !signalingReady) return;

    const remoteIds = new Set(remoteParticipantsRef.current.map((participant) => participant.id));

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

    if (localStream) {
      sendSignaling({ type: "webrtc_ready" });
    }
  }, [closePeer, createOffer, localStream, selfParticipantId, sendSignaling, shouldInitiateWith, signalingReady]);

  useEffect(() => {
    syncPeers();
  }, [remoteParticipants, signalingReady, syncPeers]);

  useEffect(() => {
    if (!selfParticipantId || !localStream || !signalingReady) return;
    if (localStreamRef.current === localStream) return;
    localStreamRef.current = localStream;

    for (const { id: remoteId } of remoteParticipantsRef.current) {
      if (remoteId === String(selfParticipantId)) continue;
      const pc = peersRef.current.get(remoteId);
      if (pc) {
        attachLocalTracks(pc);
      }
    }

    sendSignaling({ type: "webrtc_ready" });

    for (const { id: remoteId } of remoteParticipantsRef.current) {
      if (remoteId === String(selfParticipantId)) continue;
      if (shouldInitiateWith(remoteId)) {
        void createOffer(remoteId);
      }
    }
  }, [
    attachLocalTracks,
    createOffer,
    localStream,
    selfParticipantId,
    sendSignaling,
    shouldInitiateWith,
    signalingReady,
  ]);

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
    syncPeers,
  };
}
