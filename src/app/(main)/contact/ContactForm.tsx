"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-6">
        <p className="font-heading font-semibold text-charcoal mb-2">Message sent</p>
        <p className="text-secondary text-sm mb-4">
          Thanks for reaching out. We&apos;ll get back to you soon.
        </p>
        <p className="text-secondary text-sm" lang="ja">
          送信しました。ご連絡ありがとうございます。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-charcoal mb-1">
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-charcoal mb-1">
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-charcoal mb-1">
          Message
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={5000}
          rows={5}
          className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          placeholder="Your message..."
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full sm:w-auto px-6 py-3 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
