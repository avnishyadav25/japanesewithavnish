"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type Section = {
  id: string;
  title: string;
  slug: string | null;
  short_description: string;
  body: string | null;
  icon: string | null;
  feature_image_url: string | null;
  link_href: string | null;
  link_label: string | null;
  sort_order: number;
  published: boolean;
};

export default function AdminGuidePage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

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
        <Link href="/admin/guide/new" className="btn-primary shrink-0">
          + Add Section
        </Link>
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
                  <Link href={`/admin/guide/${s.id}/edit`} className="text-xs font-bold text-primary hover:underline">
                    Edit
                  </Link>
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
    </div>
  );
}
