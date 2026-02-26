import Link from "next/link";

const footerLinks = [
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms" },
  { href: "/policies/refunds", label: "Refunds" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--divider)] bg-white mt-auto">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <Link href="/" className="text-lg font-bold text-charcoal">
            Japanese with Avnish
          </Link>
          <div className="flex gap-8">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-secondary hover:text-primary text-sm transition"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <p className="text-secondary text-sm mt-8 text-center">
          © {new Date().getFullYear()} Japanese with Avnish. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
