import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!sql) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await sql`SELECT * FROM quiz_questions WHERE id = ${id} LIMIT 1`;
  const data = rows[0];
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const correctIdx = typeof body.correct_index === "number" ? body.correct_index : (typeof body.correct_answer === "string" && /^[A-Z]$/.test(body.correct_answer) ? body.correct_answer.charCodeAt(0) - 65 : 0);
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  await sql`
    UPDATE quiz_questions SET
      question_text = ${body.question_text},
      options = ${body.options || []},
      correct_index = ${correctIdx},
      jlpt_level = ${body.jlpt_level || null},
      sort_order = ${body.sort_order ?? 0}
    WHERE id = ${id}
  `;
  const rows = await sql`SELECT id FROM quiz_questions WHERE id = ${id} LIMIT 1`;
  return NextResponse.json(rows[0] as { id: string });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!sql) return NextResponse.json({ error: "Failed" }, { status: 503 });
  await sql`DELETE FROM quiz_questions WHERE id = ${id}`;
  return NextResponse.json({ deleted: true });
}
