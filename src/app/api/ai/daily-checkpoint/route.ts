import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const DAILY_CHECKPOINT_USER_PROMPT_FALLBACK = `This Japanese learner: level {{level}}, streak {{streak}} days, earned {{pointsToday}} points today, {{dueCount}} reviews due. Write one or two short, encouraging sentences summarizing their day (e.g. "You kept your streak. Good day to do a few reviews."). Keep it brief and motivating. Reply with only that text, no quotes or labels.`;

function fillDailyCheckpointTemplate(template: string, vars: { level: string; streak: number; pointsToday: number; dueCount: number }): string {
  return template
    .replace(/\{\{level\}\}/g, vars.level || "not set")
    .replace(/\{\{streak\}\}/g, String(vars.streak))
    .replace(/\{\{pointsToday\}\}/g, String(vars.pointsToday))
    .replace(/\{\{dueCount\}\}/g, String(vars.dueCount));
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return NextResponse.json({ summary: "" });

    let level = "";
    let streak = 0;
    let pointsToday = 0;
    let dueCount = 0;
    if (sql) {
      try {
        const profileRows = (await sql`
          SELECT recommended_level, current_streak
          FROM profiles
          WHERE email = ${session.email}
          LIMIT 1
        `) as unknown as { recommended_level: string | null; current_streak?: number }[];

        const pointsRows = (await sql`
          SELECT COALESCE(SUM(points), 0)::int AS total
          FROM reward_events
          WHERE user_email = ${session.email}
            AND created_at::date = CURRENT_DATE
        `) as unknown as { total: number }[];

        const dueRows = (await sql`
          SELECT COUNT(*)::int AS c
          FROM review_schedule
          WHERE user_email = ${session.email}
            AND next_review_at <= NOW()
        `) as unknown as { c: number }[];

        level = profileRows?.[0]?.recommended_level ?? "";
        streak = profileRows?.[0]?.current_streak ?? 0;
        pointsToday = (pointsRows?.[0] as { total?: number })?.total ?? 0;
        dueCount = dueRows?.[0]?.c ?? 0;
      } catch {
        // use defaults
      }
    }

    const template = (await getPromptContent("daily_checkpoint")) ?? DAILY_CHECKPOINT_USER_PROMPT_FALLBACK;
    const userPrompt = fillDailyCheckpointTemplate(template, { level, streak, pointsToday, dueCount });

    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a supportive Japanese learning coach. Reply with only 1-2 short, encouraging sentences." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 120,
      }),
    });

    if (!res.ok) {
      console.warn("AI daily-checkpoint:", await res.text());
      return NextResponse.json({ summary: "" });
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const summary = (data.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ summary });
  } catch (e) {
    console.error("Daily-checkpoint AI:", e);
    return NextResponse.json({ summary: "" });
  }
}
