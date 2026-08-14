"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type Banner = {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  image_url: string | null;
  active: boolean;
  start_at: string | null;
  end_at: string | null;
  priority: number;
};

export default function AdminOfferBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [priority, setPriority] = useState("0");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [error, setError] = useState("");

  const fetchBanners = () => {
    setLoading(true);
    fetch("/api/admin/offer-banners")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBanners(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  async function handleToggleActive(banner: Banner) {
    const res = await fetch(`/api/admin/offer-banners/${banner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !banner.active }),
    });
    if (res.ok) fetchBanners();
  }

  async function handleDelete(id: string, titleStr: string) {
    if (!confirm(`Delete banner "${titleStr}"?`)) return;
    const res = await fetch(`/api/admin/offer-banners?id=${id}`, { method: "DELETE" });
    if (res.ok) setBanners(banners.filter((b) => b.id !== id));
    else alert("Failed to delete banner");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/offer-banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          link_url: linkUrl || null,
          image_url: imageUrl || null,
          priority: Number(priority),
          start_at: startAt || null,
          end_at: endAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create banner");

      setIsModalOpen(false);
      setTitle("");
      setMessage("");
      setLinkUrl("");
      setImageUrl("");
      setPriority("0");
      setStartAt("");
      setEndAt("");
      fetchBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Offer Banners"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Offers" }, { label: "Banners" }]}
      />

      <div className="flex justify-between items-center mb-4">
        <p className="text-secondary text-sm">Promotional banners shown across the site, with optional date ranges and priority ordering.</p>
        <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
          + Add Banner
        </button>
      </div>

      {loading ? (
        <p className="text-secondary py-8 text-center">Loading banners...</p>
      ) : banners.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Title", "Message", "Active", "Priority", "Window", "Actions"]}>
            {banners.map((b) => (
              <tr key={b.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-3 px-2 font-bold text-charcoal">{b.title}</td>
                <td className="py-3 px-2 text-secondary text-xs max-w-xs"><span className="line-clamp-2">{b.message}</span></td>
                <td className="py-3 px-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(b)}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.active ? "bg-green-50 text-green-700" : "bg-secondary/15 text-secondary"}`}
                  >
                    {b.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="py-3 px-2 text-secondary text-sm">{b.priority}</td>
                <td className="py-3 px-2 text-secondary text-xs">
                  {b.start_at ? new Date(b.start_at).toLocaleDateString() : "—"} → {b.end_at ? new Date(b.end_at).toLocaleDateString() : "—"}
                </td>
                <td className="py-3 px-2">
                  <button type="button" onClick={() => handleDelete(b.id, b.title)} className="text-xs font-bold text-[#D0021B] hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No offer banners created yet." />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[var(--divider)] shadow-lg space-y-6">
            <div>
              <h3 className="font-heading font-black text-xl text-charcoal">Add Offer Banner</h3>
              <p className="text-secondary text-xs mt-1">Configure a promotional banner.</p>
            </div>

            {error && (
              <div className="p-3 bg-[#FFF7F7] border border-[#D0021B]/10 rounded-xl text-xs text-[#D0021B]">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Title</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Message</label>
                <textarea required rows={2} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Link URL</label>
                  <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Priority</label>
                  <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Image URL</label>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Starts (Optional)</label>
                  <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Ends (Optional)</label>
                  <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-[var(--divider)] rounded-xl text-sm font-semibold text-charcoal hover:bg-[var(--base)] transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-[#D0021B] hover:bg-[#D0021B]/95 text-white transition disabled:opacity-50">
                  {submitting ? "Creating..." : "Save Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
