"use client";

import { useState } from "react";

export function OrderResendForm() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/orders/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus("success");
        setMessage("Confirmation email sent. Check your inbox.");
      } else {
        setStatus("error");
        setMessage(data.message || data.error || "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Request failed. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="orderId" className="block text-sm font-medium text-charcoal mb-1">Order ID</label>
        <input
          id="orderId"
          type="text"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          required
          placeholder="e.g. ord_xxxx"
          className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-1">Email (used at checkout)</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
        />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
        {status === "loading" ? "Sending…" : "Resend confirmation email"}
      </button>
      {message && (
        <p className={`text-sm ${status === "success" ? "text-green-700" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
