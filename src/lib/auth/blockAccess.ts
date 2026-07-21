import { sql } from "@/lib/db";
import { hasActivePremium } from "@/lib/auth/access";

export type BlockAccessTier = "public" | "free_account" | "daily_unlocked" | "premium" | "preview";

const TIER_RANK: Record<BlockAccessTier, number> = {
  public: 0,
  preview: 0,
  free_account: 1,
  daily_unlocked: 2,
  premium: 3,
};

export interface ViewerAccessContext {
  isLoggedIn: boolean;
  isPremium: boolean;
  /** Whether the viewer currently has unlocked access to the lesson/post this block belongs to
   * — for lessons, mirrors the page's own canAccessLesson() result (premium, always_free,
   * completed, admin_override, or an available free-daily slot all count); for posts, no
   * page-level gate exists yet (see plan Decision A), so this is effectively `isPremium` until
   * one is built. Computed once by the caller and passed in, rather than re-derived here, to
   * avoid a second expensive access check per block. */
  hasUnlockedOwner: boolean;
}

/** Resolves a viewer's access context from their email (or null for anonymous) plus the
 * already-computed page-level unlock result. Does its own minimal profile lookup for premium
 * status rather than requiring the caller to pass a full profile object. */
export async function resolveViewerAccessContext(email: string | null, hasUnlockedOwner: boolean): Promise<ViewerAccessContext> {
  if (!email) return { isLoggedIn: false, isPremium: false, hasUnlockedOwner };
  if (!sql) return { isLoggedIn: true, isPremium: false, hasUnlockedOwner };

  const rows = (await sql`
    SELECT premium_until, is_lifetime FROM profiles WHERE email = ${email} LIMIT 1
  `) as { premium_until: string | null; is_lifetime: boolean }[];
  const isPremium = hasActivePremium(rows[0] ?? null);

  return { isLoggedIn: true, isPremium, hasUnlockedOwner };
}

/** Pure tier check — kept separate from resolveViewerAccessContext so it can be unit-tested
 * without a DB, and reused by both the lesson_blocks and content_blocks loaders. */
export function canViewBlock(access: BlockAccessTier, viewer: ViewerAccessContext): boolean {
  switch (access) {
    case "public":
    case "preview":
      return true;
    case "free_account":
      return viewer.isLoggedIn;
    case "daily_unlocked":
      return viewer.hasUnlockedOwner;
    case "premium":
      return viewer.isPremium;
    default:
      return true;
  }
}

/** For the locked-boundary CTA: the highest tier actually required among a set of blocks a
 * viewer can't see, so "unlock with Premium" only shows if premium is truly the blocker. */
export function highestTier(tiers: BlockAccessTier[]): BlockAccessTier {
  return tiers.reduce((max, t) => (TIER_RANK[t] > TIER_RANK[max] ? t : max), "public" as BlockAccessTier);
}
