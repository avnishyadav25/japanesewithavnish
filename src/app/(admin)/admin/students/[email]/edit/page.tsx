"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Profile = {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  is_active?: boolean | null;
  recommended_level?: string | null;
  avatar_url?: string | null;
  address?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  website?: string | null;
};

export default function AdminStudentEditPage() {
  const params = useParams();
  const router = useRouter();
  const emailParam = (params as { email?: string } | null)?.email;
  const email = decodeURIComponent(emailParam || "");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/admin/students/${encodeURIComponent(email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setProfile(d);
        setAvatarUrl(d?.avatar_url ?? "");
        setLoading(false);
      })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, [email]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingAvatar(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/upload-avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (data.url) setAvatarUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setError("");
    const form = e.currentTarget;
    const body = {
      first_name: (form.querySelector("[name=first_name]") as HTMLInputElement)?.value?.trim() || null,
      last_name: (form.querySelector("[name=last_name]") as HTMLInputElement)?.value?.trim() || null,
      display_name: (form.querySelector("[name=display_name]") as HTMLInputElement)?.value?.trim() || null,
      is_active: (form.querySelector("[name=is_active]") as HTMLInputElement)?.checked ?? true,
      recommended_level: (form.querySelector("[name=recommended_level]") as HTMLSelectElement)?.value || null,
      avatar_url: avatarUrl.trim() || null,
      address: (form.querySelector("[name=address]") as HTMLInputElement)?.value?.trim() || null,
      phone: (form.querySelector("[name=phone]") as HTMLInputElement)?.value?.trim() || null,
      linkedin_url: (form.querySelector("[name=linkedin_url]") as HTMLInputElement)?.value?.trim() || null,
      instagram_url: (form.querySelector("[name=instagram_url]") as HTMLInputElement)?.value?.trim() || null,
      facebook_url: (form.querySelector("[name=facebook_url]") as HTMLInputElement)?.value?.trim() || null,
      twitter_url: (form.querySelector("[name=twitter_url]") as HTMLInputElement)?.value?.trim() || null,
      website: (form.querySelector("[name=website]") as HTMLInputElement)?.value?.trim() || null,
    };
    fetch(`/api/admin/students/${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        router.push(`/admin/students/${encodeURIComponent(email)}`);
        router.refresh();
      })
      .catch((err) => { setError(err instanceof Error ? err.message : "Save failed"); setSaving(false); });
  }

  if (loading || !profile) {
    return (
      <div>
        <AdminPageHeader title="Edit student" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Students", href: "/admin/students" }, { label: email }]} />
        <p className="text-secondary">{loading ? "Loading…" : "Not found."}</p>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Edit student"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Students", href: "/admin/students" },
          { label: email, href: `/admin/students/${encodeURIComponent(email)}` },
          { label: "Edit" },
        ]}
      />
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <div className="card p-6 space-y-4">
          <h2 className="font-heading font-semibold text-charcoal">Profile</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-secondary text-sm">First name</span>
              <input name="first_name" type="text" defaultValue={profile.first_name ?? ""} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
            </label>
            <label className="block">
              <span className="text-secondary text-sm">Last name</span>
              <input name="last_name" type="text" defaultValue={profile.last_name ?? ""} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-secondary text-sm">Display name</span>
            <input name="display_name" type="text" defaultValue={profile.display_name ?? ""} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
          </label>
          <label className="flex items-center gap-2">
            <input name="is_active" type="checkbox" defaultChecked={profile.is_active !== false} className="rounded" />
            <span className="text-sm text-charcoal">Active</span>
          </label>
          <label className="block">
            <span className="text-secondary text-sm">Recommended level</span>
            <select name="recommended_level" defaultValue={profile.recommended_level ?? ""} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm">
              <option value="">—</option>
              <option value="N5">N5</option>
              <option value="N4">N4</option>
              <option value="N3">N3</option>
              <option value="N2">N2</option>
              <option value="N1">N1</option>
            </select>
          </label>
          <label className="block">
            <span className="text-secondary text-sm">Profile picture</span>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <input name="avatar_url" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://… or upload" className="flex-1 min-w-[180px] px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
              <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleAvatarUpload} />
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="px-3 py-2 rounded-bento border border-[var(--divider)] text-sm text-charcoal hover:border-primary hover:text-primary disabled:opacity-50">
                {uploadingAvatar ? "Uploading…" : "Upload image"}
              </button>
            </div>
            {avatarUrl && <img src={avatarUrl} alt="" className="mt-2 w-12 h-12 rounded-full object-cover border border-[var(--divider)]" />}
          </label>
        </div>
        <div className="card p-6 space-y-4">
          <h2 className="font-heading font-semibold text-charcoal">Contact & links</h2>
          <label className="block">
            <span className="text-secondary text-sm">Address</span>
            <input name="address" type="text" defaultValue={profile.address ?? ""} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
          </label>
          <label className="block">
            <span className="text-secondary text-sm">Phone</span>
            <input name="phone" type="text" defaultValue={profile.phone ?? ""} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
          </label>
          <label className="block">
            <span className="text-secondary text-sm">Website</span>
            <input name="website" type="url" defaultValue={profile.website ?? ""} placeholder="https://…" className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
          </label>
          <label className="block">
            <span className="text-secondary text-sm">LinkedIn</span>
            <input name="linkedin_url" type="url" defaultValue={profile.linkedin_url ?? ""} placeholder="https://…" className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
          </label>
          <label className="block">
            <span className="text-secondary text-sm">Instagram</span>
            <input name="instagram_url" type="url" defaultValue={profile.instagram_url ?? ""} placeholder="https://…" className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
          </label>
          <label className="block">
            <span className="text-secondary text-sm">Facebook</span>
            <input name="facebook_url" type="url" defaultValue={profile.facebook_url ?? ""} placeholder="https://…" className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
          </label>
          <label className="block">
            <span className="text-secondary text-sm">Twitter</span>
            <input name="twitter_url" type="url" defaultValue={profile.twitter_url ?? ""} placeholder="https://…" className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
          </label>
        </div>
        {error && <p className="text-primary text-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <Link href={`/admin/students/${encodeURIComponent(email)}`} className="px-4 py-2 border border-[var(--divider)] rounded-bento text-sm text-charcoal hover:bg-base">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
