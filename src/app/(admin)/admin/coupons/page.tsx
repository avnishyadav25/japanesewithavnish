"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "amount";
  discount_value: number;
  product_ids: string[];
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  const fetchCoupons = () => {
    setLoading(true);
    fetch("/api/admin/coupons")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCoupons(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleDelete = async (id: string, codeStr: string) => {
    if (!confirm(`Are you sure you want to delete coupon "${codeStr}"?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setCoupons(coupons.filter((c) => c.id !== id));
      } else {
        alert("Failed to delete coupon");
      }
    } catch {
      alert("Error processing deletion");
    }
  };

  const resetForm = () => {
    setCode("");
    setDiscountType("percent");
    setDiscountValue("");
    setMaxUses("");
    setExpiresAt("");
    setEditingCoupon(null);
  };

  const handleAddClick = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEditClick = (c: Coupon) => {
    setEditingCoupon(c);
    setCode(c.code);
    setDiscountType(c.discount_type);
    setDiscountValue(String(c.discount_value));
    setMaxUses(c.max_uses != null ? String(c.max_uses) : "");
    setExpiresAt(c.expires_at ? c.expires_at.slice(0, 10) : "");
    setError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/admin/coupons", {
        method: editingCoupon ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingCoupon ? { id: editingCoupon.id } : {}),
          code,
          discount_type: discountType,
          discount_value: Number(discountValue),
          max_uses: maxUses ? Number(maxUses) : null,
          expires_at: expiresAt || null,
          ...(editingCoupon ? {} : { product_ids: [] }), // global coupon by default on create
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${editingCoupon ? "update" : "create"} coupon`);

      setIsModalOpen(false);
      resetForm();
      fetchCoupons();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Coupons Management"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Coupons" }]}
      />

      <div className="flex justify-between items-center mb-4">
        <p className="text-secondary text-sm">
          Create and manage promotional discount codes for checkouts.
        </p>
        <button
          type="button"
          onClick={handleAddClick}
          className="btn-primary"
        >
          + Add New Coupon
        </button>
      </div>

      {loading ? (
        <p className="text-secondary py-8 text-center">Loading coupons...</p>
      ) : coupons.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Code", "Type", "Value", "Uses", "Expires", "Actions"]}>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-3 px-2 font-bold font-mono text-charcoal">{c.code}</td>
                <td className="py-3 px-2 text-secondary uppercase text-xs">{c.discount_type}</td>
                <td className="py-3 px-2 font-medium">
                  {c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                </td>
                <td className="py-3 px-2 text-secondary text-sm">
                  {c.used_count} / {c.max_uses ?? "∞"}
                </td>
                <td className="py-3 px-2 text-secondary text-xs">
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}
                </td>
                <td className="py-3 px-2 space-x-3">
                  <button
                    type="button"
                    onClick={() => handleEditClick(c)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id, c.code)}
                    className="text-xs font-bold text-[#D0021B] hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No discount coupons created yet." />
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[var(--divider)] shadow-lg space-y-6">
            <div>
              <h3 className="font-heading font-black text-xl text-charcoal">
                {editingCoupon ? "Edit Coupon" : "Add New Coupon"}
              </h3>
              <p className="text-secondary text-xs mt-1">Configure your discount code options.</p>
            </div>

            {error && (
              <div className="p-3 bg-[#FFF7F7] border border-[#D0021B]/10 rounded-xl text-xs text-[#D0021B]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-charcoal mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JAPAN25"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="amount">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Value</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder={discountType === "percent" ? "20" : "150"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Max Uses (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-charcoal mb-1">Expires (Optional)</label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-xl text-sm focus:outline-none focus:border-primary text-charcoal"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-[var(--divider)] rounded-xl text-sm font-semibold text-charcoal hover:bg-[var(--base)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-[#D0021B] hover:bg-[#D0021B]/95 text-white transition disabled:opacity-50"
                >
                  {submitting ? (editingCoupon ? "Saving..." : "Creating...") : editingCoupon ? "Save Changes" : "Save Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
