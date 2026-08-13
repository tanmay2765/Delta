import type { ActivityPoint, Meeting, MeetingHistoryItem, Participant } from "./types";

export const CURRENT_USER = { id: "u-1", name: "Tanmay K.", email: "tanmay@delta.app" };

export const DIRECTORY: Participant[] = [
  { id: "u-1", name: "Tanmay K.", isHost: true, micOn: true, cameraOn: true, status: "joined" },
  { id: "u-2", name: "Aman Sharma", micOn: false, cameraOn: true, status: "joined" },
  { id: "u-3", name: "Rahul Verma", micOn: true, cameraOn: true, speaking: true, status: "joined" },
  { id: "u-4", name: "Sarah Chen", micOn: true, cameraOn: false, status: "joined" },
  { id: "u-5", name: "Mike Ross", micOn: true, cameraOn: true, status: "joined" },
  { id: "u-6", name: "Priya Nair", micOn: true, cameraOn: true, status: "awaiting" },
];

function iso(hours: number, minutes = 0) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export const UPCOMING_MEETINGS: Meeting[] = [
  {
    id: "847293521",
    title: "Team Sync",
    host: "Tanmay K.",
    startTime: iso(9, 30),
    durationMinutes: 30,
    participants: DIRECTORY.slice(0, 4),
  },
  {
    id: "552910834",
    title: "Product Demo",
    host: "Product Team",
    startTime: iso(11, 0),
    durationMinutes: 50,
    participants: DIRECTORY.slice(1, 5),
  },
  {
    id: "118273645",
    title: "Design Review",
    host: "Sarah Chen",
    startTime: iso(13, 0),
    durationMinutes: 60,
    participants: DIRECTORY.slice(0, 3),
  },
  {
    id: "992014557",
    title: "Product Conference",
    host: "Mike Ross",
    startTime: iso(16, 0),
    durationMinutes: 45,
    participants: DIRECTORY.slice(2, 6),
  },
  {
    id: "441029338",
    title: "Weekly Retro",
    host: "Aman Sharma",
    startTime: iso(17, 30),
    durationMinutes: 30,
    participants: DIRECTORY.slice(0, 5),
  },
];

export const RECENT_MEETINGS: MeetingHistoryItem[] = [
  {
    id: "h-1",
    title: "Team Sync",
    host: "Tanmay K.",
    date: new Date(Date.now() - 864e5).toISOString(),
    durationLabel: "3h 04m",
    participantCount: 5,
  },
  {
    id: "h-2",
    title: "Product Demo",
    host: "Sarah Chen",
    date: new Date(Date.now() - 2 * 864e5).toISOString(),
    durationLabel: "1h 29m",
    participantCount: 5,
  },
  {
    id: "h-3",
    title: "Engineering Standup",
    host: "Rahul Verma",
    date: new Date(Date.now() - 3 * 864e5).toISOString(),
    durationLabel: "42m",
    participantCount: 8,
  },
  {
    id: "h-4",
    title: "Roadmap Planning",
    host: "Mike Ross",
    date: new Date(Date.now() - 4 * 864e5).toISOString(),
    durationLabel: "2h 15m",
    participantCount: 6,
  },
];

export const ACTIVITY: ActivityPoint[] = [
  { day: "Sun", minutes: 140 },
  { day: "Mon", minutes: 210 },
  { day: "Tue", minutes: 175 },
  { day: "Wed", minutes: 320 },
  { day: "Thu", minutes: 165 },
  { day: "Fri", minutes: 280 },
  { day: "Sat", minutes: 190 },
];
