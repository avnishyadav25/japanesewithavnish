"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BlogCommentFormProps = {
  slug: string;
  onSuccess?: () => void;
};

export function BlogCommentForm({ slug, onSuccess }: BlogCommentFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function validate(): string | null {
    const n = name.trim();
    const e = email.trim().toLowerCase();
    const c = content.trim();
    if (!n) return "Name is required.";
    if (!e) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "Please enter a valid email.";
    if (!c) return "Comment is required.";
    if (c.length < 10) return "Comment must be at least 10 characters.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setErrorMsg(err);
      setStatus("error");
      return;
    }
    setErrorMsg("");
    setStatus("loading");
    try {
      const res = await fetch(`/api/blog/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          content: content.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to post comment");
        setStatus("error");
        return;
      }
      setStatus("success");
      setName("");
      setEmail("");
      setContent("");
      onSuccess?.();
      router.refresh();
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="comment-name" className="block text-sm font-medium text-charcoal mb-1">
          Name
        </label>
        <input
          id="comment-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
          placeholder="Your name"
          disabled={status === "loading"}
        />
      </div>
      <div>
        <label htmlFor="comment-email" className="block text-sm font-medium text-charcoal mb-1">
          Email
        </label>
        <input
          id="comment-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
          placeholder="your@email.com"
          disabled={status === "loading"}
        />
      </div>
      <div>
        <label htmlFor="comment-content" className="block text-sm font-medium text-charcoal mb-1">
          Comment
        </label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition resize-y"
          placeholder="Share your thoughts..."
          disabled={status === "loading"}
        />
      </div>
      {errorMsg && (
        <p className="text-primary text-sm">{errorMsg}</p>
      )}
      {status === "success" && (
        <p className="text-emerald-600 text-sm">Thanks for your comment! It will appear shortly.</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="btn-primary disabled:opacity-60"
      >
        {status === "loading" ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
