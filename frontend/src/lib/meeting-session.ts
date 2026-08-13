export interface MeetingSession {
  participantId: number;
  displayName: string;
  isHost: boolean;
  sessionToken: string;
  joinRequestId?: number;
}

const prefix = "delta_meeting_session:";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function setMeetingSession(meetingId: string, session: MeetingSession) {
  if (!canUseStorage()) return;
  const key = prefix + meetingId.replace(/\D/g, "");
  sessionStorage.setItem(key, JSON.stringify(session));
}

export function getMeetingSession(meetingId: string): MeetingSession | null {
  if (!canUseStorage()) return null;
  const key = prefix + meetingId.replace(/\D/g, "");
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MeetingSession;
    if (!parsed.sessionToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearMeetingSession(meetingId: string) {
  if (!canUseStorage()) return;
  const key = prefix + meetingId.replace(/\D/g, "");
  sessionStorage.removeItem(key);
}

export function updateMeetingSession(meetingId: string, patch: Partial<MeetingSession>) {
  const current = getMeetingSession(meetingId);
  if (!current) return;
  setMeetingSession(meetingId, { ...current, ...patch });
}
