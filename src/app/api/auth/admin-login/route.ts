import { NextResponse } from "next/server";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken(normalizedEmail);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectUrl = `${siteUrl.replace(/\/$/, "")}/admin`;

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
