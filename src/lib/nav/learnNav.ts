export type LearnNavItem = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

/**
 * Single source of truth for the user-facing "Learn" navigation.
 * Used by:
 * - Header Learn dropdown
 * - Tutor ("Nihongo Navi") Learn hub sidebar
 */
export const LEARN_NAV_ITEMS: LearnNavItem[] = [
  { href: "/learn", label: "All" },
  { href: "/learn/curriculum", label: "Curriculum" },
  { href: "/learn/dashboard", label: "My dashboard", requiresAuth: true },
  { href: "/review", label: "Review", requiresAuth: true },
  { href: "/start-here", label: "Start Here" },
  { href: "/jlpt", label: "JLPT" },
  { href: "/free-n5-pack", label: "Free N5 Pack" },
  { href: "/learn/grammar", label: "Grammar" },
  { href: "/learn/vocabulary", label: "Vocabulary" },
  { href: "/learn/kanji", label: "Kanji" },
  { href: "/learn/reading", label: "Reading" },
  { href: "/learn/reading/sandbox", label: "Reading sandbox" },
  { href: "/learn/listening", label: "Listening" },
  { href: "/learn/shadowing", label: "Shadowing" },
  { href: "/learn/writing", label: "Writing" },
  { href: "/learn/exam", label: "Mock exam" },
  { href: "/learn/analytics", label: "Analytics", requiresAuth: true },
  { href: "/learn/practice_test", label: "Practice Test" },
  { href: "/learn/sounds", label: "Sounds" },
  { href: "/learn/study_guide", label: "Study Guide" },
  { href: "/quiz", label: "Placement Quiz" },
];

export const LEARN_DROPDOWN_PUBLIC_ITEMS = LEARN_NAV_ITEMS.filter((i) => !i.requiresAuth);
export const LEARN_DROPDOWN_AUTH_ITEMS = LEARN_NAV_ITEMS.filter((i) => i.requiresAuth);

