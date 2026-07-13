"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

const accountMenuItems = [
  { href: "/learn/dashboard", label: "My progress" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/badge", label: "Badges" },
  { href: "/library", label: "My Library" },
  { href: "/pricing", label: "Pricing" },
  { href: "/billing", label: "Billing" },
  { href: "/account", label: "Edit Profile" },
];

// Icon strokes are 24x24 viewBox, rendered small inline next to nav labels for a friendlier, more
// scannable navbar.
const NavIcon = {
  home: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9.5L12 3l9 6.5M5 9.5V21h14V9.5" />
  ),
  curriculum: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15zM4 20.5A2.5 2.5 0 006.5 18H20" />
  ),
  learn: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4L2 9l10 5 10-5-10-5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
  ),
  blog: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 12h16M4 19h10" />
  ),
  contact: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16v12H4V6zm0 0l8 7 8-7" />
  ),
};

const topNavLinks = [
  { href: "/", label: "Home", icon: NavIcon.home },
  { href: "/learn/curriculum", label: "Curriculum", icon: NavIcon.curriculum },
  { href: "/blog", label: "Blog", icon: NavIcon.blog },
  { href: "/contact", label: "Contact", icon: NavIcon.contact },
];

export const LESSONS_NAV_ITEMS = [
  { href: "/learn", label: "Learn Hub" },
  { href: "/learn/curriculum", label: "Curriculum" },
  { href: "/learn/kana", label: "Kana Portal" },
  { href: "/learn/grammar", label: "Grammar" },
  { href: "/learn/vocabulary", label: "Vocab" },
  { href: "/learn/listening", label: "Listening" },
  { href: "/learn/writing", label: "Writing" },
  { href: "/learn/kanji", label: "Kanji" },
];

// Secondary links folded into the Learn dropdown to keep the top-level bar short.
const LEARN_DROPDOWN_EXTRA_ITEMS = [
  { href: "/guide", label: "Site Guide" },
  { href: "/about", label: "About Us" },
];

const SALES_NAV_HREFS = new Set(["/library"]);

type SearchResult = {
  type: "blog" | "vocabulary" | "grammar" | "kanji" | "lesson";
  title: string;
  subtitle: string | null;
  href: string;
};

type NextLesson = { id: string; title: string } | null;

export function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnMobileExpanded, setLearnMobileExpanded] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [nextLesson, setNextLesson] = useState<NextLesson>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const learnRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const visibleTopNavLinks = topNavLinks;

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSessionEmail(data?.email ?? null))
      .catch(() => setSessionEmail(null));
  }, []);

  useEffect(() => {
    if (!sessionEmail) {
      setAvatarUrl(null);
      setDisplayName(null);
      setIsPremium(false);
      return;
    }
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setAvatarUrl(d?.profile?.avatar_url ?? null);
        setDisplayName(d?.profile?.display_name || d?.profile?.email?.split("@")[0] || null);
        const now = new Date();
        const premium = d?.profile?.is_lifetime || (d?.profile?.premium_until && new Date(d.profile.premium_until) > now);
        setIsPremium(Boolean(premium));
      })
      .catch(() => {
        setAvatarUrl(null);
        setDisplayName(null);
        setIsPremium(false);
      });
  }, [sessionEmail]);

  useEffect(() => {
    if (!sessionEmail) {
      setCurrentStreak(0);
      setNextLesson(null);
      return;
    }
    fetch("/api/learn/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCurrentStreak(d?.stats?.currentStreak ?? 0);
        setNextLesson(d?.curriculum?.nextLesson ? { id: d.curriculum.nextLesson.id, title: d.curriculum.nextLesson.title } : null);
      })
      .catch(() => {
        setCurrentStreak(0);
        setNextLesson(null);
      });
  }, [sessionEmail]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (learnRef.current && !learnRef.current.contains(e.target as Node)) setLearnOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => setSearchResults(d.results ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const goToSearchResult = useCallback(
    (href: string) => {
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      router.push(href);
    },
    [router]
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSessionEmail(null);
    setAvatarUrl(null);
    setAccountOpen(false);
    setMobileOpen(false);
    window.location.href = "/";
  }

  async function handleRemovePhoto() {
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: null }),
      });
      if (res.ok) setAvatarUrl(null);
      setAccountOpen(false);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function isLearnNavActive(href: string) {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href === "/learn") return pathname.startsWith("/learn/") || pathname.startsWith("/blog/");
    if (href === "/learn/curriculum") return pathname.startsWith("/learn/curriculum");
    if (pathname.startsWith("/blog/") && href.startsWith("/learn/")) {
      const typeSegment = pathname.split("/")[2];
      return typeSegment ? href === `/learn/${typeSegment}` : false;
    }
    return false;
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-white transition-all duration-200 border-b border-[var(--divider)] ${scrolled ? "h-14 shadow-[0_2px_12px_rgba(0,0,0,0.08)]" : "h-16"
          }`}
      >
        <div className="max-w-[1200px] mx-auto px-5 lg:px-6 h-full flex items-center justify-between gap-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-semibold text-[#1A1A1A] hover:text-primary transition-colors flex-shrink-0"
          >
            <Image
              src="/logo.png"
              alt="Japanese with Avnish"
              width={32}
              height={32}
              className="rounded-full object-contain max-h-8"
              priority
            />
            <span className="text-[15px] font-bold">Japanese with Avnish</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-6">
            {/* Home */}
            <Link
              href="/"
              className={`font-medium text-[14px] transition-colors pb-0.5 flex items-center gap-1.5 ${isActive("/") && pathname === "/"
                ? "text-primary border-b-2 border-primary"
                : "text-[#555] hover:text-[#1A1A1A]"
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{NavIcon.home}</svg>
              Home
            </Link>

            {/* Curriculum */}
            <Link
              href="/learn/curriculum"
              className={`font-medium text-[14px] transition-colors pb-0.5 flex items-center gap-1.5 ${isLearnNavActive("/learn/curriculum")
                ? "text-primary border-b-2 border-primary"
                : "text-[#555] hover:text-[#1A1A1A]"
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{NavIcon.curriculum}</svg>
              Curriculum
            </Link>

            {/* Lessons dropdown */}
            <div className="relative" ref={learnRef}>
              <button
                type="button"
                onClick={() => setLearnOpen((o) => !o)}
                className={`font-medium text-[14px] transition-colors flex items-center gap-1.5 pb-0.5 ${(pathname?.startsWith("/learn") && !pathname.startsWith("/learn/curriculum")) || pathname === "/guide" || pathname === "/about" || pathname?.startsWith("/blog/grammar") || pathname?.startsWith("/blog/vocabulary") || pathname?.startsWith("/blog/kanji")
                  ? "text-primary border-b-2 border-primary"
                  : "text-[#555] hover:text-[#1A1A1A]"
                  }`}
                aria-expanded={learnOpen}
                aria-haspopup="true"
                aria-controls="learn-dropdown"
                onKeyDown={(e) => { if (e.key === "Escape") setLearnOpen(false); }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{NavIcon.learn}</svg>
                Learn
                <svg className={`w-4 h-4 transition-transform ${learnOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {learnOpen && (
                <div id="learn-dropdown" className="absolute top-full left-0 mt-2 w-48 py-2 bg-white border border-[var(--divider)] rounded-xl shadow-card-hover z-50">
                  {LESSONS_NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-4 py-2 text-sm font-medium transition-colors ${isLearnNavActive(item.href)
                        ? "bg-[var(--red-light)] text-primary"
                        : "text-[#555] hover:bg-[#FAF8F5] hover:text-primary"
                        }`}
                      onClick={() => setLearnOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="border-t border-[var(--divider)] mt-1 pt-1">
                    {LEARN_DROPDOWN_EXTRA_ITEMS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-4 py-2 text-sm font-medium transition-colors ${isActive(item.href)
                          ? "bg-[var(--red-light)] text-primary"
                          : "text-[#555] hover:bg-[#FAF8F5] hover:text-primary"
                          }`}
                        onClick={() => setLearnOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Blog, Contact */}
            {visibleTopNavLinks.filter(l => l.href !== "/" && l.href !== "/learn/curriculum").map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-medium text-[14px] transition-colors pb-0.5 flex items-center gap-1.5 ${isActive(link.href)
                  ? "text-primary border-b-2 border-primary"
                  : "text-[#555] hover:text-[#1A1A1A]"
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{link.icon}</svg>
                {link.label}
              </Link>
            ))}

            {/* Search */}
            <div className="relative" ref={searchRef}>
              <button
                type="button"
                onClick={() => setSearchOpen((o) => !o)}
                className="text-[#555] hover:text-primary transition-colors p-1"
                aria-label="Search"
                aria-expanded={searchOpen}
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </button>
              {searchOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-[var(--divider)] rounded-xl shadow-card-hover z-50 overflow-hidden">
                  <div className="p-2 border-b border-[var(--divider)]">
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search lessons, vocab, kanji, blog…"
                      className="w-full px-3 py-2 text-sm text-charcoal focus:outline-none"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {searchLoading && (
                      <p className="text-secondary text-xs px-4 py-3">Searching…</p>
                    )}
                    {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                      <p className="text-secondary text-xs px-4 py-3">No results found.</p>
                    )}
                    {searchResults.map((r) => (
                      <button
                        type="button"
                        key={`${r.type}-${r.href}`}
                        onClick={() => goToSearchResult(r.href)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#FAF8F5] transition-colors border-b border-[var(--divider)] last:border-0"
                      >
                        <p className="text-sm font-semibold text-charcoal truncate">{r.title}</p>
                        <p className="text-secondary text-xs truncate">{r.subtitle || r.type}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Logged-in progress pill */}
            {sessionEmail && (
              <Link
                href={nextLesson ? `/learn/curriculum/lesson/${nextLesson.id}` : "/learn/dashboard"}
                className="flex items-center gap-1.5 bg-[var(--red-light)] text-primary font-semibold text-xs rounded-full py-1.5 px-3 hover:bg-primary/10 transition-colors max-w-[200px]"
              >
                {nextLesson ? (
                  <span className="truncate">Continue: {nextLesson.title} →</span>
                ) : (
                  <span>🔥 {currentStreak} day streak</span>
                )}
              </Link>
            )}
          </nav>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-2.5">
            {sessionEmail ? (
              /* Logged in: account avatar dropdown */
              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((o) => !o)}
                  className="flex items-center gap-2 text-[#555] hover:text-[#1A1A1A] font-medium text-sm rounded-full bg-[#F5F5F5] py-2 pl-3 pr-2 border border-[var(--divider)]"
                  aria-expanded={accountOpen}
                  aria-haspopup="true"
                  aria-controls="account-menu"
                  onKeyDown={(e) => { if (e.key === "Escape") setAccountOpen(false); }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover bg-primary/80" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold">
                      {displayName ? displayName.charAt(0).toUpperCase() : sessionEmail.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold truncate max-w-[80px]">{displayName || "My Profile"}</span>
                  <svg className={`w-4 h-4 transition-transform ${accountOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {accountOpen && (
                  <div id="account-menu" className="absolute top-full right-0 mt-2 w-52 py-2 bg-white border border-[var(--divider)] rounded-xl shadow-card-hover z-50">
                    <Link
                      href="/learn/dashboard"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/learn/dashboard"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      My Progress
                    </Link>
                    <Link
                      href="/library"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      My Library
                    </Link>
                    <Link
                      href="/learn/curriculum"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      Curriculum
                    </Link>
                    <Link
                      href="/badge"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      Badges
                    </Link>
                    <Link
                      href="/pricing"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      Subscription
                    </Link>
                    <Link
                      href="/billing"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      Billing
                    </Link>
                    <Link
                      href="/account"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors border-b border-[var(--divider)] pb-2 mb-1"
                      onClick={() => setAccountOpen(false)}
                    >
                      Edit Profile
                    </Link>
                    {!isPremium && (
                      <Link
                        href="/pricing"
                        className="block px-4 py-2 text-[#D0021B] hover:bg-[#FFF7F7] text-sm font-bold transition-colors"
                        onClick={() => setAccountOpen(false)}
                      >
                        Upgrade to Premium ★
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors border-t border-[var(--divider)] mt-1 pt-2"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Logged out: Pricing + Sign In link + Take the Quiz button */
              <>
                <Link
                  href="/pricing"
                  className="font-semibold text-sm text-[#555] hover:text-primary transition-colors px-3 py-2"
                >
                  Pricing
                </Link>
                <Link
                  href="/login"
                  className="font-semibold text-sm text-[#1A1A1A] hover:text-primary transition-colors px-3 py-2"
                >
                  Sign In
                </Link>
                <Link
                  href="/quiz"
                  className="btn-primary !h-9 !py-0 !px-4 !text-sm flex items-center justify-center font-bold"
                >
                  Take the Quiz
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-[#555] hover:text-primary transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[280px] bg-white shadow-xl transform transition-transform duration-300 md:hidden overflow-y-auto ${mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <div className="flex flex-col min-h-full pt-16 pb-6 px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 p-2 text-[#555] hover:text-primary"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <nav className="flex flex-col gap-1">
            {/* Home */}
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className={`py-3 font-medium text-[15px] border-b border-[var(--divider)] ${pathname === "/" ? "text-primary" : "text-[#1A1A1A] hover:text-primary"
                }`}
            >
              Home
            </Link>

            {/* Lessons expand */}
            <div>
              <button
                type="button"
                onClick={() => setLearnMobileExpanded((e) => !e)}
                className="py-3 w-full text-left text-[#1A1A1A] hover:text-primary font-medium text-[15px] flex items-center justify-between border-b border-[var(--divider)]"
              >
                Learn
                <svg className={`w-4 h-4 transition-transform ${learnMobileExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {learnMobileExpanded && (
                <div className="pl-4 pb-2 flex flex-col gap-0 bg-[#FAF8F5] rounded-lg mt-1">
                  {[...LESSONS_NAV_ITEMS, ...LEARN_DROPDOWN_EXTRA_ITEMS].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { setMobileOpen(false); setLearnMobileExpanded(false); }}
                      className={`py-2.5 text-sm transition-colors border-b border-[var(--divider)] last:border-0 ${isLearnNavActive(item.href) || isActive(item.href) ? "text-primary font-semibold" : "text-[#555] hover:text-primary"
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Curriculum, Blog, Contact */}
            {visibleTopNavLinks.filter(l => l.href !== "/").map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`py-3 font-medium text-[15px] border-b border-[var(--divider)] ${isActive(link.href) ? "text-primary" : "text-[#1A1A1A] hover:text-primary"
                  }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Account links */}
            {sessionEmail ? (
              <>
                <Link href="/library" onClick={() => setMobileOpen(false)} className="py-3 text-[#555] hover:text-primary font-medium text-[15px] border-b border-[var(--divider)]">
                  My Library
                </Link>
                <Link href="/account" onClick={() => setMobileOpen(false)} className="py-3 text-[#555] hover:text-primary font-medium text-[15px] border-b border-[var(--divider)]">
                  Edit profile
                </Link>
                {
                  accountMenuItems.filter(i => i.href !== "/library" && i.href !== "/account").map((item) => (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="py-3 text-[#555] hover:text-primary font-medium text-[15px] border-b border-[var(--divider)]"
                    >
                      {item.label}
                    </Link>
                  ))
                }
                {avatarUrl && (
                  <button type="button" onClick={() => { handleRemovePhoto(); setMobileOpen(false); }} className="py-3 w-full text-left text-[#555] hover:text-primary font-medium text-[15px] border-b border-[var(--divider)]">
                    Remove photo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="py-3 w-full text-left text-[#555] hover:text-primary font-medium text-[15px]"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className={`py-3 font-medium text-[15px] border-b border-[var(--divider)] ${isActive("/pricing") ? "text-primary" : "text-[#1A1A1A] hover:text-primary"}`}
                >
                  Pricing
                </Link>
                <div className="py-3 border-b border-[var(--divider)]">
                  <p className="text-[12px] text-[#888] mb-2">Sign in to access your Library.</p>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="inline-block bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  >
                    Sign in to My Library →
                  </Link>
                </div>
              </>
            )}
          </nav>
          <div className="mt-auto pt-4 border-t border-[var(--divider)]">
            <Link
              href="/quiz"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Take the Quiz →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
