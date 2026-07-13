"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9.5L12 3l9 6.5M5 9.5V21h14V9.5" />
    ),
    match: (p: string) => p === "/",
  },
  {
    href: "/learn/curriculum",
    label: "Curriculum",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15zM4 20.5A2.5 2.5 0 006.5 18H20" />
    ),
    match: (p: string) => p.startsWith("/learn/curriculum"),
  },
  {
    href: "/learn",
    label: "Learn",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4L2 9l10 5 10-5-10-5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
    ),
    match: (p: string) => p.startsWith("/learn") && !p.startsWith("/learn/curriculum"),
  },
  {
    href: "/tutor",
    label: "Navi",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    ),
    match: (p: string) => p === "/tutor",
  },
];

export function MobileBottomNav() {
  const pathname = usePathname() || "";
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSessionEmail(data?.email ?? null))
      .catch(() => setSessionEmail(null));
  }, []);

  const accountHref = sessionEmail ? "/account" : "/login";
  const accountActive = pathname === "/account" || pathname === "/login";

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--divider)] flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary mobile navigation"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              active ? "text-primary" : "text-[#888]"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {tab.icon}
            </svg>
            {tab.label}
          </Link>
        );
      })}
      <Link
        href={accountHref}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
          accountActive ? "text-primary" : "text-[#888]"
        }`}
      >
        {sessionEmail ? (
          <span className="w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center text-white text-[10px] font-bold">
            {sessionEmail.charAt(0).toUpperCase()}
          </span>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
          </svg>
        )}
        {sessionEmail ? "Account" : "Sign In"}
      </Link>
    </nav>
  );
}
