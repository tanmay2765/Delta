import { getToken } from "./auth-storage";
import type {
  ActivityPoint,
  AuthResponse,
  CreateInstantMeetingInput,
  CreatedMeeting,
  JoinMeetingResult,
  JoinRequest,
  Meeting,
  MeetingHistoryItem,
  MeetingInviteResult,
  MeetingStatus,
  ScheduleMeetingInput,
} from "./types";

export const API_URL = resolveApiUrl();

function resolveApiUrl(): string {
  const baked = import.meta.env["VITE_API_URL"] ?? "http://localhost:8000";
  if (typeof window === "undefined") return baked;

  // Render misconfig: frontend live but API still points at localhost.
  if (baked.includes("localhost") && window.location.hostname.includes("onrender.com")) {
    const hint = sessionStorage.getItem("delta_api_url");
    if (hint) return hint;
  }
  return baked;
}

class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

interface BackendParticipant {
  id: number;
  display_name: string;
  is_host: boolean;
  is_active: boolean;
  mic_allowed: boolean;
  camera_allowed: boolean;
  mic_on: boolean;
  camera_on: boolean;
  joined_at: string;
  session_token?: string;
}

interface BackendMeeting {
  id: number;
  meeting_id: string;
  title: string | null;
  description: string | null;
  host_name: string;
  scheduled_at: string | null;
  duration: number | null;
  invite_code: string;
  join_policy: "open" | "approval_required";
  status: string;
  created_at: string;
  started_at: string | null;
  participants: BackendParticipant[];
}

interface BackendJoinResponse {
  meeting: BackendMeeting;
  participant: BackendParticipant | null;
  status: "joined" | "awaiting_approval";
  join_request_id: number | null;
}

interface BackendJoinRequest {
  id: number;
  display_name: string;
  status: string;
  created_at: string;
}

interface BackendInviteResponse {
  id: number;
  email: string;
  invite_link: string;
  created_at: string;
}

function frontendOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:8081";
}

function inviteLinkFor(meetingId: string, inviteCode?: string) {
  const digits = meetingId.replace(/\D/g, "");
  if (inviteCode) {
    return `${frontendOrigin()}/join?code=${inviteCode}`;
  }
  return `${frontendOrigin()}/join?id=${digits}`;
}

function mapParticipant(participant: BackendParticipant, selfId?: number): import("./types").Participant {
  return {
    id: String(participant.id),
    name: participant.display_name,
    isHost: participant.is_host,
    micOn: participant.mic_on,
    cameraOn: participant.camera_on,
    micAllowed: participant.mic_allowed,
    cameraAllowed: participant.camera_allowed,
    status: "joined",
    isSelf: selfId !== undefined && participant.id === selfId,
  };
}

export function mapMeetingFromBackend(meeting: BackendMeeting, selfParticipantId?: number): Meeting {
  return {
    id: meeting.meeting_id.replace(/\D/g, ""),
    title: meeting.title ?? "Untitled Meeting",
    description: meeting.description ?? undefined,
    host: meeting.host_name,
    startTime: meeting.scheduled_at ?? meeting.created_at,
    startedAt: meeting.started_at ?? undefined,
    durationMinutes: meeting.duration ?? 60,
    inviteCode: meeting.invite_code,
    joinPolicy: meeting.join_policy,
    status: meeting.status as MeetingStatus,
    participants: meeting.participants.map((p) => mapParticipant(p, selfParticipantId)),
  };
}

function mapJoinResult(response: BackendJoinResponse): JoinMeetingResult {
  return {
    meetingId: response.meeting.meeting_id.replace(/\D/g, ""),
    status: response.status,
    participantId: response.participant?.id,
    sessionToken: response.participant?.session_token,
    isHost: response.participant?.is_host,
    micAllowed: response.participant?.mic_allowed,
    cameraAllowed: response.participant?.camera_allowed,
    micOn: response.participant?.mic_on,
    cameraOn: response.participant?.camera_on,
    joinRequestId: response.join_request_id ?? undefined,
  };
}

function mapHistoryItem(meeting: BackendMeeting): MeetingHistoryItem {
  return {
    id: meeting.meeting_id.replace(/\D/g, ""),
    title: meeting.title ?? "Untitled Meeting",
    host: meeting.host_name,
    date: meeting.scheduled_at ?? meeting.created_at,
    durationLabel: meeting.duration ? `${meeting.duration} min` : "Instant",
    participantCount: meeting.participants.length,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Frontend-Origin": frontendOrigin(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const error = await res.json();
      if (typeof error.detail === "string") {
        message = error.detail;
      }
    } catch {
      message = res.statusText;
    }
    throw new ApiClientError(message, res.status);
  }

  return (await res.json()) as T;
}

export const api = {
  signup(data: { email: string; password: string; full_name: string }) {
    return request<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  login(data: { email: string; password: string }) {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getMe() {
    return request<AuthResponse["user"]>("/api/auth/me");
  },

  updateProfile(data: {
    full_name?: string;
    phone?: string | null;
    timezone?: string;
    language?: string;
    date_format?: string;
    time_format?: string;
  }) {
    return request<AuthResponse["user"]>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getUpcomingMeetings: async () => {
    const meetings = await request<BackendMeeting[]>("/api/meetings/upcoming");
    return meetings.map((meeting) => mapMeetingFromBackend(meeting));
  },

  getRecentMeetings: async () => {
    const meetings = await request<BackendMeeting[]>("/api/meetings/recent");
    return meetings.map(mapHistoryItem);
  },

  getActivity: async (): Promise<ActivityPoint[]> => {
    const rows = await request<Array<{ date: string; count: number }>>("/api/meetings/activity");
    return rows.map((row) => ({
      day: row.date,
      minutes: row.count * 45,
    }));
  },

  getMeeting: async (id: string, selfParticipantId?: number) => {
    const meeting = await request<BackendMeeting>(`/api/meetings/${encodeURIComponent(id)}`);
    return mapMeetingFromBackend(meeting, selfParticipantId);
  },

  getMeetingByInviteCode: async (code: string, selfParticipantId?: number) => {
    const meeting = await request<BackendMeeting>(`/api/meetings/invite/${encodeURIComponent(code)}`);
    return mapMeetingFromBackend(meeting, selfParticipantId);
  },

  createInstantMeeting: async (input: CreateInstantMeetingInput): Promise<CreatedMeeting> => {
    const meeting = await request<BackendMeeting>("/api/meetings/instant", {
      method: "POST",
      body: JSON.stringify({
        host_name: input.host,
        title: input.title,
        description: input.description,
        join_policy: input.joinPolicy,
        mic_on: input.micOn,
        camera_on: input.cameraOn,
      }),
    });
    const meetingId = meeting.meeting_id.replace(/\D/g, "");
    return {
      meetingId,
      inviteLink: inviteLinkFor(meetingId, meeting.invite_code),
      title: meeting.title ?? input.title,
      inviteCode: meeting.invite_code,
    };
  },

  scheduleMeeting: async (input: ScheduleMeetingInput): Promise<CreatedMeeting> => {
    const scheduledAt = new Date(`${input.date}T${input.startTime}`);
    const meeting = await request<BackendMeeting>("/api/meetings/schedule", {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        host_name: input.host,
        scheduled_at: scheduledAt.toISOString(),
        duration: input.durationMinutes,
        join_policy: input.joinPolicy,
      }),
    });
    const meetingId = meeting.meeting_id.replace(/\D/g, "");
    return {
      meetingId,
      inviteLink: inviteLinkFor(meetingId, meeting.invite_code),
      title: meeting.title ?? input.title,
      startTime: meeting.scheduled_at ?? undefined,
      inviteCode: meeting.invite_code,
    };
  },

  joinMeeting: async (
    meetingId: string,
    displayName: string,
    options?: {
      micOn?: boolean;
      cameraOn?: boolean;
      participantId?: number;
      sessionToken?: string;
    },
  ): Promise<JoinMeetingResult> => {
    const response = await request<BackendJoinResponse>(
      `/api/meetings/${encodeURIComponent(meetingId)}/join`,
      {
        method: "POST",
        body: JSON.stringify({
          display_name: displayName,
          mic_on: options?.micOn ?? true,
          camera_on: options?.cameraOn ?? true,
          participant_id: options?.participantId,
          session_token: options?.sessionToken,
        }),
      },
    );
    return mapJoinResult(response);
  },

  resumeSession: async (
    meetingId: string,
    participantId: number,
    sessionToken: string,
  ): Promise<JoinMeetingResult> => {
    const response = await request<BackendJoinResponse>(
      `/api/meetings/${encodeURIComponent(meetingId)}/participants/${participantId}/resume`,
      {
        method: "POST",
        body: JSON.stringify({ session_token: sessionToken }),
      },
    );
    return mapJoinResult(response);
  },

  updateParticipantMedia: async (
    meetingId: string,
    participantId: number,
    sessionToken: string,
    media: { micOn?: boolean; cameraOn?: boolean },
  ) => {
    return request<BackendParticipant>(
      `/api/meetings/${encodeURIComponent(meetingId)}/participants/${participantId}/media`,
      {
        method: "PATCH",
        body: JSON.stringify({
          session_token: sessionToken,
          mic_on: media.micOn,
          camera_on: media.cameraOn,
        }),
      },
    );
  },

  updateParticipantPermissions: async (
    meetingId: string,
    hostParticipantId: number,
    hostSessionToken: string,
    targetParticipantId: number,
    permissions: { micAllowed?: boolean; cameraAllowed?: boolean },
  ) => {
    return request<BackendParticipant>(
      `/api/meetings/${encodeURIComponent(meetingId)}/participants/${targetParticipantId}/permissions?host_participant_id=${hostParticipantId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          host_session_token: hostSessionToken,
          mic_allowed: permissions.micAllowed,
          camera_allowed: permissions.cameraAllowed,
        }),
      },
    );
  },

  leaveMeeting: async (meetingId: string, participantId: number, sessionToken: string) => {
    return request<BackendMeeting>(
      `/api/meetings/${encodeURIComponent(meetingId)}/participants/${participantId}/leave`,
      {
        method: "POST",
        body: JSON.stringify({ session_token: sessionToken }),
      },
    );
  },

  startMeeting: async (meetingId: string, participantId: number, sessionToken: string) => {
    return request<BackendMeeting>(
      `/api/meetings/${encodeURIComponent(meetingId)}/start?participant_id=${participantId}`,
      {
        method: "POST",
        body: JSON.stringify({ session_token: sessionToken }),
      },
    );
  },

  listJoinRequests: async (
    meetingId: string,
    hostParticipantId: number,
    hostSessionToken: string,
  ): Promise<JoinRequest[]> => {
    const items = await request<BackendJoinRequest[]>(
      `/api/meetings/${encodeURIComponent(meetingId)}/join-requests?host_participant_id=${hostParticipantId}&host_session_token=${encodeURIComponent(hostSessionToken)}`,
    );
    return items.map((item) => ({
      id: item.id,
      displayName: item.display_name,
      status: item.status,
      createdAt: item.created_at,
    }));
  },

  approveJoinRequest: async (
    meetingId: string,
    requestId: number,
    hostParticipantId: number,
    hostSessionToken: string,
  ) => {
    return request(`/api/meetings/${encodeURIComponent(meetingId)}/join-requests/${requestId}/approve?host_participant_id=${hostParticipantId}`, {
      method: "POST",
      body: JSON.stringify({ session_token: hostSessionToken }),
    });
  },

  denyJoinRequest: async (
    meetingId: string,
    requestId: number,
    hostParticipantId: number,
    hostSessionToken: string,
  ) => {
    return request(`/api/meetings/${encodeURIComponent(meetingId)}/join-requests/${requestId}/deny?host_participant_id=${hostParticipantId}`, {
      method: "POST",
      body: JSON.stringify({ session_token: hostSessionToken }),
    });
  },

  inviteToMeeting: async (meetingId: string, email: string): Promise<MeetingInviteResult> => {
    const response = await request<BackendInviteResponse>(
      `/api/meetings/${encodeURIComponent(meetingId)}/invites`,
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
    return {
      email: response.email,
      inviteLink: response.invite_link,
    };
  },

  endMeeting: async (meetingId: string, hostParticipantId: number, hostSessionToken: string) => {
    return request<BackendMeeting>(
      `/api/meetings/${encodeURIComponent(meetingId)}/end?host_participant_id=${hostParticipantId}`,
      {
        method: "POST",
        body: JSON.stringify({ session_token: hostSessionToken }),
      },
    );
  },

  muteAllParticipants: async (meetingId: string, hostParticipantId: number, hostSessionToken: string) => {
    return request<BackendMeeting>(
      `/api/meetings/${encodeURIComponent(meetingId)}/participants/mute-all?host_participant_id=${hostParticipantId}`,
      {
        method: "POST",
        body: JSON.stringify({ session_token: hostSessionToken }),
      },
    );
  },

  removeParticipant: async (
    meetingId: string,
    hostParticipantId: number,
    hostSessionToken: string,
    targetParticipantId: number,
  ) => {
    return request<BackendParticipant>(
      `/api/meetings/${encodeURIComponent(meetingId)}/participants/${targetParticipantId}/remove?host_participant_id=${hostParticipantId}`,
      {
        method: "POST",
        body: JSON.stringify({ session_token: hostSessionToken }),
      },
    );
  },
};

export { inviteLinkFor };
