import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function isAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());
    return adminEmails.includes(user.email);
}

export async function POST(req: NextRequest) {
    if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { question_text, options, correct_answer, jlpt_level, sort_order, explanation } = body;

    if (!question_text || !correct_answer) {
        return NextResponse.json({ error: "question_text and correct_answer are required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("quiz_questions")
        .insert({
            question_text,
            options: options || [],
            correct_answer,
            jlpt_level: jlpt_level || null,
            sort_order: sort_order ?? 0,
            explanation: explanation || null,
        })
        .select("id")
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function GET() {
    if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
