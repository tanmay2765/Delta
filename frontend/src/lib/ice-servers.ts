import { API_URL } from "./api";

export type IceServerConfig = RTCIceServer;

/** STUN-only fallback — TURN must come from backend env or build-time VITE_* vars. */
function stunOnlyFallback(): IceServerConfig[] {
  const stunUrl = import.meta.env["VITE_STUN_URL"] as string | undefined;
  if (stunUrl) {
    return [{ urls: stunUrl }];
  }
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
}

/** Optional build-time TURN (Render/Vite injects at build — no secrets in source). */
function envTurnServers(): IceServerConfig[] {
  const turnUrl = import.meta.env["VITE_TURN_URL"] as string | undefined;
  const username = import.meta.env["VITE_TURN_USERNAME"] as string | undefined;
  const credential = import.meta.env["VITE_TURN_CREDENTIAL"] as string | undefined;
  if (!turnUrl || !username || !credential) {
    return [];
  }
  const urls = turnUrl.includes(",")
    ? turnUrl.split(",").map((value) => value.trim())
    : turnUrl;
  return [{ urls, username, credential }];
}

let cachedServers: IceServerConfig[] | null = null;
let cacheExpiry = 0;

function normalizeIceServers(payload: unknown): IceServerConfig[] {
  if (!Array.isArray(payload)) {
    return [...stunOnlyFallback(), ...envTurnServers()];
  }
  const servers = payload.filter(
    (entry): entry is IceServerConfig =>
      Boolean(entry) && typeof entry === "object" && "urls" in entry,
  );
  if (!servers.length) {
    return [...stunOnlyFallback(), ...envTurnServers()];
  }
  return servers;
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
      throw new Error("Failed to load ICE servers");
    }
    const servers = normalizeIceServers(await response.json());
    cachedServers = servers;
    cacheExpiry = now + 55 * 60 * 1000;
    return servers;
  } catch {
    const fallback = [...stunOnlyFallback(), ...envTurnServers()];
    cachedServers = fallback;
    cacheExpiry = now + 5 * 60 * 1000;
    return fallback;
  }
}

export function getFallbackIceServers(): IceServerConfig[] {
  return [...stunOnlyFallback(), ...envTurnServers()];
}

export function hasTurnConfigured(servers: IceServerConfig[]): boolean {
  return servers.some(
    (server) =>
      (Array.isArray(server.urls)
        ? server.urls.some((url) => url.startsWith("turn"))
        : String(server.urls).startsWith("turn")) && server.username && server.credential,
  );
}
