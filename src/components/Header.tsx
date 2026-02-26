import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { href: "/start-here", label: "Start Here" },
  { href: "/jlpt/n5", label: "JLPT" },
  { href: "/blog", label: "Blog" },
  { href: "/store", label: "Store" },
  { href: "/quiz", label: "Quiz" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-base/98 backdrop-blur-sm border-b border-[var(--divider)]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-heading text-xl font-bold text-charcoal hover:text-primary transition-colors"
        >
          <Image
            src="/logo.png"
            alt="Japanese with Avnish"
            width={40}
            height={40}
            className="rounded-full object-contain"
            priority
          />
          Japanese with Avnish
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-secondary hover:text-primary font-medium text-sm transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="btn-secondary text-sm py-2 px-4"
          >
            My Library
          </Link>
        </nav>
      </div>
    </header>
  );
}
