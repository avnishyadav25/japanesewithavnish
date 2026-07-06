"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type Badge = {
  id: string;
  name: string;
  slug: string;
  description: string;
  emoji: string | null;
  color: string;
  icon_type: string;
  icon_url: string | null;
  category: "level" | "streak" | "skill" | "milestone" | "special";
  trigger_type: "automatic" | "manual_special";
  is_active: boolean;
};

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#D0021B");
  const [category, setCategory] = useState<Badge["category"]>("special");
  const [triggerType, setTriggerType] = useState<Badge["trigger_type"]>("manual_special");
  const [isActive, setIsActive] = useState(true);

  const fetchBadges = () => {
    setLoading(true);
    fetch("/api/admin/badges")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBadges(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  const handleEditClick = (b: Badge) => {
    setEditingBadge(b);
    setName(b.name);
    setSlug(b.slug);
    setDescription(b.description);
    setEmoji(b.emoji || "");
    setColor(b.color);
    setCategory(b.category);
    setTriggerType(b.trigger_type);
    setIsActive(b.is_active);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setEditingBadge(null);
    setName("");
    setSlug("");
    setDescription("");
    setEmoji("");
    setColor("#D0021B");
    setCategory("special");
    setTriggerType("manual_special");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, badgeName: string) => {
    if (!confirm(`Are you sure you want to delete badge "${badgeName}"?`)) return;
    try {
      const res = await fetch(`/api/admin/badges?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setBadges(badges.filter((b) => b.id !== id));
      } else {
        alert("Failed to delete badge");
      }
    } catch {
      alert("Error processing deletion");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      name,
      slug,
      description,
      emoji: emoji || null,
      color,
      category,
      trigger_type: triggerType,
      is_active: isActive,
    };

    try {
      let res;
      if (editingBadge) {
        res = await fetch("/api/admin/badges", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingBadge.id, ...payload }),
        });
      } else {
        res = await fetch("/api/admin/badges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save badge");

      setIsModalOpen(false);
      fetchBadges();
    } catch (err: any) {
      setError(err.message || "Failed to process request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 page-enter">
      <AdminPageHeader
        title="Badges & Achievements"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Gamification" }, { label: "Badges" }]}
      />

      <div className="flex justify-between items-center mb-4">
        <p className="text-secondary text-sm">
          Create and manage system achievement badges awarded to students automatically or manually.
        </p>
        <button
          type="button"
          onClick={handleCreateClick}
          className="btn-primary shrink-0"
        >
          + Add New Badge
        </button>
      </div>

      {loading ? (
        <p className="text-secondary py-8 text-center text-xs">Loading badges...</p>
      ) : badges.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Badge", "Slug", "Description", "Category", "Trigger", "Status", "Actions"]}>
            {badges.map((b) => (
              <tr key={b.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--divider)]" style={{ borderColor: b.color + "30", backgroundColor: b.color + "08" }}>
                      {b.emoji || "🏆"}
                    </span>
                    <span className="font-bold text-charcoal text-xs">{b.name}</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-mono text-secondary text-xs">{b.slug}</td>
                <td className="py-3 px-2 text-secondary text-xs max-w-xs truncate">{b.description}</td>
                <td className="py-3 px-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize">{b.category}</span>
                </td>
                <td className="py-3 px-2">
                  <span className="text-[10px] font-medium text-charcoal uppercase">{b.trigger_type.replace(/_/g, " ")}</span>
                </td>
                <td className="py-3 px-2">
                  {b.is_active ? (
                    <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">Disabled</span>
                  )}
                </td>
                <td className="py-3 px-2 text-xs font-semibold">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditClick(b)}
                      className="text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id, b.name)}
                      className="text-primary hover:underline text-[#D0021B]"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No badges created yet." />
      )}

      {/* Modal dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[var(--divider)] shadow-lg space-y-6">
            <div>
              <h3 className="font-heading font-black text-lg text-charcoal">{editingBadge ? "Edit Badge" : "Add New Badge"}</h3>
              <p className="text-secondary text-xs mt-1">Configure your achievement badge settings.</p>
            </div>

            {error && (
              <div className="p-3 bg-[#FFF7F7] border border-[#D0021B]/10 rounded-xl text-xs text-[#D0021B]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Badge Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hiragana Master"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-xs focus:outline-none focus:border-primary text-charcoal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Slug ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. hiragana-master"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-xs focus:outline-none focus:border-primary text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Emoji Icon</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 🎓"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-xs focus:outline-none focus:border-primary text-charcoal text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain how users earn this badge..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border border-[var(--divider)] rounded-xl text-xs focus:outline-none focus:border-primary text-charcoal resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-xs focus:outline-none text-charcoal bg-white"
                  >
                    <option value="level">JLPT Level</option>
                    <option value="streak">Streak Days</option>
                    <option value="skill">Special Skill</option>
                    <option value="milestone">Milestone</option>
                    <option value="special">Special</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Trigger Mode</label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as any)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-xs focus:outline-none text-charcoal bg-white"
                  >
                    <option value="automatic">Automatic (System)</option>
                    <option value="manual_special">Manual Award (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Color Highlight</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-9 border border-[var(--divider)] rounded-xl cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="isActiveBadge"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary rounded"
                  />
                  <label htmlFor="isActiveBadge" className="text-xs text-charcoal font-semibold">Active Badge</label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-[var(--divider)] rounded-xl text-xs font-semibold text-charcoal hover:bg-[var(--base)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-[#D0021B] hover:bg-[#D0021B]/95 text-white transition disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Save Badge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
