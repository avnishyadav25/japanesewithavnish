"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminLogout } from "@/app/(admin)/AdminLogout";

const manageAIPrompts = { href: "/admin/prompts", label: "Manage AI Prompts" };

const navGroups = [
  {
    label: "Dashboard",
    items: [
      { href: "/admin", label: "All" },
      { href: "/admin/students", label: "User" },
      { href: "/admin/chatbot", label: "Chatbot" },
      { href: "/admin/products", label: "Product" },
      { href: "/admin/orders", label: "Order" },
      { href: "/admin/quiz", label: "Quiz" },
      manageAIPrompts,
    ],
  },
  {
    label: "Student",
    items: [
      { href: "/admin/students", label: "All" },
      { href: "/admin/students", label: "Students" },
      { href: "/admin/students/progress", label: "Progress" },
      manageAIPrompts,
    ],
  },
  {
    label: "Learning Content",
    items: [
      { href: "/admin/learn/curriculum", label: "Curriculum" },
      { href: "/admin/learn/vocabulary", label: "Vocabulary" },
      { href: "/admin/learn/grammar", label: "Grammar" },
      { href: "/admin/learn/kanji", label: "Kanji" },
      { href: "/admin/grammar-drills", label: "Grammar drills" },
      { href: "/admin/listening-generator", label: "Listening generator" },
      { href: "/admin/reading-glossary", label: "Reading glossary" },
      { href: "/admin/blogs", label: "Blog" },
      { href: "/admin/comments", label: "Comment" },
      { href: "/admin/blogs/recommended", label: "Recommend" },
      manageAIPrompts,
    ],
  },
  {
    label: "Product",
    items: [
      { href: "/admin/products", label: "All Products" },
      { href: "/admin/orders", label: "All Order" },
      { href: "/admin/orders", label: "Manage Orders" },
      manageAIPrompts,
    ],
  },
  {
    label: "Newsletter",
    items: [
      { href: "/admin/newsletter/subscribers", label: "Subscriber" },
      { href: "/admin/newsletters", label: "Newsletter" },
      { href: "/admin/emailtemplate", label: "Email template" },
      { href: "/admin/newsletter/settings", label: "Newsletter Setting" },
      manageAIPrompts,
    ],
  },
  {
    label: "Setting",
    items: [
      { href: "/admin/settings", label: "Company Setting" },
      { href: "/admin/progression", label: "Progression" },
      { href: "/admin/social/prepare", label: "Prepare for Social" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/ai-logs", label: "AI History" },
      manageAIPrompts,
    ],
  },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = !!pathname && (pathname === href || (href !== "/admin" && pathname.startsWith(href)));
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
