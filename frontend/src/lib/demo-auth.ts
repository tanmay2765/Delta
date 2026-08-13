import { api } from "@/lib/api";
import { getToken, setAuth } from "@/lib/auth-storage";

export const DEMO_EMAIL = "demo@delta.com";
export const DEMO_PASSWORD = "demo123456";

export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (getToken()) return true;

  try {
    const response = await api.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    setAuth(response.access_token, response.user);
    return true;
  } catch {
    return false;
  }
}
