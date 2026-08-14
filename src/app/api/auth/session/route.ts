import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ email: null }, { status: 401 });
  }
  return NextResponse.json({ email: session.email });
}
