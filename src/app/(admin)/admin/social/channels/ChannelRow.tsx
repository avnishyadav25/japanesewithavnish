"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChannelRow({
  channelId,
  platform,
  autoPostEnabled,
  hasCredentials,
  canConnect,
}: {
  channelId: string;
  platform: string;
  autoPostEnabled: boolean;
  hasCredentials: boolean;
  canConnect: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(autoPostEnabled);

  async function toggle() {
    // Reddit is off on purpose, not because something is missing. Confirm rather than silently
    // allow — the failure mode is a shadow ban, which is quiet and hard to undo.
    if (!enabled && platform === "reddit") {
      const ok = window.confirm(
        "Reddit removes and shadow-bans accounts that post promotional content on a schedule, and this is a personal account. Turn auto-posting on anyway?"
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/social/channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPostEnabled: !enabled }),
      });
      if (res.ok) {
        setEnabled(!enabled);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 shrink-0">
      {canConnect && (
        <a
          href={`/api/admin/social/channels/${channelId}/oauth/start`}
          className="text-sm px-3 py-1.5 rounded-button border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition"
        >
          {hasCredentials ? "Reconnect" : "Connect"}
        </a>
      )}
      <label className="inline-flex items-center gap-2 text-sm text-secondary cursor-pointer">
        <input type="checkbox" checked={enabled} disabled={busy || !hasCredentials} onChange={toggle} />
        auto-post
      </label>
    </div>
  );
}
