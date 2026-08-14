"use client";

import { useState } from "react";

export function SitemapPingButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [result, setResult] = useState<{
    sitemap?: string;
    pinged?: { provider: string; ok: boolean; status?: number }[];
    skipped?: boolean;
    message?: string;
  } | null>(null);

  async function handlePing() {
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/sitemap-ping", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setResult(data);
        return;
      }
      setResult(data);
      setStatus("ok");
    } catch {
      setStatus("error");
      setResult({});
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handlePing}
        disabled={status === "loading"}
        className="text-left px-3 py-2 rounded-bento border border-[var(--divider)] hover:bg-[var(--base)] text-sm font-medium disabled:opacity-50"
      >
        {status === "loading" ? "Pinging…" : "Ping sitemap"}
      </button>
      {result && status === "ok" && (
        <div className="text-xs text-secondary space-y-0.5">
          <p>{result.sitemap}</p>
          {result.skipped ? (
            <p className="text-amber-600">{result.message}</p>
          ) : (
            result.pinged?.map((p) => (
              <p key={p.provider}>
                {p.provider}: {p.ok ? "✓" : "✗"}
                {p.status != null && ` (${p.status})`}
              </p>
            ))
          )}
        </div>
      )}
      {status === "error" && (
        <p className="text-xs text-red-600">
          {(result as { error?: string })?.error ?? "Request failed"}
        </p>
      )}
    </div>
  );
}
