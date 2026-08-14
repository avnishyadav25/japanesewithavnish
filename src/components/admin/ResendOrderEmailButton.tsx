"use client";

import { useState, useMemo } from "react";

const LOCK_MINUTES = 15;

function getLockState(lastSentAt: string | null): { locked: boolean; label: string } {
  if (!lastSentAt) return { locked: false, label: "" };
  const sent = new Date(lastSentAt).getTime();
  const until = sent + LOCK_MINUTES * 60 * 1000;
  const now = Date.now();
  if (now >= until) return { locked: false, label: "" };
  const mins = Math.ceil((until - now) / 60000);
  const sentMins = Math.floor((now - sent) / 60000);
  return {
    locked: true,
    label: sentMins < 1 ? "Sent just now" : `Sent ${sentMins} min ago · Resend in ${mins} min`,
  };
}

export function ResendOrderEmailButton({
  orderId,
  lastConfirmationEmailAt = null,
}: {
  orderId: string;
  lastConfirmationEmailAt?: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [serverLockedUntil, setServerLockedUntil] = useState<number | null>(null);

  const lockState = useMemo(() => {
    if (serverLockedUntil && Date.now() < serverLockedUntil) {
      const mins = Math.ceil((serverLockedUntil - Date.now()) / 60000);
      return { locked: true, label: `Resend available in ${mins} min` };
    }
    return getLockState(lastConfirmationEmailAt ?? null);
  }, [lastConfirmationEmailAt, serverLockedUntil]);

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/resend-email`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("sent");
        setServerLockedUntil(null);
      } else if (res.status === 429 && data.retryAfterMinutes) {
        setServerLockedUntil(Date.now() + data.retryAfterMinutes * 60 * 1000);
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <span className="text-xs text-green-600">Sent</span>;
  }

  if (lockState.locked) {
    return (
      <span className="text-xs text-secondary" title="Resend is locked for 15 min after last send">
        {lockState.label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "loading"}
      className="text-xs text-primary hover:underline disabled:opacity-50"
    >
      {status === "loading" ? "Sending…" : "Resend access email"}
    </button>
  );
}
