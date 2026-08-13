export type PeerDiagnostic = {
  remoteId: string;
  signalingState: RTCSignalingState | "none";
  iceGatheringState: RTCIceGatheringState | "none";
  iceConnectionState: RTCIceConnectionState | "none";
  connectionState: RTCPeerConnectionState | "none";
  selectedCandidateType: string;
  localCandidate: string;
  remoteCandidate: string;
  bytesSent: number;
  bytesReceived: number;
  packetsLost: number;
  roundTripTime: number;
  jitter: number;
  localTracks: number;
  remoteTracks: number;
  relayOnly: boolean;
  lastUpdated: number;
};

const LOG_PREFIX = "[WebRTC]";

export function webrtcLog(remoteId: string, event: string, detail?: unknown) {
  if (import.meta.env.DEV || import.meta.env["VITE_WEBRTC_DEBUG"] === "true") {
    if (detail !== undefined) {
      console.info(`${LOG_PREFIX} peer=${remoteId} ${event}`, detail);
    } else {
      console.info(`${LOG_PREFIX} peer=${remoteId} ${event}`);
    }
  }
}

export function webrtcError(remoteId: string, event: string, error: unknown) {
  console.error(`${LOG_PREFIX} peer=${remoteId} ${event}`, error);
}

function candidateSummary(candidate: RTCIceCandidate | null | undefined): string {
  if (!candidate?.candidate) return "—";
  const typeMatch = candidate.candidate.match(/typ (\w+)/);
  return typeMatch ? `${typeMatch[1]} · ${candidate.address ?? candidate.candidate.slice(0, 40)}` : candidate.candidate.slice(0, 60);
}

export async function collectPeerDiagnostics(
  remoteId: string,
  pc: RTCPeerConnection | undefined,
  remoteStream: MediaStream | undefined,
  relayOnly: boolean,
): Promise<PeerDiagnostic> {
  const base: PeerDiagnostic = {
    remoteId,
    signalingState: pc?.signalingState ?? "none",
    iceGatheringState: pc?.iceGatheringState ?? "none",
    iceConnectionState: pc?.iceConnectionState ?? "none",
    connectionState: pc?.connectionState ?? "none",
    selectedCandidateType: "—",
    localCandidate: "—",
    remoteCandidate: "—",
    bytesSent: 0,
    bytesReceived: 0,
    packetsLost: 0,
    roundTripTime: 0,
    jitter: 0,
    localTracks: pc?.getSenders().filter((s) => s.track?.readyState === "live").length ?? 0,
    remoteTracks: remoteStream?.getTracks().filter((t) => t.readyState === "live").length ?? 0,
    relayOnly,
    lastUpdated: Date.now(),
  };

  if (!pc) return base;

  try {
    const stats = await pc.getStats();
    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        base.selectedCandidateType = String(report.currentRoundTripTime ?? report.state);
        const local = stats.get(String(report.localCandidateId));
        const remote = stats.get(String(report.remoteCandidateId));
        if (local?.type === "local-candidate") {
          base.localCandidate = `${local.candidateType ?? "?"} ${local.address ?? ""}:${local.port ?? ""}`;
          base.selectedCandidateType = String(local.candidateType ?? "—");
        }
        if (remote?.type === "remote-candidate") {
          base.remoteCandidate = `${remote.candidateType ?? "?"} ${remote.address ?? ""}:${remote.port ?? ""}`;
        }
        if (typeof report.currentRoundTripTime === "number") {
          base.roundTripTime = Math.round(report.currentRoundTripTime * 1000);
        }
      }
      if (report.type === "outbound-rtp") {
        base.bytesSent += Number(report.bytesSent ?? 0);
      }
      if (report.type === "inbound-rtp") {
        base.bytesReceived += Number(report.bytesReceived ?? 0);
        base.packetsLost += Number(report.packetsLost ?? 0);
        base.jitter = Math.round(Number(report.jitter ?? 0) * 1000);
      }
    });
  } catch {
    // getStats may fail on closed connections.
  }

  return base;
}

export function attachPcDiagnostics(
  remoteId: string,
  pc: RTCPeerConnection,
  onUpdate: () => void,
): () => void {
  const handler = (label: string) => () => {
    webrtcLog(remoteId, label, {
      signaling: pc.signalingState,
      ice: pc.iceConnectionState,
      connection: pc.connectionState,
    });
    onUpdate();
  };

  pc.onicegatheringstatechange = handler("icegatheringstatechange");
  pc.oniceconnectionstatechange = handler("iceconnectionstatechange");
  pc.onconnectionstatechange = handler("connectionstatechange");
  pc.onsignalingstatechange = handler("signalingstatechange");

  return () => {
    pc.onicegatheringstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.onconnectionstatechange = null;
    pc.onsignalingstatechange = null;
  };
}
