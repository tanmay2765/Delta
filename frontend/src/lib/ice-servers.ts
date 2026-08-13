import { API_URL } from "./api";

export type IceServerConfig = RTCIceServer;

const FALLBACK_ICE_SERVERS: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.relay.metered.ca:80" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
      "turns:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

let cachedServers: IceServerConfig[] | null = null;
let cacheExpiry = 0;

function normalizeIceServers(payload: unknown): IceServerConfig[] {
  if (!Array.isArray(payload)) return FALLBACK_ICE_SERVERS;
  const servers = payload.filter(
    (entry): entry is IceServerConfig =>
      Boolean(entry) && typeof entry === "object" && "urls" in entry,
  );
  return servers.length ? servers : FALLBACK_ICE_SERVERS;
}

export async function fetchIceServers(): Promise<IceServerConfig[]> {
  const now = Date.now();
  if (cachedServers && now < cacheExpiry) {
    return cachedServers;
  }

  try {
    const response = await fetch(`${API_URL}/api/turn/ice-servers`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error("Failed to load TURN servers");
    }
    const servers = normalizeIceServers(await response.json());
    cachedServers = servers;
    cacheExpiry = now + 55 * 60 * 1000;
    return servers;
  } catch {
    cachedServers = FALLBACK_ICE_SERVERS;
    cacheExpiry = now + 5 * 60 * 1000;
    return FALLBACK_ICE_SERVERS;
  }
}

export function getFallbackIceServers(): IceServerConfig[] {
  return FALLBACK_ICE_SERVERS;
}
