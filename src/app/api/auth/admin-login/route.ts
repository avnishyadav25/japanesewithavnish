import { NextResponse } from "next/server";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export async function POST(req: Request) {
  try {
    if (!ADMIN_EMAILS.length || !ADMIN_PASSWORD) {
      console.error("Admin login configuration missing", {
        hasAdminEmails: ADMIN_EMAILS.length > 0,
        hasAdminPassword: Boolean(ADMIN_PASSWORD),
      });
      return NextResponse.json({ error: "Admin login is not configured" }, { status: 503 });
    }

    const { email, password } = await req.json();
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(normalizedEmail)) {
      console.warn("Admin login rejected: email is not allowed", { email: normalizedEmail });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (password !== ADMIN_PASSWORD) {
      console.warn("Admin login rejected: invalid password", { email: normalizedEmail });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken(normalizedEmail);
    const redirectUrl = "/admin";

    const res = NextResponse.json({ success: true, redirect: redirectUrl });
    res.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("Admin login:", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
