"use client";

import { useState } from "react";

export function SubmitPaymentDetailsForm({ orderId }: { orderId: string }) {
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}/submit-payment-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utrOrReference: utr.trim() || undefined, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="card p-6 bg-green-50 border border-green-200 rounded-bento">
        <p className="font-medium text-charcoal">
          We&apos;ve received your details. You will receive confirmation email within 10–20 minutes after we verify your payment.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4">
      <p className="text-secondary text-sm">
        Alternatively, submit your UTR / transaction reference below.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="UTR / Transaction reference (optional)"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento focus:border-primary focus:outline-none transition"
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento focus:border-primary focus:outline-none transition"
        />
        <button type="submit" className="btn-secondary w-full" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </form>
      {error && <p className="text-primary text-sm">{error}</p>}
    </div>
  );
}
