"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

const accountMenuItems = [
  { href: "/learn/dashboard", label: "My progress" },
  { href: "/learn/dashboard", label: "My Rewards" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/library", label: "My Order" },
  { href: "/account", label: "My Setting" },
];

const topNavLinks = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/store", label: "Store" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/tutor", label: "Nihongo Navi" },
  { href: "/contact", label: "Contact" },
];

const learnDropdownItemsPublic = [
  { href: "/learn", label: "All" },
  { href: "/learn/curriculum", label: "Curriculum" },
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
  { href: "/learn/analytics", label: "Analytics" },
  { href: "/learn/practice_test", label: "Practice Test" },
  { href: "/learn/sounds", label: "Sounds" },
  { href: "/learn/study_guide", label: "Study Guide" },
  { href: "/quiz", label: "Placement Quiz" },
];

const learnDropdownItemsAuthOnly = [
  { href: "/learn/dashboard", label: "My dashboard" },
  { href: "/review", label: "Review" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnMobileExpanded, setLearnMobileExpanded] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const learnRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-[#1A1A1A] text-[#FAF8F5] transition-all duration-300 ${
          scrolled ? "h-14 shadow-sm" : "h-16"
        }`}
      >
        <div className="max-w-[1100px] mx-auto px-5 lg:px-6 h-full flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-heading font-bold text-[#FAF8F5] hover:text-primary transition-colors"
          >
            <Image
              src="/logo-dark.png"
              alt="Japanese with Avnish"
              width={32}
              height={32}
              className="rounded-full object-contain max-h-8"
              priority
            />
            <span className="text-lg">Japanese with Avnish</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {topNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[#FAF8F5]/80 hover:text-primary font-medium text-[15px] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="relative" ref={learnRef}>
              <button
                type="button"
                onClick={() => setLearnOpen((o) => !o)}
                className="text-[#FAF8F5]/80 hover:text-primary font-medium text-[15px] transition-colors flex items-center gap-1"
                aria-expanded={learnOpen}
                aria-haspopup="true"
              >
                Learn
                <svg className={`w-4 h-4 transition-transform ${learnOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {learnOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 py-2 bg-[#2A2A2A] border border-[#3A3A3A] rounded-lg shadow-xl z-50">
                  {learnDropdownItemsPublic.slice(0, 2).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block px-4 py-2 text-[#FAF8F5]/90 hover:bg-[#3A3A3A] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setLearnOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {sessionEmail && learnDropdownItemsAuthOnly.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block px-4 py-2 text-[#FAF8F5]/90 hover:bg-[#3A3A3A] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setLearnOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {learnDropdownItemsPublic.slice(2).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block px-4 py-2 text-[#FAF8F5]/90 hover:bg-[#3A3A3A] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setLearnOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {sessionEmail ? (
              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((o) => !o)}
                  className="flex items-center gap-2 text-[#FAF8F5]/90 hover:text-primary font-medium text-sm rounded-full bg-[#2A2A2A] py-2 pl-3 pr-2 border border-[#3A3A3A]"
                  aria-expanded={accountOpen}
                  aria-haspopup="true"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover bg-primary/80" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold">
                      {sessionEmail.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <svg className={`w-4 h-4 transition-transform ${accountOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {accountOpen && (
                  <div className="absolute top-full right-0 mt-1 w-52 py-2 bg-[#2A2A2A] border border-[#3A3A3A] rounded-lg shadow-xl z-50">
                    <Link
                      href="/account"
                      className="block px-4 py-2 text-[#FAF8F5]/90 hover:bg-[#3A3A3A] hover:text-primary text-sm font-medium transition-colors"
                      onClick={() => setAccountOpen(false)}
                    >
                      Edit profile
                    </Link>
                    {accountMenuItems.map((item) => (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className="block px-4 py-2 text-[#FAF8F5]/90 hover:bg-[#3A3A3A] hover:text-primary text-sm font-medium transition-colors"
                        onClick={() => setAccountOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => { handleRemovePhoto(); setAccountOpen(false); }}
                        className="w-full text-left px-4 py-2 text-[#FAF8F5]/90 hover:bg-[#3A3A3A] hover:text-primary text-sm font-medium transition-colors"
                      >
                        Remove photo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-[#FAF8F5]/90 hover:bg-[#3A3A3A] hover:text-primary text-sm font-medium transition-colors border-t border-[#3A3A3A] mt-1 pt-2"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-primary text-white font-semibold py-2 px-[18px] rounded-md hover:bg-white hover:text-primary transition-colors text-sm"
              >
                Login
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-[#FAF8F5] hover:text-primary transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[280px] bg-[#1A1A1A] shadow-xl transform transition-transform duration-300 md:hidden overflow-y-auto ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col min-h-full pt-16 pb-6 px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 p-2 text-[#FAF8F5]/80 hover:text-primary"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <nav className="flex flex-col gap-1">
            {topNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-3 text-[#FAF8F5] hover:text-primary font-medium text-[15px]"
              >
                {link.label}
              </Link>
            ))}
            {sessionEmail ? (
              <>
                <Link href="/account" onClick={() => setMobileOpen(false)} className="py-3 text-[#FAF8F5]/90 hover:text-primary font-medium text-[15px]">
                  Edit profile
                </Link>
                {accountMenuItems.map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 text-[#FAF8F5]/90 hover:text-primary font-medium text-[15px]"
                  >
                    {item.label}
                  </Link>
                ))}
                {avatarUrl && (
                  <button type="button" onClick={() => { handleRemovePhoto(); setMobileOpen(false); }} className="py-3 w-full text-left text-[#FAF8F5]/90 hover:text-primary font-medium text-[15px]">
                    Remove photo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="py-3 w-full text-left text-[#FAF8F5]/90 hover:text-primary font-medium text-[15px]"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)} className="py-3 text-[#FAF8F5]/80 hover:text-primary font-medium text-[15px]">
                Log in
              </Link>
            )}
            <div>
              <button
                type="button"
                onClick={() => setLearnMobileExpanded((e) => !e)}
                className="py-3 w-full text-left text-[#FAF8F5] hover:text-primary font-medium text-[15px] flex items-center justify-between"
              >
                Learn
                <svg className={`w-4 h-4 transition-transform ${learnMobileExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {learnMobileExpanded && (
                <div className="pl-4 pb-2 flex flex-col gap-0">
                  {learnDropdownItemsPublic.slice(0, 2).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { setMobileOpen(false); setLearnMobileExpanded(false); }}
                      className="py-2 text-[#FAF8F5]/80 hover:text-primary text-sm"
                    >
                      {item.label}
                    </Link>
                  ))}
                  {sessionEmail && learnDropdownItemsAuthOnly.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { setMobileOpen(false); setLearnMobileExpanded(false); }}
                      className="py-2 text-[#FAF8F5]/80 hover:text-primary text-sm"
                    >
                      {item.label}
                    </Link>
                  ))}
                  {learnDropdownItemsPublic.slice(2).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { setMobileOpen(false); setLearnMobileExpanded(false); }}
                      className="py-2 text-[#FAF8F5]/80 hover:text-primary text-sm"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <div className="mt-auto pt-4 border-t border-[#EEEEEE]/30">
            {!sessionEmail && (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center bg-primary text-white font-semibold py-3 px-4 rounded-md hover:bg-white hover:text-primary transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
