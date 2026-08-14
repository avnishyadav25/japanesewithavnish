import { cookies } from "next/headers";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/session";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export interface AdminSession {
  email: string;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(getSessionCookieName())?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;
  if (!ADMIN_EMAILS.includes(payload.email.toLowerCase())) return null;

  return { email: payload.email };
}
