import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const NEXT_STEPS_USER_PROMPT_FALLBACK = `This Japanese learner has: JLPT level {{level}}, current streak {{streak}} days, {{dueCount}} reviews due, {{learnedCount}} items learned, {{totalPoints}} total points. Suggest 3 to 5 short, actionable next steps (one per line). Be specific (e.g. "Do 5 reviews", "Try N5 grammar", "Practice with Nihongo Navi"). Reply with only the list, one step per line, no numbering.`;

function fillNextStepsTemplate(template: string, vars: { level: string; streak: number; dueCount: number; learnedCount: number; totalPoints: number }): string {
  return template
    .replace(/\{\{level\}\}/g, vars.level || "not set")
    .replace(/\{\{streak\}\}/g, String(vars.streak))
    .replace(/\{\{dueCount\}\}/g, String(vars.dueCount))
    .replace(/\{\{learnedCount\}\}/g, String(vars.learnedCount))
    .replace(/\{\{totalPoints\}\}/g, String(vars.totalPoints));
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return NextResponse.json({ steps: [] }); // no AI: return empty, dashboard uses rule-based

    let level = "";
    let streak = 0;
    let dueCount = 0;
    let learnedCount = 0;
    let totalPoints = 0;
    if (sql) {
      try {
        const profileRows = (await sql`
          SELECT recommended_level, current_streak
          FROM profiles
          WHERE email = ${session.email}
          LIMIT 1
        `) as unknown as { recommended_level: string | null; current_streak?: number }[];

        const dueRows = (await sql`
          SELECT COUNT(*)::int AS c
          FROM review_schedule
          WHERE user_email = ${session.email}
            AND next_review_at <= NOW()
        `) as unknown as { c: number }[];

        const learnedRows = (await sql`
          SELECT COUNT(*)::int AS c
          FROM user_learning_progress
          WHERE user_email = ${session.email}
            AND status = 'learned'
        `) as unknown as { c: number }[];

        const pointsRows = (await sql`
          SELECT COALESCE(SUM(points), 0)::int AS total
          FROM reward_events
          WHERE user_email = ${session.email}
        `) as unknown as { total: number }[];

        level = profileRows?.[0]?.recommended_level ?? "";
        streak = profileRows?.[0]?.current_streak ?? 0;
        dueCount = dueRows?.[0]?.c ?? 0;
        learnedCount = learnedRows?.[0]?.c ?? 0;
        totalPoints = (pointsRows?.[0] as { total?: number })?.total ?? 0;
      } catch {
        // use defaults
      }
    }

    const template = (await getPromptContent("next_steps")) ?? NEXT_STEPS_USER_PROMPT_FALLBACK;
    const userPrompt = fillNextStepsTemplate(template, { level, streak, dueCount, learnedCount, totalPoints });

    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful Japanese learning coach. Reply only with a short list of actionable next steps, one per line." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 256,
      }),
    });

    if (!res.ok) {
      console.warn("AI next-steps:", await res.text());
      return NextResponse.json({ steps: [] });
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();
    const steps = raw
      .split("\n")
      .map((s) => s.replace(/^[\d\.\-\*]\s*/, "").trim())
      .filter((s) => s.length > 0)
      .slice(0, 6);

    return NextResponse.json({ steps });
  } catch (e) {
    console.error("Next-steps AI:", e);
    return NextResponse.json({ steps: [] });
  }
}
