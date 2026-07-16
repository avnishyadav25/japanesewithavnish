import { registerAgent } from "./index";
import type { AgentResult, ContentSnapshot, DraftFinding } from "../types";

type GrammarDrillItem = {
  id: string;
  sentence_ja: string;
  correct_answers: unknown;
  distractors: unknown;
  hint: string | null;
};

type ListeningScenario = { id: string; title: string; audio_url: string; transcript: string | null };
type ListeningQuestion = { scenario_id: string; question_text: string; options: unknown; correct_index: number };

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Deterministic-only in Phase 1 (content_review_agents.is_deterministic=true) — no LLM
 * call. Scoped to grammar/listening only (content_review_agents.scope), the only two
 * content types with a practice/quiz table today; a no-op for the other 5. */
async function run(snapshot: ContentSnapshot): Promise<AgentResult> {
  const findings: DraftFinding[] = [];

  if (snapshot.entityType === "grammar") {
    const items = (snapshot.practice as GrammarDrillItem[] | undefined) ?? [];

    // Gap-fix phase 24: zero practice items is itself a real gap, distinct from "existing
    // items have a quality problem" (checked below) — previously this loop silently produced
    // zero findings when items.length===0, the same as a genuinely perfect grammar entry.
    if (items.length === 0) {
      findings.push({
        severity: "major",
        category: "practice_quality",
        fieldName: "grammar_drill_items",
        title: "No practice drill items at all",
        description: "This grammar entry has zero grammar_drill_items — there is no practice exercise attached to it.",
        whyItMatters: "A learner studying this grammar point has no way to actually practice using it, only to read about it.",
      });
    }

    for (const item of items) {
      if (!item.sentence_ja.includes("__")) {
        findings.push({
          severity: "critical",
          category: "practice_quality",
          fieldName: "sentence_ja",
          originalValue: item.sentence_ja,
          title: "Grammar drill sentence has no gap",
          description: `Drill item ${item.id} has no "__" gap placeholder in its sentence — the practice UI has nothing to render as a blank.`,
          whyItMatters: "A learner opening this drill sees a broken or unanswerable question instead of practice, undermining confidence in the exercise.",
        });
      }
      const correct = asStringArray(item.correct_answers).map((s) => s.trim().toLowerCase());
      const distractors = asStringArray(item.distractors).map((s) => s.trim().toLowerCase());
      const overlap = correct.filter((c) => distractors.includes(c));
      if (overlap.length > 0) {
        findings.push({
          severity: "critical",
          category: "practice_quality",
          fieldName: "distractors",
          originalValue: { correct_answers: item.correct_answers, distractors: item.distractors },
          title: "Distractor also marked as a correct answer",
          description: `Drill item ${item.id}: "${overlap.join(", ")}" appears in both correct_answers and distractors — the question can't be scored reliably.`,
          whyItMatters: "A learner could pick the flagged distractor and be marked wrong for a genuinely correct answer, teaching them not to trust their own correct reasoning.",
        });
      }
    }
  }

  if (snapshot.entityType === "listening") {
    const practice = (snapshot.practice as { scenarios: ListeningScenario[]; questions: ListeningQuestion[] } | undefined) ?? {
      scenarios: [],
      questions: [],
    };
    for (const q of practice.questions) {
      const options = Array.isArray(q.options) ? q.options : [];
      if (q.correct_index < 0 || q.correct_index >= options.length) {
        findings.push({
          severity: "critical",
          category: "practice_quality",
          fieldName: "correct_index",
          originalValue: { correct_index: q.correct_index, optionCount: options.length },
          title: "Listening question's correct_index is out of bounds",
          description: `Question "${q.question_text}" has correct_index=${q.correct_index} but only ${options.length} option(s) — this question cannot be scored.`,
          whyItMatters: "A learner answering this question can never be marked correct, no matter what they choose — the exercise is unusable as-is.",
        });
      }
    }

    // Mirrors getCompleteListeningPostIds() (src/lib/learn/listeningPublishGate.ts) exactly:
    // a listening post is only usable once at least one scenario has real audio + a
    // transcript + 3+ questions. Checked here (not contentTypeSpecialist.ts) because the
    // scenario-level data is only available via the practice snapshot, not the sidecar row.
    const questionCountByScenario = new Map<string, number>();
    for (const q of practice.questions) {
      questionCountByScenario.set(q.scenario_id, (questionCountByScenario.get(q.scenario_id) ?? 0) + 1);
    }
    const hasCompleteScenario = practice.scenarios.some(
      (s) =>
        s.audio_url?.trim() &&
        s.transcript?.trim() &&
        (questionCountByScenario.get(s.id) ?? 0) >= 3
    );
    if (!hasCompleteScenario) {
      findings.push({
        severity: "critical",
        category: "practice_quality",
        fieldName: "audio_url",
        title: "No complete listening scenario",
        description:
          practice.scenarios.length === 0
            ? "This listening post has no scenarios at all."
            : "None of this listening post's scenarios have audio + a transcript + at least 3 questions — getCompleteListeningPostIds() would exclude this from directory listings as an incomplete activity.",
        whyItMatters: "A learner can't actually practice listening comprehension here — this content is invisible in directory listings and, if reached directly, has nothing usable to offer.",
      });
    }
  }

  return { agentKey: "practice_answer", findings };
}

registerAgent("practice_answer", run);
