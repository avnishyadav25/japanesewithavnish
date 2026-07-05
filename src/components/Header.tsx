"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const accountMenuItems = [
  { href: "/learn/dashboard", label: "My progress" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/library", label: "My Order" },
  { href: "/account", label: "My Settings" },
];

const topNavLinks = [
  { href: "/", label: "Home" },
  { href: "/store", label: "Store" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const LESSONS_NAV_ITEMS = [
  { href: "/learn/kana", label: "Kana Portal" },
  { href: "/learn/grammar", label: "Grammar" },
  { href: "/learn/vocabulary", label: "Vocab" },
  { href: "/learn/listening", label: "Listening" },
  { href: "/learn/writing", label: "Writing" },
  { href: "/learn/kanji", label: "Kanji" },
];


const SALES_NAV_HREFS = new Set(["/store", "/library"]);

export function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnMobileExpanded, setLearnMobileExpanded] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const learnRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const libraryRef = useRef<HTMLDivElement>(null);

  const visibleTopNavLinks = isAdmin
    ? topNavLinks
    : topNavLinks.filter((l) => !SALES_NAV_HREFS.has(l.href));

  const visibleAccountMenuItems = isAdmin
    ? accountMenuItems
    : accountMenuItems.filter((item) => !SALES_NAV_HREFS.has(item.href));

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSessionEmail(data?.email ?? null))
      .catch(() => setSessionEmail(null));
  }, []);

  useEffect(() => {
    if (!sessionEmail) {
      setAvatarUrl(null);
      return;
    }
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAvatarUrl(d?.profile?.avatar_url ?? null))
      .catch(() => setAvatarUrl(null));
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
      if (libraryRef.current && !libraryRef.current.contains(e.target as Node)) setLibraryOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              className={`font-medium text-[14px] transition-colors pb-0.5 ${isActive("/") && pathname === "/"
                ? "text-primary border-b-2 border-primary"
                : "text-[#555] hover:text-[#1A1A1A]"
                }`}
            >
              Home
            </Link>

            {/* Lessons dropdown */}
            <div className="relative" ref={learnRef}>
              <button
                type="button"
                onClick={() => setLearnOpen((o) => !o)}
                className={`font-medium text-[14px] transition-colors flex items-center gap-1 pb-0.5 ${pathname?.startsWith("/learn/") || pathname?.startsWith("/blog/grammar") || pathname?.startsWith("/blog/vocabulary") || pathname?.startsWith("/blog/kanji")
                  ? "text-primary border-b-2 border-primary"
                  : "text-[#555] hover:text-[#1A1A1A]"
                  }`}
                aria-expanded={learnOpen}
                aria-haspopup="true"
                aria-controls="learn-dropdown"
                onKeyDown={(e) => { if (e.key === "Escape") setLearnOpen(false); }}
              >
                Lessons
                <svg className={`w-4 h-4 transition-transform ${learnOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {learnOpen && (
                <div id="learn-dropdown" className="absolute top-full left-0 mt-2 w-44 py-2 bg-white border border-[var(--divider)] rounded-xl shadow-card-hover z-50">
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
                </div>
              )}
            </div>

            {/* Store, Blog, Contact */}
            {visibleTopNavLinks.filter(l => l.href !== "/").map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-medium text-[14px] transition-colors pb-0.5 ${isActive(link.href)
                  ? "text-primary border-b-2 border-primary"
                  : "text-[#555] hover:text-[#1A1A1A]"
                  }`}
              >
                {link.label}
              </Link>
            ))}
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
                      {sessionEmail.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold">My Library</span>
                  <svg className={`w-4 h-4 transition-transform ${accountOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {accountOpen && (
                  <div id="account-menu" className="absolute top-full right-0 mt-2 w-52 py-2 bg-white border border-[var(--divider)] rounded-xl shadow-card-hover z-50">
                    <Link
                      href="/account"
                      className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      Edit profile
                    </Link>
                    {visibleAccountMenuItems.map((item) => (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className="block px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                        onClick={() => setAccountOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => { handleRemovePhoto(); setAccountOpen(false); }}
                        className="w-full text-left px-4 py-2 text-[#555] hover:bg-[#FAF8F5] hover:text-primary text-sm font-medium transition-colors"
                      >
                        Remove photo
                      </button>
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
              /* Logged out: My Library outline button (shows login dropdown) + Quiz CTA */
              <>
                <div className="relative" ref={libraryRef}>
                  <button
                    type="button"
                    onClick={() => setLibraryOpen((o) => !o)}
                    className="font-semibold text-[13px] text-[#1A1A1A] border border-[var(--divider)] rounded-lg px-4 py-2 hover:border-primary hover:text-primary transition-colors"
                    onKeyDown={(e) => { if (e.key === "Escape") setLibraryOpen(false); }}
                  >
                    My Library
                  </button>
                  {libraryOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 py-3 px-4 bg-white border border-[var(--divider)] rounded-xl shadow-card-hover z-50">
                      <p className="text-[12px] text-[#888] mb-3">Sign in to access your Library and purchased bundles.</p>
                      <Link
                        href="/login"
                        className="block w-full text-center bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm"
                        onClick={() => setLibraryOpen(false)}
                      >
                        Sign in →
                      </Link>
                    </div>
                  )}
                </div>
                <Link href="/quiz" className="btn-primary !h-9 !py-0 !px-4 !text-sm">
                  Take the Quiz →
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
                Lessons
                <svg className={`w-4 h-4 transition-transform ${learnMobileExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {learnMobileExpanded && (
                <div className="pl-4 pb-2 flex flex-col gap-0 bg-[#FAF8F5] rounded-lg mt-1">
                  {LESSONS_NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { setMobileOpen(false); setLearnMobileExpanded(false); }}
                      className={`py-2.5 text-sm transition-colors border-b border-[var(--divider)] last:border-0 ${isLearnNavActive(item.href) ? "text-primary font-semibold" : "text-[#555] hover:text-primary"
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Store, Blog, Contact */}
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
                  accountMenuItems.filter(i => i.href !== "/library").map((item) => (
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
