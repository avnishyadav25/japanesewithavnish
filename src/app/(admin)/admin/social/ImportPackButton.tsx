"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lifts a legacy content pack into the new brief model.
 *
 * Idempotent by design — a second click opens the brief that already exists rather than making
 * a second one, so this is safe to press when you cannot remember whether you already did.
 */
export function ImportPackButton({ packId }: { packId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/social/packs/${packId}/import`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      router.push(`/admin/social/briefs/${json.briefId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        title="Copies this pack's copy into the new per-platform engine, where limits are enforced and posting is tracked"
        className="text-primary hover:underline disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import"}
      </button>
      {error && <span className="ml-2 text-xs text-primary">{error}</span>}
    </>
  );
}
