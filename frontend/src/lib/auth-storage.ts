const TOKEN_KEY = "delta_auth_token";
const USER_KEY = "delta_user";

function canUseStorage() {
  return typeof window !== "undefined";
}

export interface StoredUser {
  id: number;
  email: string;
  full_name: string;
  phone?: string | null;
  timezone?: string;
  language?: string;
  date_format?: string;
  time_format?: string;
}

export function getToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: StoredUser) {
  if (!canUseStorage()) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredUser(patch: Partial<StoredUser>) {
  const current = getStoredUser();
  if (!current) return;
  setAuth(getToken() ?? "", { ...current, ...patch });
}

export function getStoredUser(): StoredUser | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function clearAuth() {
  if (!canUseStorage()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function displayNameFromUser(user: StoredUser | null, fallback = "Guest") {
  return user?.full_name?.trim() || fallback;
}
