"use client";

import { useState } from "react";

/** Mobile-only "Lesson Contents" bottom sheet (spec §13) — on narrow screens the sticky sidebar
 * collapses to the bottom of the page (single-column grid), so without this a learner has to
 * scroll past the whole lesson to find the table of contents. No drawer primitive existed
 * anywhere in the codebase before this; kept as one self-contained component since this is
 * currently its only use site. */
export function MobileLessonDrawer({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/*
        MobileBottomNav (src/components/MobileBottomNav.tsx) is a separate site-wide fixed
        bottom bar, visible below `md` at z-50 with no fixed height (content + safe-area-inset
        padding). Below `md` this trigger must sit above it (calc offset) or the nav bar
        intercepts its clicks; between `md` and `lg` the site nav is hidden, so bottom-0 is fine.
      */}
      <div className="lg:hidden fixed bottom-[calc(52px+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 z-40 bg-white border-t border-[var(--divider)] px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary py-1"
        >
          <span>📑</span>
          <span>Lesson Contents</span>
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-8 max-h-[70vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-sm text-charcoal">Lesson Contents</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-secondary hover:text-charcoal text-lg leading-none px-2"
              >
                ×
              </button>
            </div>
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-charcoal hover:bg-[var(--divider)]/10 transition"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
