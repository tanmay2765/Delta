import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";
import type { MeetingSession } from "@/lib/meeting-session";
import type { SignalingMessage } from "@/hooks/useWebRTCMesh";

export interface ChatPayload {
  type: "chat_message";
  from: number;
  sender_name: string;
  text: string;
  sent_at: string;
}

interface RealtimeMeetingPayload {
  type: string;
  meeting?: Record<string, unknown>;
  meeting_id?: string;
}

function wsBaseUrl() {
  return API_URL.replace(/^http/i, "ws");
}

export function useMeetingRealtime(
  meetingId: string,
  session: MeetingSession | null,
  onMeetingUpdate: (meeting: Record<string, unknown>) => void,
  onMeetingEnded: () => void,
  onSignalingMessage?: (message: SignalingMessage) => void,
  onChatMessage?: (message: ChatPayload) => void,
  onReaction?: (payload: { from: number; emoji: string }) => void,
  onRemoved?: () => void,
) {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const onSignalingRef = useRef(onSignalingMessage);
  const onChatRef = useRef(onChatMessage);
  const onReactionRef = useRef(onReaction);
  const onRemovedRef = useRef(onRemoved);

  useEffect(() => {
    onSignalingRef.current = onSignalingMessage;
  }, [onSignalingMessage]);

  useEffect(() => {
    onChatRef.current = onChatMessage;
  }, [onChatMessage]);

  useEffect(() => {
    onReactionRef.current = onReaction;
  }, [onReaction]);

  useEffect(() => {
    onRemovedRef.current = onRemoved;
  }, [onRemoved]);

  const sendSocketMessage = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }, []);

  const sendSignaling = useCallback(
    (message: SignalingMessage) => {
      sendSocketMessage(message);
    },
    [sendSocketMessage],
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      sendSocketMessage({ type: "chat_message", text });
    },
    [sendSocketMessage],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      sendSocketMessage({ type: "reaction", emoji });
    },
    [sendSocketMessage],
  );

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
          return;
        }
        if (payload.type === "meeting_ended") {
          onMeetingEnded();
          return;
        }
        if (payload.type === "participant_removed") {
          onRemovedRef.current?.();
          return;
        }
        if (payload.type === "chat_message") {
          onChatRef.current?.(payload as ChatPayload);
          return;
        }
        if (payload.type === "reaction") {
          onReactionRef.current?.(payload as { from: number; emoji: string });
          return;
        }
        if (payload.type.startsWith("webrtc_")) {
          onSignalingRef.current?.(payload as SignalingMessage);
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

  return { sendSignaling, sendChatMessage, sendReaction };
}
