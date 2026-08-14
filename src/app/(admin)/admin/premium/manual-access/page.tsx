"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

export default function AdminManualAccessPage() {
  const [email, setEmail] = useState("");
  const [accessType, setAccessType] = useState("monthly");
  const [customDays, setCustomDays] = useState("30");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setMsg("");

    try {
      let isLifetime = false;
      let premiumUntil: string | null = null;

      if (accessType === "lifetime") {
        isLifetime = true;
      } else {
        const days = Number(customDays) || 30;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);
        premiumUntil = targetDate.toISOString();
      }

      const res = await fetch(`/api/admin/students/${encodeURIComponent(email.trim())}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_lifetime: isLifetime,
          premium_until: premiumUntil,
          role: "premium_student", // update role to premium_student as well
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to grant access");

      setMsg(`✅ Successfully granted manual ${accessType} access to ${email}!`);
      setEmail("");
      setReason("");
    } catch (err: any) {
      setMsg(`❌ Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 page-enter max-w-xl">
      <AdminPageHeader
        title="Manual Premium Access Grant"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Premium Access" }, { label: "Manual Access" }]}
      />

      <p className="text-secondary text-sm">
        Manually award premium pass access to specific student accounts (free tiers, trials, monthly, or lifetime keys).
      </p>

      <AdminCard>
        <form onSubmit={handleSubmit} className="space-y-4">
          {msg && (
            <div className="p-3.5 bg-white border border-[var(--divider)] rounded-xl text-xs font-semibold">
              {msg}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Student Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Access Pass Mode</label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs bg-white text-charcoal"
            >
              <option value="trial">7-Day Trial Pass</option>
              <option value="monthly">30-Day Premium Pass</option>
              <option value="yearly">365-Day Premium Pass</option>
              <option value="custom">Custom Days Pass</option>
              <option value="lifetime">Unlimited Lifetime Pass ♾️</option>
            </select>
          </div>

          {accessType === "custom" && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Custom Validity Days</label>
              <input
                type="number"
                min="1"
                required
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="e.g. 90"
                className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Reason for Grant</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Support compensation, marketing campaign winner, employee access..."
              className="w-full h-20 p-3 border border-[var(--divider)] rounded-xl text-xs focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full btn-primary h-11 rounded-xl text-xs font-bold font-heading"
          >
            {submitting ? "Processing Grant..." : "Grant Premium Access ★"}
          </button>
        </form>
      </AdminCard>
    </div>
  );
}
export const dynamic = "force-dynamic";
