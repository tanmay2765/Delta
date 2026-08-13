export interface Participant {
  id: string;
  name: string;
  isHost?: boolean;
  micOn: boolean;
  cameraOn: boolean;
  micAllowed: boolean;
  cameraAllowed: boolean;
  speaking?: boolean;
  sharingScreen?: boolean;
  status?: "joined" | "awaiting";
  isSelf?: boolean;
}

export type JoinPolicy = "open" | "approval_required";
export type MeetingStatus = "active" | "scheduled" | "ended";

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  host: string;
  startTime: string;
  startedAt?: string;
  durationMinutes: number;
  inviteCode: string;
  joinPolicy: JoinPolicy;
  status: MeetingStatus;
  participants: Participant[];
}

export interface MeetingHistoryItem {
  id: string;
  title: string;
  host: string;
  date: string;
  durationLabel: string;
  participantCount: number;
}

export interface ActivityPoint {
  day: string;
  minutes: number;
}

export interface CreateInstantMeetingInput {
  title: string;
  host: string;
  description?: string;
  cameraOn: boolean;
  micOn: boolean;
  joinPolicy: JoinPolicy;
}

export interface ScheduleMeetingInput {
  title: string;
  description?: string;
  host: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  joinPolicy: JoinPolicy;
}

export interface CreatedMeeting {
  meetingId: string;
  inviteLink: string;
  title: string;
  startTime?: string;
  inviteCode?: string;
}

export interface JoinMeetingResult {
  meetingId: string;
  status: "joined" | "awaiting_approval";
  participantId?: number;
  sessionToken?: string;
  isHost?: boolean;
  micAllowed?: boolean;
  cameraAllowed?: boolean;
  micOn?: boolean;
  cameraOn?: boolean;
  joinRequestId?: number;
}

export interface JoinRequest {
  id: number;
  displayName: string;
  status: string;
  createdAt: string;
}

export interface MeetingInviteResult {
  email: string;
  inviteLink: string;
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  phone?: string | null;
  timezone?: string;
  language?: string;
  date_format?: string;
  time_format?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}
