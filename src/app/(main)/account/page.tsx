"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Profile = {
  email: string;
  recommended_level: string | null;
  display_name: string | null;
  streak_reminder_email_opt_out?: boolean | null;
  show_on_scoreboard?: boolean | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  address?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  website?: string | null;
  last_login_at?: string | null;
};

const inputClass = "w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none text-sm";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [showOnScoreboard, setShowOnScoreboard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        const p = data.profile;
        if (p) {
          setProfile(p);
          setFirstName(p.first_name ?? "");
          setLastName(p.last_name ?? "");
          setDisplayName(p.display_name ?? "");
          setAvatarUrl(p.avatar_url ?? "");
          setAddress(p.address ?? "");
          setPhone(p.phone ?? "");
          setWebsite(p.website ?? "");
          setLinkedinUrl(p.linkedin_url ?? "");
          setInstagramUrl(p.instagram_url ?? "");
          setFacebookUrl(p.facebook_url ?? "");
          setTwitterUrl(p.twitter_url ?? "");
          setShowOnScoreboard(Boolean(p.show_on_scoreboard));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/profile/upload-avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (data.url) setAvatarUrl(data.url);
    } catch {
      setSaved(false);
      setAvatarUrl((prev) => prev); // trigger re-render; could set error state
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          facebook_url: facebookUrl.trim() || null,
          twitter_url: twitterUrl.trim() || null,
          show_on_scoreboard: showOnScoreboard,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--base)] py-12 px-4">
        <div className="max-w-[600px] mx-auto">
          <p className="text-secondary">Loading…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--base)] py-12 px-4">
        <div className="max-w-[600px] mx-auto">
          <p className="text-secondary mb-4">Sign in to manage your settings.</p>
          <Link href="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--base)] py-12 px-4">
      <div className="max-w-[600px] mx-auto">
        <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">My settings</h1>
        <p className="text-secondary mb-6">
          Manage your profile, contact info, and preferences.
        </p>

        {profile?.last_login_at && (
          <p className="text-secondary text-sm mb-4">
            Last login: {new Date(profile.last_login_at).toLocaleString()}
          </p>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <section className="rounded-bento border border-[var(--divider)] bg-white p-6 space-y-4">
            <h2 className="font-heading font-semibold text-charcoal">Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className={labelClass}>First name</label>
                <input id="first_name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={inputClass} />
              </div>
              <div>
                <label htmlFor="last_name" className={labelClass}>Last name</label>
                <input id="last_name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="display_name" className={labelClass}>Display name</label>
              <input id="display_name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How you appear on the scoreboard (optional)" className={inputClass} />
            </div>
            <div>
              <label htmlFor="avatar_url" className={labelClass}>Profile picture</label>
              <div className="flex flex-wrap items-center gap-3">
                <input id="avatar_url" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://… or upload below" className={`${inputClass} flex-1 min-w-[200px]`} />
                <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleAvatarUpload} />
                <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="px-4 py-2 rounded-bento border-2 border-[var(--divider)] text-charcoal text-sm font-medium hover:border-primary hover:text-primary disabled:opacity-50">
                  {uploadingAvatar ? "Uploading…" : "Upload image"}
                </button>
              </div>
              {avatarUrl && <img src={avatarUrl} alt="" className="mt-2 w-14 h-14 rounded-full object-cover border border-[var(--divider)]" />}
            </div>
          </section>

          <section className="rounded-bento border border-[var(--divider)] bg-white p-6 space-y-4">
            <h2 className="font-heading font-semibold text-charcoal">Contact</h2>
            <div>
              <label htmlFor="address" className={labelClass}>Address</label>
              <input id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className={inputClass} />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>Phone</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={inputClass} />
            </div>
          </section>

          <section className="rounded-bento border border-[var(--divider)] bg-white p-6 space-y-4">
            <h2 className="font-heading font-semibold text-charcoal">Links</h2>
            <div>
              <label htmlFor="website" className={labelClass}>Website</label>
              <input id="website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={inputClass} />
            </div>
            <div>
              <label htmlFor="linkedin_url" className={labelClass}>LinkedIn</label>
              <input id="linkedin_url" type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/…" className={inputClass} />
            </div>
            <div>
              <label htmlFor="instagram_url" className={labelClass}>Instagram</label>
              <input id="instagram_url" type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/…" className={inputClass} />
            </div>
            <div>
              <label htmlFor="facebook_url" className={labelClass}>Facebook</label>
              <input id="facebook_url" type="url" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/…" className={inputClass} />
            </div>
            <div>
              <label htmlFor="twitter_url" className={labelClass}>Twitter / X</label>
              <input id="twitter_url" type="url" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/…" className={inputClass} />
            </div>
          </section>

          <section className="rounded-bento border border-[var(--divider)] bg-white p-6 space-y-4">
            <h2 className="font-heading font-semibold text-charcoal">Preferences</h2>
            <div className="flex items-center gap-3">
              <input id="show_on_scoreboard" type="checkbox" checked={showOnScoreboard} onChange={(e) => setShowOnScoreboard(e.target.checked)} className="w-4 h-4 rounded border-2 border-[var(--divider)] text-primary focus:ring-primary" />
              <label htmlFor="show_on_scoreboard" className="text-sm text-charcoal">Show me on the scoreboard (streaks and points)</label>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-primary text-sm">Saved.</span>}
          </div>
        </form>
        <Link href="/learn/dashboard" className="text-primary font-medium text-sm mt-6 inline-block hover:underline">
          Back to My progress →
        </Link>
      </div>
    </div>
  );
}
