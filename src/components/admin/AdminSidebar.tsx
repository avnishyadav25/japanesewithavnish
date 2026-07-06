"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminLogout } from "@/app/(admin)/AdminLogout";

const navGroups = [
  {
    label: "Dashboard",
    items: [
      { href: "/admin", label: "All Stats" }
    ]
  },
  {
    label: "Users",
    items: [
      { href: "/admin/users", label: "All Users" },
      { href: "/admin/users?plan=free", label: "Free Users" },
      { href: "/admin/users?plan=premium", label: "Premium Users" },
      { href: "/admin/users?plan=trial", label: "Trial Users" },
      { href: "/admin/users?status=suspended", label: "Suspended Users" },
      { href: "/admin/users/roles", label: "Staff & Roles" },
      { href: "/admin/users/activity", label: "User Activity" }
    ]
  },
  {
    label: "Premium Access",
    items: [
      { href: "/admin/premium/plans", label: "Plans" },
      { href: "/admin/premium/passes", label: "Active Passes" },
      { href: "/admin/premium/passes?status=expired", label: "Expired Passes" },
      { href: "/admin/premium/manual-access", label: "Manual Access" },
      { href: "/admin/payments", label: "Payments" }
    ]
  },
  {
    label: "Offers",
    items: [
      { href: "/admin/coupons", label: "Coupons" },
      { href: "/admin/offers/banners", label: "Offer Banners" },
      { href: "/admin/offers/trial-codes", label: "Trial Codes" }
    ]
  },
  {
    label: "Learning Content",
    items: [
      { href: "/admin/learn/curriculum", label: "Curriculum" },
      { href: "/admin/learn/lessons", label: "Lessons" },
      { href: "/admin/learn/vocabulary", label: "Vocabulary" },
      { href: "/admin/learn/grammar", label: "Grammar" },
      { href: "/admin/learn/kanji", label: "Kanji" },
      { href: "/admin/learn/reading", label: "Reading" },
      { href: "/admin/learn/listening", label: "Listening" },
      { href: "/admin/learn/writing", label: "Writing" },
      { href: "/admin/learn/practice_test", label: "Mock Tests" }
    ]
  },
  {
    label: "Gamification",
    items: [
      { href: "/admin/gamification/xp-rules", label: "XP Rules" },
      { href: "/admin/gamification/points", label: "Points" },
      { href: "/admin/gamification/badges", label: "Badges" },
      { href: "/admin/gamification/streaks", label: "Streaks" },
      { href: "/admin/gamification/leaderboard", label: "Leaderboard" }
    ]
  },
  {
    label: "Quiz",
    items: [
      { href: "/admin/quiz", label: "Placement Quiz" },
      { href: "/admin/quiz/attempts", label: "Quiz Attempts" },
      { href: "/admin/quiz/rules", label: "Result Rules" }
    ]
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/newsletter/subscribers", label: "Newsletter" },
      { href: "/admin/newsletter/notifications", label: "Notifications" },
      { href: "/admin/emailtemplate", label: "Email Templates" }
    ]
  },
  {
    label: "AI Tools",
    items: [
      { href: "/admin/prompts", label: "AI Prompts" },
      { href: "/admin/ai/content-generator", label: "Content Generator" },
      { href: "/admin/ai/listening-generator", label: "Listening Generator" },
      { href: "/admin/listening-generator", label: "Listening Maker Panel" },
      { href: "/admin/grammar-drills", label: "Practice Drills Panel" }
    ]
  },
  {
    label: "Analytics",
    items: [
      { href: "/admin/analytics/users", label: "User Analytics" },
      { href: "/admin/analytics/learning", label: "Learning Analytics" },
      { href: "/admin/analytics/revenue", label: "Revenue Analytics" },
      { href: "/admin/analytics/cohorts", label: "Cohorts" }
    ]
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "Site Settings" },
      { href: "/admin/settings/access-rules", label: "Access Rules" },
      { href: "/admin/settings/payments", label: "Payment Settings" },
      { href: "/admin/settings/seo", label: "SEO Settings" }
    ]
  }
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = !!pathname && (pathname === href || (href !== "/admin" && pathname.startsWith(href)));
  return (
    <Link
      href={href}
      className={`block py-1.5 px-3 text-xs transition border-l-2 ${
        isActive
          ? "bg-[#FFF7F7] text-primary border-l-primary font-semibold"
          : "text-secondary border-l-transparent hover:text-primary hover:bg-[var(--base)]"
      }`}
    >
      {label}
    </Link>
  );
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-bento bg-white border border-[var(--divider)] shadow-card"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 bg-charcoal/30 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[240px] bg-white border-r border-[var(--divider)] z-50 flex flex-col transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="p-4 border-b border-[var(--divider)] flex items-center justify-between">
          <Link href="/admin" className="font-heading font-bold text-charcoal">
            Admin
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden p-2 -mr-2 text-secondary hover:text-primary"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2 px-3">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={`${item.href}-${item.label}`}>
                    <NavLink href={item.href} label={item.label} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--divider)] space-y-2">
          <Link
            href="/"
            className="block py-2 px-3 text-sm text-secondary hover:text-primary transition"
            onClick={() => setOpen(false)}
          >
            ← Site
          </Link>
          <AdminLogout />
        </div>
      </aside>
    </>
  );
}
