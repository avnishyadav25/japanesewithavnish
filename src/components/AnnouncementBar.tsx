"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const DISMISS_KEY = "announcement-dismissed-until";
const DISMISS_DAYS = 7;

interface AnnouncementConfig {
  enabled?: boolean;
  message?: string;
  href?: string;
}

export function AnnouncementBar() {
  const [config, setConfig] = useState<AnnouncementConfig | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const until = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
    if (until && Date.now() < parseInt(until, 10)) {
      setDismissed(true);
      return;
    }

    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => {
        const bar = data?.announcement_bar as AnnouncementConfig | undefined;
        if (bar?.enabled && bar?.message) {
          setConfig(bar);
          setDismissed(false);
        }
      })
      .catch(() => {});
  }, []);

  function handleDismiss() {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setDismissed(true);
  }

  if (!config || dismissed) return null;

  return (
    <div
      className="h-10 flex items-center justify-center px-4 gap-2 border-b border-[#EEEEEE]"
      style={{ background: "#FFF7F7", color: "#1A1A1A", fontSize: "14px" }}
    >
      {config.href ? (
        <Link
          href={config.href}
          className="font-semibold hover:underline"
          style={{ color: "#D0021B", fontSize: "14px" }}
        >
          {config.message}
        </Link>
      ) : (
        <span>{config.message}</span>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-2 p-1 hover:opacity-70 transition-opacity text-base"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
