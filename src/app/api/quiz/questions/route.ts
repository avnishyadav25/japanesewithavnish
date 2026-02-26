import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_questions")
    .select("id, question_text, options, correct_index")
    .order("sort_order", { ascending: true })
    .limit(50);

  const questions = (data || []).map((q) => ({
    ...q,
    options: Array.isArray(q.options) ? q.options : (q.options as { text: string }[])?.map((o) => o.text) || [],
  }));

  return NextResponse.json({ questions });
}
