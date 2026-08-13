import { X } from "lucide-react";
import type { PeerDiagnostic } from "@/lib/webrtc-diagnostics";

export function WebRtcDebugPanel({
  open,
  onClose,
  diagnostics,
  turnAvailable,
  turnError,
  iceSources,
  canUseWebRTC,
  iceReady,
  signalingReady,
}: {
  open: boolean;
  onClose: () => void;
  diagnostics: Map<string, PeerDiagnostic>;
  turnAvailable: boolean;
  turnError?: string | null;
  iceSources?: string[];
  canUseWebRTC?: boolean;
  iceReady: boolean;
  signalingReady: boolean;
}) {
  if (!open) return null;

  const rows = [...diagnostics.values()];

  return (
    <div className="absolute bottom-20 left-2 z-30 max-h-[50vh] w-[min(420px,calc(100vw-1rem))] overflow-auto rounded-xl border border-white/15 bg-black/90 p-3 text-xs text-white shadow-2xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold">WebRTC Diagnostics</p>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-1 text-[11px] text-white/70">
        <span>Signaling WS: {signalingReady ? "open" : "closed"}</span>
        <span>ICE config: {iceReady ? "loaded" : "loading"}</span>
        <span>WebRTC allowed: {canUseWebRTC ? "yes" : "blocked (no TURN)"}</span>
        <span className={turnAvailable ? "text-green-400" : "text-red-400"}>
          TURN configured: {turnAvailable ? "yes" : "NO"}
        </span>
        {iceSources?.length ? <span>Sources: {iceSources.join(", ")}</span> : null}
        {turnError ? <span className="text-red-300">{turnError}</span> : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-white/60">No peer connections yet.</p>
      ) : (
        rows.map((peer) => (
          <div key={peer.remoteId} className="mb-3 rounded-lg border border-white/10 p-2">
            <p className="mb-1 font-medium">Peer {peer.remoteId}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
              <dt className="text-white/50">Signaling</dt>
              <dd>{peer.signalingState}</dd>
              <dt className="text-white/50">ICE gathering</dt>
              <dd>{peer.iceGatheringState}</dd>
              <dt className="text-white/50">ICE connection</dt>
              <dd>{peer.iceConnectionState}</dd>
              <dt className="text-white/50">Connection</dt>
              <dd>{peer.connectionState}</dd>
              <dt className="text-white/50">Candidate type</dt>
              <dd>{peer.selectedCandidateType}</dd>
              <dt className="text-white/50">Local candidate</dt>
              <dd className="truncate">{peer.localCandidate}</dd>
              <dt className="text-white/50">Remote candidate</dt>
              <dd className="truncate">{peer.remoteCandidate}</dd>
              <dt className="text-white/50">Sent / received</dt>
              <dd>
                {peer.bytesSent} B / {peer.bytesReceived} B
              </dd>
              <dt className="text-white/50">Packets lost</dt>
              <dd>{peer.packetsLost}</dd>
              <dt className="text-white/50">RTT</dt>
              <dd>{peer.roundTripTime} ms</dd>
              <dt className="text-white/50">Tracks out/in</dt>
              <dd>
                {peer.localTracks} / {peer.remoteTracks}
              </dd>
              <dt className="text-white/50">Relay only</dt>
              <dd>{peer.relayOnly ? "yes" : "no"}</dd>
            </dl>
          </div>
        ))
      )}

      <p className="mt-2 text-[10px] text-white/45">
        Enable verbose logs: set VITE_WEBRTC_DEBUG=true. Use chrome://webrtc-internals for deep inspection.
      </p>
    </div>
  );
}
