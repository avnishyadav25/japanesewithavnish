"use client";

import { usePathname } from "next/navigation";

const TASK_PAGES = ["/quiz", "/quiz/result", "/library", "/free-n5-pack"];

export function PathnameGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (TASK_PAGES.some((p) => pathname.startsWith(p))) {
    return null;
  }
  return <>{children}</>;
}

