"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";

type Plan = {
  id: string;
  name: string;
  slug: string;
  billing_type: string;
  price_inr: number; // in paise
  price_usd: number; // in cents
  is_active: boolean;
  is_popular: boolean;
};

export default function AdminSubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Edit fields
  const [priceInr, setPriceInr] = useState(""); // user enters rupees (e.g. 99)
  const [priceUsd, setPriceUsd] = useState(""); // user enters dollars (e.g. 2.99)
  const [isActive, setIsActive] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPlans = () => {
    setLoading(true);
    fetch("/api/admin/subscriptions/plans")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPlans(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEditClick = (p: Plan) => {
    setEditingId(p.id);
    setPriceInr(String(p.price_inr / 100));
    setPriceUsd(String(p.price_usd / 100));
    setIsActive(p.is_active);
    setIsPopular(p.is_popular);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/subscriptions/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          price_inr: Math.round(Number(priceInr) * 100),
          price_usd: Math.round(Number(priceUsd) * 100),
          is_active: isActive,
          is_popular: isPopular,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        fetchPlans();
      } else {
        alert("Failed to save changes");
      }
    } catch {
      alert("Error saving updates");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 page-enter">
      <AdminPageHeader
        title="Subscription Plans Management"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Premium Access" }, { label: "Plans" }]}
      />

      <p className="text-secondary text-sm">
        Configure pricing tiers and visual settings for student subscription checkout passes.
      </p>

      {loading ? (
        <p className="text-secondary py-8 text-center text-xs">Loading plans...</p>
      ) : (
        <AdminCard>
          <AdminTable headers={["Plan Name", "Billing", "Price (INR)", "Price (USD)", "Active?", "Popular?", "Actions"]}>
            {plans.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                  <td className="py-3 px-2 font-bold text-charcoal text-xs">{p.name}</td>
                  <td className="py-3 px-2 text-secondary text-[10px] uppercase font-bold">{p.billing_type}</td>
                  <td className="py-3 px-2 text-xs font-semibold">
                    {isEditing ? (
                      <input
                        type="number"
                        value={priceInr}
                        onChange={(e) => setPriceInr(e.target.value)}
                        className="w-20 h-8 px-2 border border-[var(--divider)] rounded-lg text-xs text-charcoal focus:outline-none"
                      />
                    ) : (
                      `₹${(p.price_inr / 100).toFixed(2)}`
                    )}
                  </td>
                  <td className="py-3 px-2 text-xs font-semibold">
                    {isEditing ? (
                      <input
                        type="number"
                        value={priceUsd}
                        step="0.01"
                        onChange={(e) => setPriceUsd(e.target.value)}
                        className="w-20 h-8 px-2 border border-[var(--divider)] rounded-lg text-xs text-charcoal focus:outline-none"
                      />
                    ) : (
                      `$${(p.price_usd / 100).toFixed(2)}`
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary rounded"
                      />
                    ) : p.is_active ? (
                      <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-[10px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">Disabled</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={isPopular}
                        onChange={(e) => setIsPopular(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary rounded"
                      />
                    ) : p.is_popular ? (
                      <span className="text-[10px] font-bold bg-[#FFF7F7] text-primary px-2 py-0.5 rounded-full">Popular</span>
                    ) : (
                      <span className="text-[10px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">No</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(p.id)}
                          disabled={saving}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs font-bold text-secondary hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEditClick(p)}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </AdminCard>
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
