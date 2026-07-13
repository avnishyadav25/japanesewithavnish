"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type Section = {
  id: string;
  title: string;
  short_description: string;
  body: string | null;
  icon: string | null;
  link_href: string | null;
  link_label: string | null;
  sort_order: number;
  published: boolean;
};

const emptyForm = {
  title: "",
  short_description: "",
  body: "",
  icon: "",
  link_href: "",
  link_label: "",
  sort_order: "0",
};

export default function AdminGuidePage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const fetchSections = () => {
    setLoading(true);
    fetch("/api/admin/guide-sections")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSections(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSections();
  }, []);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setIsModalOpen(true);
  }

  function openEditModal(s: Section) {
    setEditingId(s.id);
    setForm({
      title: s.title,
      short_description: s.short_description,
      body: s.body ?? "",
      icon: s.icon ?? "",
      link_href: s.link_href ?? "",
      link_label: s.link_label ?? "",
      sort_order: String(s.sort_order),
    });
    setError("");
    setIsModalOpen(true);
  }

  async function handleTogglePublished(s: Section) {
    const res = await fetch(`/api/admin/guide-sections/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !s.published }),
    });
    if (res.ok) fetchSections();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete guide section "${title}"?`)) return;
    const res = await fetch(`/api/admin/guide-sections/${id}`, { method: "DELETE" });
    if (res.ok) setSections(sections.filter((s) => s.id !== id));
    else alert("Failed to delete guide section");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        short_description: form.short_description,
        body: form.body || null,
        icon: form.icon || null,
        link_href: form.link_href || null,
        link_label: form.link_label || null,
        sort_order: Number(form.sort_order) || 0,
      };
      const res = editingId
        ? await fetch(`/api/admin/guide-sections/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/guide-sections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save guide section");

      setIsModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Site Guide"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Learning Content" }, { label: "Site Guide" }]}
      />

      <div className="flex justify-between items-center mb-4">
        <p className="text-secondary text-sm">
          Sections shown on the public <code className="bg-[var(--divider)] px-1 rounded">/guide</code> page, explaining curriculum, blog, kanji, vocabulary, Nihongo Navi, and other site features to students.
        </p>
        <button type="button" onClick={openAddModal} className="btn-primary shrink-0">
          + Add Section
        </button>
      </div>

      {loading ? (
        <p className="text-secondary py-8 text-center">Loading guide sections...</p>
      ) : sections.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Icon", "Title", "Description", "Link", "Published", "Order", "Actions"]}>
            {sections.map((s) => (
              <tr key={s.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-3 px-2 text-xl">{s.icon || "—"}</td>
                <td className="py-3 px-2 font-bold text-charcoal">{s.title}</td>
                <td className="py-3 px-2 text-secondary text-xs max-w-xs"><span className="line-clamp-2">{s.short_description}</span></td>
                <td className="py-3 px-2 text-secondary text-xs">{s.link_href ? (s.link_label || s.link_href) : "—"}</td>
                <td className="py-3 px-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePublished(s)}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.published ? "bg-green-50 text-green-700" : "bg-secondary/15 text-secondary"}`}
                  >
                    {s.published ? "Published" : "Draft"}
                  </button>
                </td>
                <td className="py-3 px-2 text-secondary text-sm">{s.sort_order}</td>
                <td className="py-3 px-2 flex gap-2">
                  <button type="button" onClick={() => openEditModal(s)} className="text-xs font-bold text-primary hover:underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(s.id, s.title)} className="text-xs font-bold text-[#D0021B] hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No guide sections created yet." />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[var(--divider)] shadow-lg space-y-6 my-8">
            <div>
              <h3 className="font-heading font-black text-xl text-charcoal">{editingId ? "Edit Guide Section" : "Add Guide Section"}</h3>
              <p className="text-secondary text-xs mt-1">Explain a feature of the site to students (e.g. Curriculum, Blog, Kanji, Vocabulary, Nihongo Navi).</p>
            </div>

            {error && (
              <div className="p-3 bg-[#FFF7F7] border border-[#D0021B]/10 rounded-xl text-xs text-[#D0021B]">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Icon</label>
                  <input type="text" placeholder="📘" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full px-3 py-2 border border-[var(--divider)] rounded-xl text-sm text-center focus:outline-none focus:border-primary text-charcoal" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Title</label>
                  <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Short Description</label>
                <textarea required rows={2} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Full Guide Text (optional, shown expanded on the page)</label>
                <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Link URL</label>
                  <input type="text" placeholder="/learn/curriculum" value={form.link_href} onChange={(e) => setForm({ ...form, link_href: e.target.value })} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Link Label</label>
                  <input type="text" placeholder="Go to Curriculum" value={form.link_label} onChange={(e) => setForm({ ...form, link_label: e.target.value })} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="w-24 px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-[var(--divider)] rounded-xl text-sm font-semibold text-charcoal hover:bg-[var(--base)] transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-[#D0021B] hover:bg-[#D0021B]/95 text-white transition disabled:opacity-50">
                  {submitting ? "Saving..." : "Save Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
