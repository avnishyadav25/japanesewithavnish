import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: Request) {
  try {
    if (!sql) return NextResponse.json({ items: [] });

    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("user_email")?.trim() || null;

    const publicRows = await sql`
      SELECT question, answer, ask_count, user_email, last_asked_at
      FROM tutor_logs
      WHERE user_email IS NULL
      ORDER BY ask_count DESC, last_asked_at DESC
      LIMIT 10
    ` as { question: string; answer: string; ask_count: number; user_email: string | null; last_asked_at: string }[];

    let userRows: typeof publicRows = [];
    if (userEmail) {
      userRows = await sql`
        SELECT question, answer, ask_count, user_email, last_asked_at
        FROM tutor_logs
        WHERE user_email = ${userEmail}
        ORDER BY last_asked_at DESC
        LIMIT 10
      ` as typeof publicRows;
    }

    const items = [...userRows, ...publicRows].slice(0, 12).map((row) => ({
      question: row.question,
      answer_preview: row.answer.slice(0, 240),
      ask_count: row.ask_count,
      user_email: row.user_email,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("Tutor history:", e);
    return NextResponse.json({ items: [] });
  }
}

