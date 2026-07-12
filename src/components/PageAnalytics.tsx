"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const PRIVATE_PREFIXES = [
  "/admin",
  "/api",
  "/account",
  "/library",
  "/checkout",
  "/order",
  "/thank-you",
  "/payment-",
  "/reset-password",
  "/login",
];

function getSessionId(): string {
  let sessionId = sessionStorage.getItem("analytics_session");
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem("analytics_session", sessionId);
  }
  return sessionId;
}

function shouldTrack(pathname: string): boolean {
  return !PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function PageAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sentDurationRef = useRef(false);

  useEffect(() => {
    if (!pathname || !shouldTrack(pathname)) return;
    const sessionId = getSessionId();
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const startedAt = Date.now();
    sentDurationRef.current = false;

    const payload = {
      content_type: "page",
      content_id: pathname,
      event_type: "view",
      session_id: sessionId,
      path,
      referrer: document.referrer || null,
      utm_source: searchParams.get("utm_source"),
      utm_medium: searchParams.get("utm_medium"),
      utm_campaign: searchParams.get("utm_campaign"),
    };

    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});

    const sendDuration = () => {
      if (sentDurationRef.current) return;
      sentDurationRef.current = true;
      const duration = Math.round((Date.now() - startedAt) / 1000);
      if (duration < 2) return;
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          event_type: "duration",
          duration_seconds: duration,
        }),
      }).catch(() => {});
    };

    const interval = window.setInterval(sendDuration, 30000);
    window.addEventListener("pagehide", sendDuration);
    return () => {
      sendDuration();
      window.clearInterval(interval);
      window.removeEventListener("pagehide", sendDuration);
    };
  }, [pathname, searchParams]);

  return null;
}
