import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";

const footerLinks = [
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms" },
  { href: "/policies/refunds", label: "Refunds" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--divider)] bg-white mt-auto">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
          <div>
            <Link href="/" className="font-heading text-lg font-bold text-charcoal hover:text-primary transition">
              Japanese with Avnish
            </Link>
            <p className="text-secondary text-sm mt-2 mb-4">JLPT tips and updates.</p>
            <NewsletterForm />
          </div>
          <div className="flex gap-8">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-secondary hover:text-primary text-sm transition-colors"
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
