/**
 * End-to-end scope verification: resolve -> skeleton -> chunk plan, for every scope kind and
 * every content type, without spending a cent on DeepSeek.
 *
 * Run: npm run video:verify-scopes
 *
 * Stops short of the actual generation call on purpose — buildGenerationRequest produces exactly
 * what generateStoryboard would send, so this exercises resolution, skeleton building, pacing and
 * batching while a full level scope would otherwise cost real money on every run.
 */
import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { resolveScope, plannedVideoCount } = await import("../src/lib/video/scopeResolver");
  const { buildGenerationRequest, planGenerationBatches, MAX_BATCHES_PER_REQUEST } = await import("../src/lib/video/storyboard");
  const { resolvePacing, estimateStoryboardDuration, formatDuration } = await import("../src/lib/video/pacing");
  const { expandTopic, matchTopicItems } = await import("../src/lib/video/topics");
  const { sql } = await import("../src/lib/db");
  const { FORMAT_SPECS } = await import("../src/lib/video/types");
  const { buildTimeline } = await import("../src/lib/video/timeline");
  if (!sql) throw new Error("no db");

  const SLOTS_PER_CALL = 40;
  let failures = 0;

  function pass(name: string, detail: string) {
    console.log(`  ok    ${name.padEnd(34)} ${detail}`);
  }
  function fail(name: string, detail: string) {
    failures += 1;
    console.log(`  FAIL  ${name.padEnd(34)} ${detail}`);
  }

  /** Mirrors fillSlots' scene-boundary batching so the plan can be asserted without an API call. */
  function planBatches(scenes: { narration: { id: string }[] }[], blanks: { id: string }[]): number {
    const sceneOf = new Map<string, number>();
    scenes.forEach((s, i) => s.narration.forEach((n) => sceneOf.set(n.id, i)));
    const groups = new Map<number, number>();
    for (const b of blanks) {
      const k = sceneOf.get(b.id) ?? -1;
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    let batches = 0;
    let cur = 0;
    for (const n of Array.from(groups.values())) {
      if (cur > 0 && cur + n > SLOTS_PER_CALL) {
        batches += 1;
        cur = 0;
      }
      cur += n;
    }
    if (cur > 0) batches += 1;
    return batches;
  }

  async function check(name: string, scopeKind: string, ref: Record<string, unknown>) {
    try {
      const snapshot = await resolveScope(scopeKind as never, ref as never);
      const pacing = resolvePacing(null, snapshot.items[0]?.kind);
      const { request, skeleton } = await buildGenerationRequest(snapshot, {
        projectId: "00000000-0000-0000-0000-000000000000",
        narrationLang: "en",
        themeKey: "washi-light",
        pacing,
        siteName: "JapaneseWithAvnish",
        siteUrl: "https://japanesewithavnish.com",
      } as never);

      const est = estimateStoryboardDuration(skeleton.scenes, pacing);
      // Uses the real planner, not a copy: a local reimplementation could agree with itself and
      // still disagree with what generation actually does.
      const batches = planGenerationBatches(skeleton.scenes, skeleton.blanks).length;
      const localPlan = planBatches(skeleton.scenes, skeleton.blanks);
      if (localPlan !== batches) fail(name, `planner disagreement: ${localPlan} vs ${batches}`);
      const overCap = batches > MAX_BATCHES_PER_REQUEST;

      // Every blank must map to a real scene segment, or chunking would silently orphan it.
      const ids = new Set(skeleton.scenes.flatMap((s) => s.narration.map((n) => n.id)));
      const orphans = skeleton.blanks.filter((b) => !ids.has(b.id));

      // Scene ids must be unique — a collision makes two scenes share a Sequence key.
      const sceneIds = skeleton.scenes.map((s) => s.id);
      const dupes = sceneIds.filter((id, i) => sceneIds.indexOf(id) !== i);

      // The timeline must resolve at every format.
      const formats: string[] = [];
      for (const f of ["vertical", "landscape", "square"] as const) {
        const tl = buildTimeline({ ...({} as never), scenes: skeleton.scenes, captions: { enabled: true, burnIn: true, style: "bold-center" } } as never, { format: f });
        formats.push(`${f}:${tl.totalFrames}f/${FORMAT_SPECS[f].fps}`);
      }

      const detail =
        `${snapshot.items.length} items, ${skeleton.scenes.length} scenes, ${skeleton.blanks.length} slots, ` +
        `${batches} call${batches === 1 ? "" : "s"}${overCap ? " REFUSED" : ""}, ${formatDuration(est.totalSeconds)}, ` +
        `${plannedVideoCount(snapshot, "single_video")} video`;

      if (orphans.length > 0) fail(name, `${orphans.length} orphan slots: ${orphans.slice(0, 3).map((o) => o.id).join(", ")}`);
      else if (dupes.length > 0) fail(name, `duplicate scene ids: ${dupes.slice(0, 3).join(", ")}`);
      else if (skeleton.blanks.length === 0) fail(name, "no narration slots — the video would be silent");
      else if (request.maxTokens > 8000) fail(name, `maxTokens ${request.maxTokens} exceeds the cap`);
      else pass(name, `${detail} · ${formats.join(" ")}`);
    } catch (err) {
      fail(name, err instanceof Error ? err.message : String(err));
    }
  }

  console.log("\n=== content_batch, every content type ===");
  const types = (await sql`
    SELECT content_type, COUNT(*)::int AS n FROM posts WHERE status = 'published'
    GROUP BY content_type ORDER BY n DESC
  `) as { content_type: string; n: number }[];
  for (const t of types) {
    await check(`${t.content_type} (${t.n} published)`, "content_batch", { contentType: t.content_type, limit: 5 });
  }

  console.log("\n=== content_batch, every JLPT level (vocabulary) ===");
  for (const level of ["N5", "N4", "N3", "N2", "N1"]) {
    await check(`vocabulary ${level}`, "content_batch", { contentType: "vocabulary", jlptLevel: level, limit: 5 });
  }

  console.log("\n=== curriculum scopes ===");
  const lesson = (await sql`SELECT id, title FROM curriculum_lessons ORDER BY sort_order LIMIT 1`) as { id: string; title: string }[];
  const submodule = (await sql`SELECT id FROM curriculum_submodules ORDER BY sort_order LIMIT 1`) as { id: string }[];
  const module = (await sql`SELECT id FROM curriculum_modules ORDER BY sort_order LIMIT 1`) as { id: string }[];
  const level = (await sql`SELECT id, code FROM curriculum_levels ORDER BY sort_order LIMIT 1`) as { id: string; code: string }[];
  if (lesson[0]) await check(`lesson "${lesson[0].title.slice(0, 20)}"`, "curriculum_lesson", { lessonId: lesson[0].id });
  if (submodule[0]) await check("submodule", "curriculum_submodule", { submoduleId: submodule[0].id });
  if (module[0]) await check("module", "curriculum_module", { moduleId: module[0].id });
  if (level[0]) await check(`level ${level[0].code}`, "curriculum_level", { levelId: level[0].id });

  console.log("\n=== content_item ===");
  const one = (await sql`SELECT id FROM posts WHERE status='published' AND content_type='vocabulary' LIMIT 1`) as { id: string }[];
  if (one[0]) await check("single vocabulary item", "content_item", { postId: one[0].id });

  console.log("\n=== topic scopes ===");
  for (const topic of ["numbers", "family", "colours", "animals", "greetings", "body parts"]) {
    const terms = await expandTopic(topic);
    const hits = await matchTopicItems(terms, { limit: 8 });
    if (hits.length === 0) {
      fail(`topic "${topic}"`, "no library matches (would need LLM-written words)");
      continue;
    }
    await check(`topic "${topic}"`, "topic", { topic, postIds: hits.map((h) => h.postId!) });
  }

  console.log(`\n${failures === 0 ? "All scopes resolved and batched cleanly." : `${failures} failure(s).`}\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
