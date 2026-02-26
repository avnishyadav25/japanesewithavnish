import Link from "next/link";

const navLinks = [
  { href: "/start-here", label: "Start Here" },
  { href: "/jlpt/n5", label: "JLPT" },
  { href: "/blog", label: "Blog" },
  { href: "/store", label: "Store" },
  { href: "/quiz", label: "Quiz" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-base/95 backdrop-blur border-b border-[var(--divider)]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-charcoal hover:text-primary transition">
          Japanese with Avnish
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-secondary hover:text-primary font-medium transition"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="btn-secondary text-sm py-2 px-4">
            My Library
          </Link>
        </nav>
      </div>
    </header>
  );
}
