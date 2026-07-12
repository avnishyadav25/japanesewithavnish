"use client";

import { useState } from "react";

export function ManageStripeBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not open billing portal");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open billing portal");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={openPortal} disabled={loading} className="btn-primary w-full sm:w-auto">
        {loading ? "Opening Stripe..." : "Manage Stripe billing"}
      </button>
      {error && <p className="text-sm text-primary">{error}</p>}
    </div>
  );
}
