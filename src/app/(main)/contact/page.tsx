import Link from "next/link";
import { sql } from "@/lib/db";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Contact | Japanese with Avnish",
  description: "Get in touch about JLPT bundles, the placement quiz, or your order. We'll get back to you soon.",
};

async function getContactEmail() {
  if (!sql) return null;
  const rows = await sql`
    SELECT value FROM site_settings WHERE key IN ('contact_email', 'support_email') LIMIT 1
  ` as { value: string }[];
  return rows[0]?.value ?? null;
}

export default async function ContactPage() {
  const contactEmail = await getContactEmail();

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <nav className="text-sm text-secondary mb-8">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Contact</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4">
              Contact us
            </h1>
            <p className="text-secondary mb-6">
              Have a question about our JLPT bundles, the placement quiz, or your order? Send us a
              message and we&apos;ll get back to you as soon as we can.
            </p>
            <p className="text-secondary text-sm mb-2" lang="ja">
              ご質問・お問い合わせは下記フォームまたはメールでお送りください。
            </p>
            {contactEmail && (
              <p className="text-secondary text-sm">
                Or email us directly:{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-primary hover:underline font-medium"
                >
                  {contactEmail}
                </a>
              </p>
            )}
          </div>

          <div className="card p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
