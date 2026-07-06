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
  price_inr: number;
  price_usd: number;
  is_active: boolean;
  is_popular: boolean;
};

export default function AdminSubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Edit fields
  const [priceInr, setPriceInr] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
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
    setPriceInr(String(p.price_inr));
    setPriceUsd(String(p.price_usd));
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
          price_inr: Number(priceInr),
          price_usd: Number(priceUsd),
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Subscription Plans Management"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Subscription Plans" }]}
      />

      <p className="text-secondary text-sm">
        Configure pricing tiers and visual settings for student subscription checkout passes.
      </p>

      {loading ? (
        <p className="text-secondary py-8 text-center">Loading plans...</p>
      ) : (
        <AdminCard>
          <AdminTable headers={["Plan Name", "Billing", "Price (INR)", "Price (USD)", "Active?", "Popular?", "Actions"]}>
            {plans.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                  <td className="py-3 px-2 font-bold text-charcoal">{p.name}</td>
                  <td className="py-3 px-2 text-secondary text-xs uppercase">{p.billing_type}</td>
                  <td className="py-3 px-2">
                    {isEditing ? (
                      <input
                        type="number"
                        value={priceInr}
                        onChange={(e) => setPriceInr(e.target.value)}
                        className="w-20 px-2 py-1 border border-[var(--divider)] rounded-lg text-sm text-charcoal focus:outline-none"
                      />
                    ) : (
                      `₹${p.price_inr}`
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {isEditing ? (
                      <input
                        type="number"
                        value={priceUsd}
                        step="0.01"
                        onChange={(e) => setPriceUsd(e.target.value)}
                        className="w-20 px-2 py-1 border border-[var(--divider)] rounded-lg text-sm text-charcoal focus:outline-none"
                      />
                    ) : (
                      `$${p.price_usd}`
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
                      <span className="text-green-700 text-xs font-bold bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-secondary text-xs font-bold bg-[var(--base)] px-2 py-0.5 rounded-full">Disabled</span>
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
                      <span className="text-[#D0021B] text-xs font-bold bg-[#FFF7F7] px-2 py-0.5 rounded-full">Popular</span>
                    ) : (
                      <span className="text-secondary text-xs font-bold bg-[var(--base)] px-2 py-0.5 rounded-full">No</span>
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
