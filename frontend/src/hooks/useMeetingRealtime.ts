import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";
import type { MeetingSession } from "@/lib/meeting-session";

interface RealtimeMeetingPayload {
  type: "meeting_updated" | "meeting_ended";
  meeting?: Record<string, unknown>;
  meeting_id?: string;
}

function wsBaseUrl() {
  const httpUrl = API_URL.replace(/^http/i, "ws");
  return httpUrl;
}

export function useMeetingRealtime(
  meetingId: string,
  session: MeetingSession | null,
  onMeetingUpdate: (meeting: Record<string, unknown>) => void,
  onMeetingEnded: () => void,
) {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!session?.participantId || !session.sessionToken) return;

    const url =
      `${wsBaseUrl()}/api/meetings/${encodeURIComponent(meetingId)}/ws` +
      `?participant_id=${session.participantId}` +
      `&session_token=${encodeURIComponent(session.sessionToken)}`;

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as RealtimeMeetingPayload;
        if (payload.type === "meeting_updated" && payload.meeting) {
          onMeetingUpdate(payload.meeting);
          queryClient.invalidateQueries({ queryKey: ["join-requests", meetingId] });
        }
        if (payload.type === "meeting_ended") {
          onMeetingEnded();
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [meetingId, session?.participantId, session?.sessionToken, onMeetingUpdate, onMeetingEnded, queryClient]);
}
