/**
 * Generates narration scripts for scopes too large to finish inside a web request.
 *
 * WHY THIS EXISTS. `/api/admin/video/projects/[id]/generate` refuses anything over
 * MAX_BATCHES_PER_REQUEST with a 413, because Netlify's real function ceiling is ~30 s and a
 * whole JLPT level plans 2,820 narration slots across 71 DeepSeek calls. Chunking made that scope
 * *correct* — no single response could ever have carried it — but not survivable in a request.
 *
 * A runner has no such ceiling, so the cap is simply lifted here. Same generateStoryboard, same
 * skeleton, same prompts; the only difference is where it runs and how long it may take.
 *
 * DELIBERATELY SEQUENTIAL. One project, one language, one after another. generateStoryboard
 * already runs its own batches three at a time internally, which is the concurrency that matters;
 * stacking projects on top of that would multiply DeepSeek load for no wall-clock gain worth
 * having, and would make a partial failure much harder to reason about.
 *
 *   npm run video:script -- --project=<uuid>          one project, every language it declares
 *   npm run video:script -- --project=<uuid> --lang=en
 *   npm run video:script -- --pending --max=3         drain projects stuck in generating_script
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function main() {
  const projectId = arg("project");
  const onlyLang = arg("lang");
  const pending = process.argv.includes("--pending");
  const max = Number(arg("max") ?? 5);

  if (!projectId && !pending) throw new Error("Pass --project=<uuid>, or --pending to drain the queue");

  const { sql } = await import("../src/lib/db");
  if (!sql) throw new Error("DATABASE_URL is not set");
  const db = sql;

  const { getProject, insertStoryboardVersion, logEvent, resolveApprovalMode, setProjectStatus } = await import(
    "../src/lib/video/projects"
  );
  const { resolveScope } = await import("../src/lib/video/scopeResolver");
  const { resolvePacing } = await import("../src/lib/video/pacing");
  const { generateStoryboard, outroSiteUrl } = await import("../src/lib/video/storyboard");
  const { recordGenerationRun } = await import("../src/lib/video/audit");

  let ids: string[];
  if (projectId) {
    ids = [projectId];
  } else {
    // Projects stranded mid-generation. `generating_script` is written before the DeepSeek call
    // and only overwritten on success, so a project that timed out in the browser sits here
    // forever — exactly the case this worker exists to rescue.
    const rows = (await db`
      SELECT id FROM video_projects
      WHERE status = 'generating_script'
      ORDER BY updated_at ASC
      LIMIT ${max}
    `) as { id: string }[];
    ids = rows.map((r) => r.id);
    console.log(`[video-script] ${ids.length} project(s) stuck in generating_script`);
  }

  let ok = 0;
  let failed = 0;

  for (const id of ids) {
    const project = await getProject(id);
    if (!project) {
      console.log(`  ! ${id} — no such project`);
      failed += 1;
      continue;
    }

    const langs = onlyLang ? [onlyLang] : project.narrationLangs;
    console.log(`\n[${project.title}] ${langs.length} language(s)`);

    try {
      await setProjectStatus(id, "generating_script");
      const snapshot = await resolveScope(project.scopeKind, project.scopeRef);
      console.log(`  scope resolved — ${snapshot.items.length} item(s)`);

      let approvalMode: string = "script_gate";

      for (const lang of langs) {
        const startedAt = Date.now();
        const pacing = resolvePacing(project.pacing, snapshot.items[0]?.kind);

        // No batch cap: that limit belongs to the request path, not here.
        const generated = await generateStoryboard(snapshot, {
          projectId: id,
          narrationLang: lang as never,
          themeKey: project.themeKey,
          pacing,
          voices: project.voices,
          tone: project.tone,
          bgm: project.bgmTrackId ? { trackId: project.bgmTrackId, gainDb: -18, duckDb: -12 } : undefined,
          includeBroll: project.includeBroll,
          branding: project.branding,
          siteName: "JapaneseWithAvnish",
          siteUrl: outroSiteUrl(),
        });

        approvalMode = await resolveApprovalMode({
          scopeKind: project.scopeKind,
          contentType: project.scopeRef.contentType ?? snapshot.items[0]?.kind ?? "*",
          format: project.formats[0] ?? "*",
          publishTargetKind: "*",
        });
        const approvalStatus = approvalMode === "auto" ? "approved" : "pending_review";

        const storyboard = await insertStoryboardVersion({
          projectId: id,
          narrationLang: lang as never,
          source: "ai_generated",
          doc: generated.storyboard,
          contentSnapshot: snapshot,
          approvalStatus,
          llmModel: generated.model,
          promptKey: generated.promptKey,
          promptTokens: generated.usage.promptTokens,
          completionTokens: generated.usage.completionTokens,
          estimatedCostUsd: generated.estimatedCostUsd,
          createdBy: "github-actions",
        });

        await recordGenerationRun({
          projectId: id,
          storyboardId: storyboard.id,
          kind: "full_script",
          narrationLang: lang,
          model: generated.model,
          promptKey: generated.promptKey,
          systemPrompt: generated.request.systemPrompt,
          userMessage: generated.request.userMessage,
          rawResponse: generated.rawResponse,
          slots: generated.request.slots,
          pacing,
          estimatedSeconds: generated.request.estimatedSeconds,
          promptTokens: generated.usage.promptTokens,
          completionTokens: generated.usage.completionTokens,
          estimatedCostUsd: generated.estimatedCostUsd,
          status: "ok",
          durationMs: generated.durationMs,
          requestedBy: "github-actions",
        });

        const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
        console.log(
          `  ${lang}: ${generated.storyboard.scenes.length} scenes, ${generated.callCount} call(s), ` +
            `$${generated.estimatedCostUsd.toFixed(4)}, ${secs}s` +
            (generated.missingSlots.length > 0 ? ` — ${generated.missingSlots.length} slot(s) came back empty` : "")
        );
      }

      await setProjectStatus(id, approvalMode === "auto" ? "script_ready" : "script_pending_review");
      await logEvent({ projectId: id, actor: "github-actions", eventType: "script_generated_ci", payload: { langs } });
      ok += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ! failed: ${message}`);
      // The message lands on the project so the admin shows it without any new UI.
      await setProjectStatus(id, "failed", message);
      failed += 1;
    }
  }

  console.log(`\n[video-script] ${ok} generated, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
