/**
 * Turns one scope into N per-item scopes, for `grouping = 'video_per_item'`.
 *
 * WHAT WAS WRONG. The grouping existed, `plannedVideoCount()` reported `items.length` for it, the
 * wizard printed "10 separate videos" — and `createProject()` wrote one row whatever you picked.
 * Choosing it produced a single video covering all ten items, indistinguishable from
 * `single_video` except in the promise.
 *
 * WHY N PROJECTS AND NOT N STORYBOARDS. `video_storyboards` is UNIQUE on
 * (project_id, narration_lang, version), so ten per-item scripts cannot live under one project.
 * Every downstream path — render jobs, approval, `video_content_links`, social briefs — is also
 * built around one current render per project per format. A project per item fits all of that
 * without touching any of it.
 *
 * NOT EVERY ITEM IS ADDRESSABLE. A child scope has to point at something the resolver can find on
 * its own. Post-backed items carry `postId` and become `content_item`; curriculum lessons carry
 * `data.lessonId` and become `curriculum_lesson`. Anything with neither cannot be split, and
 * `splitSnapshot` says so rather than silently dropping it — a batch that quietly produces eight
 * videos from ten items is worse than one that refuses.
 */
import type { ContentItem, ContentSnapshot, ScopeKind, ScopeRef } from "./types";

/**
 * Above this, splitting is refused.
 *
 * Renders are serialised (`concurrency: video-render` in .github/workflows/video-render.yml) and
 * run at roughly 1.4x realtime — measured: 457 s to render 335 s of video. Twenty 60-second
 * Shorts across two formats is already the better part of an hour of CI. A mis-set 200-item batch
 * would occupy the runner for a day and cost real Actions minutes, so it is refused at creation
 * rather than discovered in the queue.
 */
export const MAX_SPLIT_ITEMS = 20;

/** Above this, the wizard warns and shows the projected render time, but still allows it. */
export const SPLIT_WARN_ITEMS = 10;

export interface SplitChild {
  scopeKind: ScopeKind;
  scopeRef: ScopeRef;
  title: string;
}

/** Why an item could not be given its own project. Surfaced verbatim to the admin. */
export interface SplitProblem {
  title: string;
  reason: string;
}

export interface SplitResult {
  children: SplitChild[];
  problems: SplitProblem[];
}

function childFor(item: ContentItem): SplitChild | null {
  if (item.postId) {
    return {
      scopeKind: "content_item",
      scopeRef: { postId: item.postId },
      title: item.title,
    };
  }

  // Lessons are resolved from curriculum tables and carry no post. `data.lessonId` is set by
  // resolveLessonItems and is the only handle on them.
  const lessonId = item.data?.lessonId;
  if (typeof lessonId === "string" && lessonId) {
    return {
      scopeKind: "curriculum_lesson",
      scopeRef: { lessonId },
      title: item.title,
    };
  }

  return null;
}

/**
 * Splits a resolved snapshot into one child scope per item.
 *
 * Deliberately pure and synchronous: it re-uses the snapshot the caller already resolved rather
 * than re-querying, so the children describe exactly the items you were shown in the picker.
 */
export function splitSnapshot(snapshot: ContentSnapshot): SplitResult {
  const children: SplitChild[] = [];
  const problems: SplitProblem[] = [];

  for (const item of snapshot.items) {
    const child = childFor(item);
    if (child) children.push(child);
    else {
      problems.push({
        title: item.title,
        reason: `${item.kind} items have no page of their own to build a video from`,
      });
    }
  }

  return { children, problems };
}

/**
 * The per-item project title.
 *
 * Prefixed with the parent scope so a batch sorts together in the projects list and you can tell
 * at a glance which run produced a row — the batch id groups them, but the title is what you read.
 */
export function childTitle(parentTitle: string, child: SplitChild): string {
  const clean = child.title.trim() || "Untitled";
  // Avoid "N5 vocabulary · N5 vocabulary" when an item is titled after its own scope.
  if (clean.toLowerCase() === parentTitle.trim().toLowerCase()) return clean;
  return `${parentTitle} · ${clean}`;
}
