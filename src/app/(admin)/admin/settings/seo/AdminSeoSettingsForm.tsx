"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

type Settings = Record<string, string>;

export function AdminSeoSettingsForm({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");

  function update(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AdminCard>
        <h3 className="font-heading font-bold text-charcoal text-sm mb-4">SEO Defaults</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-charcoal mb-1">Default meta title</label>
            <input
              type="text"
              value={settings.seo_default_title ?? ""}
              onChange={(e) => update("seo_default_title", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm text-charcoal focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-charcoal mb-1">Default meta description</label>
            <textarea
              value={settings.seo_default_description ?? ""}
              onChange={(e) => update("seo_default_description", e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm text-charcoal focus:outline-none focus:border-primary resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-charcoal mb-1">Default OG image URL</label>
            <input
              type="url"
              value={settings.seo_default_og_image ?? ""}
              onChange={(e) => update("seo_default_og_image", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm text-charcoal focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </AdminCard>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={status === "loading"}>
          {status === "loading" ? "Saving..." : "Save"}
        </button>
        {status === "saved" && <span className="text-emerald-600 text-sm">Saved.</span>}
        {status === "error" && <span className="text-red-600 text-sm">Failed to save.</span>}
      </div>
    </form>
  );
}
