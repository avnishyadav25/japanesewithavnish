"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type TrialCode = {
  id: string;
  code: string;
  trial_days: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
};

export default function AdminTrialCodesPage() {
  const [codes, setCodes] = useState<TrialCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [trialDays, setTrialDays] = useState("7");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  const fetchCodes = () => {
    setLoading(true);
    fetch("/api/admin/trial-codes")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCodes(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  async function handleDelete(id: string, codeStr: string) {
    if (!confirm(`Delete trial code "${codeStr}"?`)) return;
    const res = await fetch(`/api/admin/trial-codes?id=${id}`, { method: "DELETE" });
    if (res.ok) setCodes(codes.filter((c) => c.id !== id));
    else alert("Failed to delete trial code");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/trial-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          trial_days: Number(trialDays),
          max_uses: maxUses || null,
          expires_at: expiresAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create trial code");

      setIsModalOpen(false);
      setCode("");
      setTrialDays("7");
      setMaxUses("");
      setExpiresAt("");
      fetchCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Trial Codes"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Offers" }, { label: "Trial Codes" }]}
      />

      <div className="flex justify-between items-center mb-4">
        <p className="text-secondary text-sm">Codes that grant extended free-trial access, redeemable at signup or checkout.</p>
        <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
          + Add Trial Code
        </button>
      </div>

      {loading ? (
        <p className="text-secondary py-8 text-center">Loading trial codes...</p>
      ) : codes.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Code", "Trial Days", "Uses", "Expires", "Actions"]}>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-3 px-2 font-bold font-mono text-charcoal">{c.code}</td>
                <td className="py-3 px-2 text-secondary text-sm">{c.trial_days} days</td>
                <td className="py-3 px-2 text-secondary text-sm">{c.uses_count} / {c.max_uses ?? "∞"}</td>
                <td className="py-3 px-2 text-secondary text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}</td>
                <td className="py-3 px-2">
                  <button type="button" onClick={() => handleDelete(c.id, c.code)} className="text-xs font-bold text-[#D0021B] hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No trial codes created yet." />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[var(--divider)] shadow-lg space-y-6">
            <div>
              <h3 className="font-heading font-black text-xl text-charcoal">Add Trial Code</h3>
              <p className="text-secondary text-xs mt-1">Configure a trial-extension code.</p>
            </div>

            {error && (
              <div className="p-3 bg-[#FFF7F7] border border-[#D0021B]/10 rounded-xl text-xs text-[#D0021B]">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Code</label>
                <input type="text" required placeholder="e.g. TRIAL30" value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Trial Days</label>
                  <input type="number" required min="1" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Max Uses (Optional)</label>
                  <input type="number" min="1" placeholder="Unlimited" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Expires (Optional)</label>
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-[var(--divider)] rounded-xl text-sm font-semibold text-charcoal hover:bg-[var(--base)] transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-[#D0021B] hover:bg-[#D0021B]/95 text-white transition disabled:opacity-50">
                  {submitting ? "Creating..." : "Save Trial Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
