/**
 * Centralised API layer for Delta.
 *
 * BACKEND STATUS: no service is currently reachable at the configured API URL,
 * so every call below falls back to the local mock layer (`mock-data.ts`) and is
 * marked with the endpoint it should hit once the backend exists.
 * Components must never fetch directly — always go through this module.
 */
import { ACTIVITY, CURRENT_USER, DIRECTORY, RECENT_MEETINGS, UPCOMING_MEETINGS } from "./mock-data";
import type {
  ActivityPoint,
  CreateInstantMeetingInput,
  CreatedMeeting,
  Meeting,
  MeetingHistoryItem,
  Participant,
  ScheduleMeetingInput,
} from "./types";

export const API_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:8000";

/** Endpoints expected from the backend; used for the "missing endpoint" notices. */
export const ENDPOINTS = {
  upcoming: "GET /meetings/upcoming",
  recent: "GET /meetings/recent",
  activity: "GET /analytics/activity",
  directory: "GET /users",
  instant: "POST /meetings/instant",
  schedule: "POST /meetings/schedule",
  join: "POST /meetings/{id}/join",
  detail: "GET /meetings/{id}",
} as const;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** Try the real backend; fall back to mock data while the API is unavailable. */
async function withFallback<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch {
    await new Promise((r) => setTimeout(r, 250));
    return fallback;
  }
}

function makeMeetingId() {
  return String(Math.floor(100000000 + Math.random() * 899999999));
}

export function inviteLinkFor(meetingId: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://delta.app";
  return `${origin}/meeting/${meetingId}`;
}

export const api = {
  currentUser: () => CURRENT_USER,

  getUpcomingMeetings: () => withFallback<Meeting[]>("/meetings/upcoming", UPCOMING_MEETINGS),

  getRecentMeetings: () => withFallback<MeetingHistoryItem[]>("/meetings/recent", RECENT_MEETINGS),

  getActivity: () => withFallback<ActivityPoint[]>("/analytics/activity", ACTIVITY),

  getDirectory: () => withFallback<Participant[]>("/users", DIRECTORY),

  getMeeting: async (id: string) => {
    const fallback: Meeting = UPCOMING_MEETINGS.find((m) => m.id === id) ?? {
      id,
      title: "Product Team Sync",
      host: "Tanmay K.",
      startTime: new Date().toISOString(),
      durationMinutes: 60,
      participants: DIRECTORY.slice(0, 5),
    };
    return withFallback<Meeting>(`/meetings/${id}`, fallback);
  },

  createInstantMeeting: async (input: CreateInstantMeetingInput): Promise<CreatedMeeting> => {
    const id = makeMeetingId();
    return withFallback<CreatedMeeting>(
      "/meetings/instant",
      { meetingId: id, inviteLink: inviteLinkFor(id), title: input.title },
      { method: "POST", body: JSON.stringify(input) },
    );
  },

  scheduleMeeting: async (input: ScheduleMeetingInput): Promise<CreatedMeeting> => {
    const id = makeMeetingId();
    return withFallback<CreatedMeeting>(
      "/meetings/schedule",
      {
        meetingId: id,
        inviteLink: inviteLinkFor(id),
        title: input.title,
        startTime: `${input.date}T${input.startTime}`,
      },
      { method: "POST", body: JSON.stringify(input) },
    );
  },

  joinMeeting: async (meetingId: string, displayName: string) => {
    return withFallback<{ meetingId: string; ok: boolean }>(
      `/meetings/${meetingId}/join`,
      { meetingId, ok: true },
      { method: "POST", body: JSON.stringify({ displayName }) },
    );
  },
};
