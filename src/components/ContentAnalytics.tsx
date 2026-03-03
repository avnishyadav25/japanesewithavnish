"use client";

import { useEffect, useRef } from "react";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let s = sessionStorage.getItem("analytics_session");
  if (!s) {
    s = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem("analytics_session", s);
  }
  return s;
}

export function ContentAnalytics({
  content_type,
  content_id,
  trackDuration = false,
}: {
  content_type: string;
  content_id: string;
  trackDuration?: boolean;
}) {
  const startRef = useRef<number>(Date.now());
  const sentRef = useRef(false);

  useEffect(() => {
    const sessionId = getSessionId();
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const referrer = typeof document !== "undefined" ? document.referrer : "";

    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type,
        content_id,
        event_type: "view",
        session_id: sessionId,
        path,
        referrer: referrer || null,
      }),
    }).catch(() => {});

    if (!trackDuration) return;
    sentRef.current = false;
    const start = Date.now();
    startRef.current = start;

    const sendDuration = () => {
      if (sentRef.current) return;
      sentRef.current = true;
      const duration = Math.round((Date.now() - start) / 1000);
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type,
          content_id,
          event_type: "duration",
          duration_seconds: duration,
          session_id: sessionId,
        }),
      }).catch(() => {});
    };

    const onUnload = () => sendDuration();
    window.addEventListener("beforeunload", onUnload);
    const t = setInterval(() => sendDuration(), 30000);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      clearInterval(t);
    };
  }, [content_type, content_id, trackDuration]);

  return null;
}
