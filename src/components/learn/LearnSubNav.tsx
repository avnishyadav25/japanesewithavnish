"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LESSONS_NAV_ITEMS } from "@/components/Header";

function isSubNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/learn") return pathname === "/learn";
  return pathname.startsWith(`${href}/`);
}

export function LearnSubNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-16 z-40 bg-white border-b border-[var(--divider)] overflow-x-auto">
      <nav className="max-w-[1200px] mx-auto px-5 lg:px-6 flex items-center gap-5 h-11 whitespace-nowrap">
        {LESSONS_NAV_ITEMS.map((item) => {
          const active = isSubNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[13px] font-semibold transition-colors py-1 border-b-2 ${
                active ? "text-primary border-primary" : "text-[#666] border-transparent hover:text-[#1A1A1A]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
