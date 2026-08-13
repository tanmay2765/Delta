export interface Participant {
  id: string;
  name: string;
  isHost?: boolean;
  micOn: boolean;
  cameraOn: boolean;
  speaking?: boolean;
  sharingScreen?: boolean;
  status?: "joined" | "awaiting";
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  host: string;
  startTime: string; // ISO
  durationMinutes: number;
  participants: Participant[];
}

export interface MeetingHistoryItem {
  id: string;
  title: string;
  host: string;
  date: string; // ISO
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
}

export interface ScheduleMeetingInput {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  participantIds: string[];
  waitingRoom: boolean;
}

export interface CreatedMeeting {
  meetingId: string;
  inviteLink: string;
  title: string;
  startTime?: string;
}
