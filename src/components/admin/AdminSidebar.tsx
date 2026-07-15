"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminLogout } from "@/app/(admin)/AdminLogout";

const UNREAD_BADGE_HREFS: Record<string, keyof UnreadCounts> = {
  "/admin/comments": "comments",
  "/admin/contact": "contact",
  "/admin/feedback": "feedback",
};

type UnreadCounts = { comments: number; contact: number; feedback: number };

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
      { href: "/admin/students", label: "Students" },
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
    label: "Store",
    items: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/orders", label: "Orders" }
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
      { href: "/admin/learn/vocabulary", label: "Vocabulary" },
      { href: "/admin/learn/grammar", label: "Grammar" },
      { href: "/admin/learn/kanji", label: "Kanji" },
      { href: "/admin/learn/reading", label: "Reading" },
      { href: "/admin/learn/listening", label: "Listening" },
      { href: "/admin/learn/writing", label: "Writing" },
      { href: "/admin/learn/practice_test", label: "Mock Tests" },
      { href: "/admin/blogs", label: "Blogs" },
      { href: "/admin/guide", label: "Site Guide" }
    ]
  },
  {
    label: "Gamification",
    items: [
      { href: "/admin/gamification/xp-rules", label: "XP Rules" },
      { href: "/admin/gamification/points", label: "Points" },
      { href: "/admin/gamification/badges", label: "Badges" },
      { href: "/admin/gamification/streaks", label: "Streaks" },
      { href: "/admin/gamification/leaderboard", label: "Leaderboard" },
      { href: "/admin/gamification/leaderboard/rewards", label: "Leaderboard Rewards" }
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
      { href: "/admin/newsletter/nudges", label: "Re-engagement Nudges" },
      { href: "/admin/newsletters", label: "Compose Newsletter" },
      { href: "/admin/emailtemplate", label: "Email Templates" },
      { href: "/admin/comments", label: "Comments" },
      { href: "/admin/contact", label: "Contact Inbox" },
      { href: "/admin/feedback", label: "Feedback" }
    ]
  },
  {
    label: "AI Tools",
    items: [
      { href: "/admin/learn/curriculum/review-queue", label: "Review Queue" },
      { href: "/admin/prompts", label: "AI Prompts" },
      { href: "/admin/ai/content-generator", label: "Content Generator" },
      { href: "/admin/ai/listening-generator", label: "Listening Generator" },
      { href: "/admin/listening-generator", label: "Listening Maker Panel" },
      { href: "/admin/grammar-drills", label: "Practice Drills Panel" },
      { href: "/admin/chatbot", label: "Chatbot Console" },
      { href: "/admin/reading-glossary", label: "Reading Glossary" },
      { href: "/admin/social", label: "Social Content" },
      { href: "/admin/ai-logs", label: "AI Logs" }
    ]
  },
  {
    label: "Analytics",
    items: [
      { href: "/admin/analytics", label: "Overview" },
      { href: "/admin/analytics/users", label: "User Analytics" },
      { href: "/admin/analytics/learning", label: "Learning Analytics" },
      { href: "/admin/analytics/revenue", label: "Revenue Analytics" },
      { href: "/admin/analytics/cohorts", label: "Cohorts" },
      { href: "/admin/content-audit", label: "Content Audit" }
    ]
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "Site Settings" },
      { href: "/admin/settings/access-rules", label: "Access Rules" },
      { href: "/admin/settings/payments", label: "Payment Settings" },
      { href: "/admin/settings/seo", label: "SEO Settings" },
      { href: "/admin/settings/backup", label: "Database Backup" },
      { href: "/admin/progression", label: "Progression Rules" }
    ]
  }
];

// Hrefs that have a more specific sibling href elsewhere in navGroups (e.g. "/admin/analytics"
// vs. "/admin/analytics/users") must match exactly, not by prefix — otherwise visiting the more
// specific page would highlight both links at once.
const ALL_HREFS = navGroups.flatMap((g) => g.items.map((i) => i.href.split("?")[0]));
const EXACT_MATCH_ONLY_HREFS = new Set(
  ["/admin", ...ALL_HREFS].filter((href) => ALL_HREFS.some((other) => other !== href && other.startsWith(`${href}/`)))
);

function NavLink({ href, label, unreadCount }: { href: string; label: string; unreadCount?: number }) {
  const pathname = usePathname();
  const isActive =
    !!pathname && (pathname === href || (!EXACT_MATCH_ONLY_HREFS.has(href) && pathname.startsWith(href)));
  return (
    <Link
      href={href}
      className={`flex items-center justify-between py-1.5 px-3 text-xs transition border-l-2 ${
        isActive
          ? "bg-[#FFF7F7] text-primary border-l-primary font-semibold"
          : "text-secondary border-l-transparent hover:text-primary hover:bg-[var(--base)]"
      }`}
    >
      <span>{label}</span>
      {!!unreadCount && (
        <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

const DEFAULT_OPEN_GROUPS = ["Dashboard", "Users", "Communication"];
const COLLAPSE_STORAGE_KEY = "admin-sidebar-open-groups";

export function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ comments: 0, contact: 0, feedback: 0 });
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(DEFAULT_OPEN_GROUPS));

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(COLLAPSE_STORAGE_KEY) : null;
    if (stored) {
      try {
        setOpenGroups(new Set(JSON.parse(stored)));
      } catch {
        // ignore malformed storage
      }
    }
  }, []);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: isSearching ? group.items.filter((item) => item.label.toLowerCase().includes(query)) : group.items,
    }))
    .filter((group) => !isSearching || group.items.length > 0);

  useEffect(() => {
    let cancelled = false;
    function fetchCounts() {
      fetch("/api/admin/unread-counts")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d) setUnreadCounts(d);
        })
        .catch(() => {});
    }
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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

        <div className="px-4 pt-3 pb-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search admin…"
            className="w-full px-3 py-1.5 text-xs border border-[var(--divider)] rounded-bento text-charcoal focus:outline-none focus:border-primary"
          />
        </div>

        <nav className="flex-1 overflow-y-auto p-4 pt-2 space-y-1">
          {filteredGroups.map((group) => {
            const isOpen = isSearching || openGroups.has(group.label);
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between py-1.5 px-3 text-xs font-semibold text-secondary uppercase tracking-wider hover:text-primary transition"
                >
                  {group.label}
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <ul className="space-y-1 mb-2">
                    {group.items.map((item) => {
                      const badgeKey = UNREAD_BADGE_HREFS[item.href];
                      return (
                        <li key={`${item.href}-${item.label}`}>
                          <NavLink href={item.href} label={item.label} unreadCount={badgeKey ? unreadCounts[badgeKey] : undefined} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          {isSearching && filteredGroups.length === 0 && (
            <p className="text-xs text-secondary px-3 py-4 text-center">No matches for &quot;{search}&quot;</p>
          )}
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
