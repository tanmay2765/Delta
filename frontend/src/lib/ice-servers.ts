import { API_URL } from "./api";

export type IceServerConfig = RTCIceServer;

export type IceServerResponse = {
  ice_servers: IceServerConfig[];
  turn_configured: boolean;
  sources: string[];
  turn_error?: string | null;
};

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

let cached: IceServerResponse | null = null;
let cacheExpiry = 0;

function parseResponse(payload: unknown): IceServerResponse {
  if (payload && typeof payload === "object" && "ice_servers" in payload) {
    const body = payload as IceServerResponse;
    const ice_servers = Array.isArray(body.ice_servers) ? body.ice_servers : [];
    const withEnv = [...ice_servers, ...envTurnServers()];
    return {
      ice_servers: withEnv.length ? withEnv : stunOnlyFallback(),
      turn_configured: Boolean(body.turn_configured) || hasTurnConfigured(withEnv),
      sources: body.sources ?? [],
      turn_error: body.turn_error ?? null,
    };
  }

  if (Array.isArray(payload)) {
    const ice_servers = [...payload, ...envTurnServers()];
    return {
      ice_servers,
      turn_configured: hasTurnConfigured(ice_servers),
      sources: ["legacy-array"],
      turn_error: hasTurnConfigured(ice_servers)
        ? null
        : "Backend returned legacy STUN-only array — configure TURN on backend",
    };
  }

  const fallback = [...stunOnlyFallback(), ...envTurnServers()];
  return {
    ice_servers: fallback,
    turn_configured: hasTurnConfigured(fallback),
    sources: ["fallback"],
    turn_error: "Could not parse ICE server response",
  };
}

export function hasTurnConfigured(servers: IceServerConfig[]): boolean {
  return servers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return (
      urls.some((url) => String(url).startsWith("turn")) &&
      Boolean(server.username) &&
      Boolean(server.credential)
    );
  });
}

export function isProductionDeploy(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "https:" &&
    (window.location.hostname.includes("onrender.com") ||
      window.location.hostname.endsWith(".vercel.app"))
  );
}

export async function fetchIceServers(): Promise<IceServerResponse> {
  const now = Date.now();
  if (cached && now < cacheExpiry) {
    return cached;
  }

  try {
    const response = await fetch(`${API_URL}/api/turn/ice-servers`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const parsed = parseResponse(await response.json());
    cached = parsed;
    cacheExpiry = now + 55 * 60 * 1000;
    return parsed;
  } catch (error) {
    const fallback = parseResponse(null);
    fallback.turn_error = `Failed to fetch ICE servers: ${error instanceof Error ? error.message : "unknown"}`;
    cached = fallback;
    cacheExpiry = now + 60 * 1000;
    return fallback;
  }
}

export function getFallbackIceServers(): IceServerConfig[] {
  return [...stunOnlyFallback(), ...envTurnServers()];
}

export async function fetchTurnStatus(): Promise<{
  turn_configured: boolean;
  turn_error?: string | null;
  sources?: string[];
}> {
  try {
    const response = await fetch(`${API_URL}/api/turn/status`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as {
      turn_configured: boolean;
      turn_error?: string | null;
      sources?: string[];
    };
  } catch {
    return { turn_configured: false, turn_error: "Could not reach /api/turn/status" };
  }
}
