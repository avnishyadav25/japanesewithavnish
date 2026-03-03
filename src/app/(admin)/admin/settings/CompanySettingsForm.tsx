"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { HomepageSettingsForm } from "./HomepageSettingsForm";

function ChatbotContextCard() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <AdminCard>
      <h2 className="font-heading font-bold text-charcoal mb-4">Chatbot (japani-bhai)</h2>
      <p className="text-secondary text-sm mb-4">
        Pull the latest blogs, products, and support info into the chatbot context so japani-bhai can answer visitors accurately.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setMessage(null);
          try {
            const res = await fetch("/api/admin/chatbot-context/pull", { method: "POST" });
            const data = await res.json();
            if (res.ok) setMessage(`Updated. Context length: ${data.length ?? 0} chars.`);
            else setMessage(data.error || "Failed");
          } catch {
            setMessage("Failed");
          } finally {
            setLoading(false);
          }
        }}
        className="btn-primary"
      >
        {loading ? "Updating…" : "Update chatbot context"}
      </button>
      {message && <p className="mt-2 text-sm text-secondary">{message}</p>}
    </AdminCard>
  );
}

type Settings = Record<string, string | unknown>;

export function CompanySettingsForm({
  initial,
  homepageInitial = {},
}: {
  initial: Settings;
  homepageInitial?: Record<string, unknown>;
}) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");

  function update(key: string, value: string | unknown) {
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
    <form onSubmit={handleSubmit} className="space-y-8">
      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Company</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Company name</label>
            <input
              type="text"
              value={String(settings.company_name ?? "")}
              onChange={(e) => update("company_name", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Tagline</label>
            <input
              type="text"
              value={String(settings.company_tagline ?? "")}
              onChange={(e) => update("company_tagline", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Logo URL</label>
            <input
              type="url"
              value={String(settings.logo_url ?? "")}
              onChange={(e) => update("logo_url", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Favicon URL</label>
            <input
              type="url"
              value={String(settings.favicon_url ?? "")}
              onChange={(e) => update("favicon_url", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Contact</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Support email</label>
            <input
              type="email"
              value={String(settings.support_email ?? "")}
              onChange={(e) => update("support_email", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Contact email</label>
            <input
              type="email"
              value={String(settings.contact_email ?? "")}
              onChange={(e) => update("contact_email", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Phone</label>
            <input
              type="tel"
              value={String(settings.phone ?? "")}
              onChange={(e) => update("phone", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Social</h2>
        <div className="space-y-4">
          {["twitter_url", "instagram_url", "youtube_url", "discord_url", "facebook_url", "threads_url", "pinterest_url"].map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium text-charcoal mb-1">
                {key.replace("_url", "").replace(/_/g, " ")}
              </label>
              <input
                type="url"
                value={String(settings[key] ?? "")}
                onChange={(e) => update(key, e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">SEO defaults</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Default meta title</label>
            <input
              type="text"
              value={String(settings.seo_default_title ?? "")}
              onChange={(e) => update("seo_default_title", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Default meta description</label>
            <textarea
              value={String(settings.seo_default_description ?? "")}
              onChange={(e) => update("seo_default_description", e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Default OG image URL</label>
            <input
              type="url"
              value={String(settings.seo_default_og_image ?? "")}
              onChange={(e) => update("seo_default_og_image", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Footer</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Copyright text</label>
            <input
              type="text"
              value={String(settings.footer_copyright ?? "")}
              onChange={(e) => update("footer_copyright", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              placeholder="© 2025 Japanese with Avnish"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Integrations</h2>
        <p className="text-secondary text-sm">
          SMTP (email), Razorpay, Supabase, DeepSeek, Gemini — configured via .env. See GUIDE.md. Resend API is in backlog for future.
        </p>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Homepage</h2>
        <HomepageSettingsForm initial={homepageInitial} onChange={update} />
      </AdminCard>

      <ChatbotContextCard />

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
