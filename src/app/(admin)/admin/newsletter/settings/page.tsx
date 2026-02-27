"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

type NewsletterSettings = {
  fromName: string;
  replyTo: string;
  doubleOptIn: boolean;
  welcomeTemplate: string;
};

export default function AdminNewsletterSettingsPage() {
  const [settings, setSettings] = useState<NewsletterSettings>({
    fromName: "Japanese with Avnish",
    replyTo: "",
    doubleOptIn: false,
    welcomeTemplate: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");

  useEffect(() => {
    // TODO: fetch from site_settings when API exists
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      // TODO: POST to /api/admin/newsletter-settings when implemented
      await new Promise((r) => setTimeout(r, 500));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Newsletter Settings"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Newsletter" }]}
      />
      <form onSubmit={handleSubmit}>
        <AdminCard className="max-w-xl">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">From name</label>
              <input
                type="text"
                value={settings.fromName}
                onChange={(e) => setSettings((s) => ({ ...s, fromName: e.target.value }))}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                placeholder="Japanese with Avnish"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Reply-to email</label>
              <input
                type="email"
                value={settings.replyTo}
                onChange={(e) => setSettings((s) => ({ ...s, replyTo: e.target.value }))}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                placeholder="learn@japanesewithavnish.com"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="doubleOptIn"
                checked={settings.doubleOptIn}
                onChange={(e) => setSettings((s) => ({ ...s, doubleOptIn: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="doubleOptIn" className="text-sm text-charcoal">
                Require confirmation email (double opt-in)
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Welcome email template
              </label>
              <textarea
                value={settings.welcomeTemplate}
                onChange={(e) => setSettings((s) => ({ ...s, welcomeTemplate: e.target.value }))}
                rows={6}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                placeholder="Hi {{name}}, welcome to our newsletter..."
              />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <button type="submit" className="btn-primary" disabled={status === "loading"}>
              {status === "loading" ? "Saving..." : "Save"}
            </button>
            {status === "saved" && (
              <span className="text-emerald-600 text-sm">Saved.</span>
            )}
            {status === "error" && (
              <span className="text-red-600 text-sm">Failed to save.</span>
            )}
          </div>
        </AdminCard>
      </form>
    </div>
  );
}
