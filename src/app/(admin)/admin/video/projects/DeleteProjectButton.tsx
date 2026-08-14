"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Deletes a project and everything under it.
 *
 * Two-stage on purpose. The plain confirm covers the ordinary case; if the API reports that
 * renders are embedded on live content pages it comes back with a second, specific confirmation
 * naming how many — because "delete this test project" and "take three videos off published
 * lesson pages" deserve different amounts of thought.
 */
export function DeleteProjectButton({
  projectId,
  title,
  renderCount,
  redirectTo,
}: {
  projectId: string;
  title: string;
  renderCount: number;
  /** Where to go afterwards. Needed on the detail page, which would otherwise refresh into a
   * 404 for the project it just deleted. Omit on a list, where a refresh is correct. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(force = false) {
    if (!force) {
      const warning =
        renderCount > 0
          ? `Delete “${title}”? This removes ${renderCount} finished video${renderCount === 1 ? "" : "s"} and their files from storage.`
          : `Delete “${title}”?`;
      if (!window.confirm(warning)) return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/video/projects/${projectId}${force ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.status === 409 && data.requiresForce) {
        if (window.confirm(`${data.error}\n\nDelete anyway?`)) return remove(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not delete");

      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => remove(false)}
        disabled={busy}
        className="text-xs text-secondary hover:text-primary disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <div className="text-xs text-primary mt-1 max-w-[220px]">{error}</div>}
    </>
  );
}
