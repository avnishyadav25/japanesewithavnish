"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/start-here", label: "Start Here" },
  { href: "/jlpt", label: "JLPT" },
  { href: "/learn", label: "Learn" },
  { href: "/blog", label: "Blog" },
  { href: "/store", label: "Store" },
  { href: "/quiz", label: "Quiz" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[#FAF8F5]/80 hover:text-primary font-medium text-[15px] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/free-n5-pack"
              className="text-[#FAF8F5]/80 hover:text-primary font-medium text-sm"
            >
              Free N5 Pack
            </Link>
            <Link
              href="/store"
              className="bg-primary text-white font-semibold py-2 px-[18px] rounded-md hover:bg-white hover:text-primary transition-colors text-sm"
            >
              Store
            </Link>
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
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[280px] bg-[#1A1A1A] shadow-xl transform transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full pt-16 pb-6 px-6">
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
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-3 text-[#FAF8F5] hover:text-primary font-medium text-[15px]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/free-n5-pack"
              onClick={() => setMobileOpen(false)}
                className="py-3 text-[#FAF8F5]/80 hover:text-primary font-medium text-sm"
            >
              Free N5 Pack
            </Link>
          </nav>
          <div className="mt-auto pt-4 border-t border-[#EEEEEE]/30">
            <Link
              href="/store"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center bg-primary text-white font-semibold py-3 px-4 rounded-md hover:bg-white hover:text-primary transition-colors"
            >
              Store
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
