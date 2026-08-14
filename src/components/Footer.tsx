import Link from "next/link";
import Image from "next/image";
import { sql } from "@/lib/db";
import { NewsletterForm } from "@/components/NewsletterForm";
import { SocialIcon } from "@/components/icons/SocialIcons";
import { BRAND, SOCIAL_SETTINGS_KEYS, resolveSocials } from "@/lib/brand";
import { getAdminSession } from "@/lib/auth/admin";

const FOOTER_KEYS = ["contact_email", "support_email", ...SOCIAL_SETTINGS_KEYS] as const;

async function getFooterSettings() {
  const map: Record<string, string> = {};
  if (sql) {
    const rows = await sql`SELECT key, value FROM site_settings WHERE key = ANY(${FOOTER_KEYS})`;
    (rows as { key: string; value: unknown }[]).forEach((r) => {
      map[r.key] = typeof r.value === "string" ? r.value : "";
    });
  }
  return map;
}

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/learn", label: "Learn" },
  { href: "/tutor", label: "Nihongo Navi" },
  { href: "/quiz", label: "Quiz" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/guide", label: "Site Guide" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const policyLinks = [
  { href: "/policies/privacy", label: "Privacy Policy" },
  { href: "/policies/terms", label: "Terms of Service" },
  { href: "/policies/refunds", label: "Cancellation & Refunds" },
  { href: "/policies/cookies", label: "Cookie Policy" },
];

export async function Footer() {
  const [settings, session] = await Promise.all([
    getFooterSettings(),
    getAdminSession(),
  ]);
  const isAdmin = !!session;
  const contactEmail = settings.contact_email || settings.support_email || "";
  // Six accounts now, not three: Facebook, Threads and Pinterest existed in site_settings and in
  // /admin/settings but had no icon anywhere on the site. URLs come from the DB where a row is
  // set and fall back to @/lib/brand otherwise.
  const social = resolveSocials(settings, (a) => a.inFooter);

  const visibleQuickLinks = isAdmin
    ? quickLinks
    : quickLinks.filter((l) => l.href !== "/store");

  return (
    <footer className="bg-[#1A1A1A] mt-auto">
      <div className="max-w-[1100px] mx-auto px-5 lg:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-10 mb-12">
          {/* Column 1 — Brand */}
          <div>
            <Link
              href="/"
              className="flex items-center gap-2.5 text-white font-bold hover:text-primary transition-colors mb-3"
            >
              <Image
                src="/logo-dark.png"
                alt={BRAND.name}
                width={36}
                height={36}
                className="rounded-full object-contain opacity-90"
              />
              <span className="text-[15px]">{BRAND.name}</span>
            </Link>
            <p className="text-white/60 text-[14px] leading-relaxed mb-5 max-w-[260px]">
              Clean JLPT mastery system from N5 to N1. Learn free every day, or upgrade for unlimited daily lessons.
            </p>
            <p className="text-white/50 text-[12px] mb-2">JLPT tips + updates. No spam.</p>
            <NewsletterForm variant="dark" />
            <div className="flex flex-wrap gap-4 mt-5">
              {social.map((account) => (
                <a
                  key={account.platform}
                  href={account.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-primary transition-colors"
                  aria-label={`${account.label} — ${BRAND.atHandle}`}
                >
                  <SocialIcon platform={account.platform} className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Column 2 — Quick Links */}
          <div>
            <h3 className="text-[11px] font-bold text-white/35 uppercase tracking-[.1em] mb-4">
              Quick Links
            </h3>
            <ul className="space-y-[7px]">
              {visibleQuickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white text-[13.5px] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Support / Policies */}
          <div>
            <h3 className="text-[11px] font-bold text-white/35 uppercase tracking-[.1em] mb-4">
              Support
            </h3>
            <ul className="space-y-[7px]">
              <li>
                <Link
                  href="/contact"
                  className="text-white/60 hover:text-white text-[13.5px] transition-colors"
                >
                  Contact
                </Link>
              </li>
              {contactEmail && (
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-white/60 hover:text-white text-[13.5px] transition-colors"
                  >
                    Email us
                  </a>
                </li>
              )}
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white text-[13.5px] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="pt-5 border-t border-white/[.08] flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-white/50 text-[12.5px]">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
          <p className="text-white/30 text-[12px]">Made with ♥ for Japanese learners</p>
        </div>
      </div>
    </footer>
  );
}
