"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminLogout } from "@/app/(admin)/AdminLogout";

const navGroups = [
  {
    label: "Main",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/chatbot", label: "Chatbot" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/quiz", label: "Quiz" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/blogs", label: "Blogs" },
      { href: "/admin/comments", label: "Comments" },
    ],
  },
  {
    label: "Learning",
    items: [
      { href: "/admin/learn/recommended", label: "Recommended" },
      { href: "/admin/learn/grammar", label: "Grammar" },
      { href: "/admin/learn/vocabulary", label: "Vocabulary" },
      { href: "/admin/learn/kanji", label: "Kanji" },
      { href: "/admin/learn/reading", label: "Reading" },
      { href: "/admin/learn/listening", label: "Listening" },
      { href: "/admin/learn/writing", label: "Writing" },
      { href: "/admin/learn/sounds", label: "Sounds" },
      { href: "/admin/learn/study_guide", label: "Study guide" },
      { href: "/admin/learn/practice_test", label: "Practice test" },
    ],
  },
  {
    label: "Audience",
    items: [
      { href: "/admin/newsletters", label: "Newsletters" },
      { href: "/admin/newsletter/subscribers", label: "Subscribers" },
      { href: "/admin/newsletter/settings", label: "Newsletter Settings" },
      { href: "/admin/emailtemplate", label: "Email Templates" },
      { href: "/admin/contact", label: "Contact" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "Company Settings" },
      { href: "/admin/social/prepare", label: "Prepare for social" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/ai-logs", label: "AI history" },
    ],
  },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`block py-2 px-3 rounded-bento text-sm transition ${isActive ? "bg-primary/10 text-primary font-medium japanese-shoji-border" : "text-secondary hover:text-primary hover:bg-base"
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
                  <li key={item.href}>
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
