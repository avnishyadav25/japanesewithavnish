import Link from "next/link";
import type { BlockAccessTier } from "@/lib/auth/blockAccess";

/** Renders where gated blocks would be — a decorative placeholder only, never the real block
 * data. The visual can look like a "blurred card" (per the founder's spec wording) without the
 * security downside of a real client-side blur: the excluded blocks' content was already
 * dropped server-side in getResolvedLessonBlocks/getResolvedContentBlocks before this component
 * ever renders, so there is nothing here to leak via view-source/devtools. */
export function LockedBlockPlaceholder({ count, requiredAccess }: { count: number; requiredAccess: BlockAccessTier }) {
  const isPremium = requiredAccess === "premium";
  const ctaHref = isPremium ? "/pricing" : "/login";
  const ctaLabel = isPremium ? "Upgrade to Premium" : "Sign In";
  const message = isPremium ? "Unlock with Premium to continue" : "Sign in to continue";

  return (
    <div className="relative border border-[var(--divider)] rounded-bento overflow-hidden">
      <div aria-hidden className="p-5 space-y-3 blur-sm select-none opacity-60 pointer-events-none">
        <div className="h-4 w-2/3 bg-[var(--divider)] rounded" />
        <div className="h-3 w-full bg-[var(--divider)] rounded" />
        <div className="h-3 w-5/6 bg-[var(--divider)] rounded" />
        <div className="h-3 w-4/6 bg-[var(--divider)] rounded" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-center px-4">
        <p className="text-sm font-bold text-charcoal">
          {count} more section{count === 1 ? "" : "s"} ahead
        </p>
        <p className="text-xs text-secondary">{message}</p>
        <Link href={ctaHref} className="btn-primary text-xs px-4 py-2 rounded-xl mt-1">
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
