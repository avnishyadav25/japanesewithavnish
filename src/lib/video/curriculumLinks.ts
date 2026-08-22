/**
 * Which curriculum places a finished video may be attached to, and whether it belongs there.
 *
 * Two problems this solves, both of which made "Publish to site" useless for curriculum videos.
 *
 * FINDING THE TARGET. The link route derived candidates from `content_snapshot.items[].postId`,
 * and a lesson item has no `postId` — only its children do. So a lesson-scope video offered you the
 * individual word pages it happened to touch, titled with raw UUIDs, and never the lesson itself.
 * The ids were in the snapshot the whole time, in `item.data`, which the route's type did not
 * include and therefore never read.
 *
 * KNOWING IT BELONGS. The roadmap asks for validation "so generated content doesn't end up attached
 * to the wrong JLPT lesson". Cheap to check and expensive to get wrong: a wrongly-attached video is
 * not an error anyone sees, it is an N3 explanation sitting on an N5 lesson page until a student is
 * confused by it.
 */
import type { ContentSnapshot } from "./types";

export type LinkTargetKind = "post" | "lesson" | "module" | "submodule";

export interface LinkTarget {
  kind: LinkTargetKind;
  id: string;
  title: string;
  slug?: string;
  /** For posts: the content kind (vocabulary/kanji/...). For curriculum tiers, undefined. */
  contentKind?: string;
  /** Shown in the picker so a module is distinguishable from the lesson beneath it. */
  context?: string;
}

interface SnapshotItemLike {
  postId?: string;
  slug?: string;
  title?: string;
  kind?: string;
  data?: Record<string, unknown>;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

/**
 * Every place this render could sit, across all four tiers.
 *
 * Curriculum tiers come first: a video generated from a lesson scope belongs on the lesson far more
 * than on the twenty word-pages it happens to mention, and a picker that buries the right answer
 * under twenty wrong ones is barely better than not offering it.
 *
 * Deduplicated by kind+id, because a module-scope video covering fifty lessons resolves the same
 * module id fifty times.
 */
export function curriculumTargets(snapshot: { items?: SnapshotItemLike[]; title?: string } | null): LinkTarget[] {
  const items = snapshot?.items ?? [];
  const seen = new Set<string>();
  const out: LinkTarget[] = [];

  const push = (t: LinkTarget) => {
    const key = `${t.kind}:${t.id}`;
    if (!t.id || seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  for (const item of items) {
    const d = item.data ?? {};
    const lessonId = str(d.lessonId);
    if (lessonId) {
      push({ kind: "lesson", id: lessonId, title: item.title ?? "Lesson", slug: item.slug,
             context: [str(d.moduleTitle), str(d.submoduleTitle)].filter(Boolean).join(" · ") || undefined });
    }
    // Only reachable now that resolveLessonItems carries the ids; it used to keep titles alone.
    const submoduleId = str(d.submoduleId);
    if (submoduleId) push({ kind: "submodule", id: submoduleId, title: str(d.submoduleTitle) ?? "Submodule", context: str(d.moduleTitle) });
    const moduleId = str(d.moduleId);
    if (moduleId) push({ kind: "module", id: moduleId, title: str(d.moduleTitle) ?? "Module" });
  }

  for (const item of items) {
    if (!item.postId) continue;
    push({ kind: "post", id: item.postId, title: item.title ?? item.slug ?? item.postId, slug: item.slug, contentKind: item.kind });
  }

  return out;
}

export interface LinkValidationIssue {
  target: LinkTarget;
  reason: string;
}

/**
 * Refuses a link whose level disagrees with the target's.
 *
 * Deliberately narrow. It compares JLPT levels, which is the failure the roadmap names and the one
 * that is unambiguous — an N3 video on an N5 lesson is wrong regardless of intent. It does NOT try
 * to verify that every word in the video appears in the lesson's declared vocabulary: a lesson
 * legitimately references words it does not own, and refusing those would train you to bypass the
 * check, which is worse than not having one.
 *
 * A target with no level recorded passes. Absence of data is not evidence of a mismatch, and
 * blocking on it would make the check fire loudest where it knows least.
 */
export function validateLinks(params: {
  videoLevel: string | null | undefined;
  targets: LinkTarget[];
  levelByTarget: Map<string, string | null>;
}): LinkValidationIssue[] {
  const video = params.videoLevel?.trim().toUpperCase();
  if (!video) return [];

  const issues: LinkValidationIssue[] = [];
  for (const target of params.targets) {
    if (target.kind === "post") continue;
    const level = params.levelByTarget.get(`${target.kind}:${target.id}`)?.trim().toUpperCase();
    if (level && level !== video) {
      issues.push({
        target,
        reason: `This video is ${video} but "${target.title}" is ${level}. Attaching it would put ${video} content on a ${level} page.`,
      });
    }
  }
  return issues;
}

/** The JLPT level a video claims, from its snapshot. */
export function videoLevelOf(snapshot: Partial<ContentSnapshot> | null): string | null {
  return (snapshot?.jlptLevel as string | undefined) ?? null;
}
