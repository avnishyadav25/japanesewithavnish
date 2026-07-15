import Link from "next/link";
import { sql } from "@/lib/db";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Support Center | Japanese with Avnish",
  description: "Need help with premium passes, billing, your account, or learning content? Visit our Support Center.",
};

async function getContactEmail() {
  if (!sql) return null;
  const rows = await sql`
    SELECT value FROM site_settings WHERE key IN ('contact_email', 'support_email') LIMIT 1
  ` as { value: string }[];
  return rows[0]?.value ?? null;
}

const FAQS = [
  {
    question: "Do premium passes renew automatically?",
    answer: "India/INR and International/USD Premium Passes are fixed-duration one-time purchases through Razorpay. For USD checkout, PayPal or supported international methods may appear once enabled on the Razorpay account.",
  },
  {
    question: "What is your refund policy?",
    answer: "Our refund policy varies by plan: 30-Day Premium Passes are non-refundable once access has been granted. Yearly and Lifetime passes are eligible for a full refund within the <strong>first 7 days</strong> of purchase, provided you have not completed more than 5 lessons. Legacy one-time digital bundles are non-refundable. Please read our full <a href='/policies/refunds' class='text-primary hover:underline font-semibold'>Cancellation & Refund Policy</a> for details.",
  },
  {
    question: "How does the JLPT Placement Quiz work?",
    answer: "Our free Placement Quiz tests your knowledge of Japanese grammar, vocabulary, and kanji across different difficulty levels (N5 to N1). Based on your score, the system recommends the best starting level for your learning journey.",
  },
  {
    question: "Can I use Nihongo Navi for free?",
    answer: "Yes! Free tier users receive 5 AI tutoring messages per day to practice conversation and sentence corrections. Premium passes give you unlimited, real-time access to Nihongo Navi with no daily query limits.",
  },
  {
    question: "How do I download or access my invoice/receipt?",
    answer: "Whenever you complete a payment via Razorpay, a digital receipt is automatically sent to your registered email address. You can also view your billing history from your Account billing panel.",
  },
];

export default async function ContactPage() {
  const contactEmail = await getContactEmail() || "support@japanesewithavnish.com";

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Breadcrumb */}
        <nav className="text-sm text-secondary mb-8">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Support Center</span>
        </nav>

        {/* Hero Banner */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h1 className="font-heading text-4xl font-extrabold text-charcoal tracking-tight">
            How can we help you?
          </h1>
          <p className="text-secondary text-base">
            Find answers to common questions, manage your billing details, or get in touch with our support team.
          </p>
        </div>

        {/* Self-Service Quick Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
          <Link
            href="/billing"
            className="card p-6 text-center hover:shadow-md hover:border-primary/50 transition duration-200 flex flex-col items-center group"
          >
            <span className="text-3xl mb-3" aria-hidden>💳</span>
            <h3 className="font-heading font-bold text-charcoal text-sm group-hover:text-primary transition-colors">
              Manage Premium Access
            </h3>
            <p className="text-secondary text-xs mt-1.5 leading-relaxed">
              View your active pass, check expiration date, view payment history, download receipt, or purchase another pass.
            </p>
          </Link>
          <Link
            href="/reset-password"
            className="card p-6 text-center hover:shadow-md hover:border-primary/50 transition duration-200 flex flex-col items-center group"
          >
            <span className="text-3xl mb-3" aria-hidden>🔑</span>
            <h3 className="font-heading font-bold text-charcoal text-sm group-hover:text-primary transition-colors">
              Reset Password
            </h3>
            <p className="text-secondary text-xs mt-1.5 leading-relaxed">
              Locked out? Trigger a secure password reset link to your email.
            </p>
          </Link>
          <Link
            href="/quiz"
            className="card p-6 text-center hover:shadow-md hover:border-primary/50 transition duration-200 flex flex-col items-center group"
          >
            <span className="text-3xl mb-3" aria-hidden>📝</span>
            <h3 className="font-heading font-bold text-charcoal text-sm group-hover:text-primary transition-colors">
              Take Level Quiz
            </h3>
            <p className="text-secondary text-xs mt-1.5 leading-relaxed">
              Unsure which JLPT level to study? Take the placement test.
            </p>
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1fr_450px] gap-10 items-start">
          {/* Left Column: FAQ Accordion */}
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-charcoal mb-2">
                Frequently Asked Questions
              </h2>
              <p className="text-secondary text-sm">
                Check these popular topics before sending a message.
              </p>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-white border border-[var(--divider)] rounded-bento overflow-hidden transition-all duration-200 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex justify-between items-center p-5 font-heading font-semibold text-charcoal text-sm cursor-pointer hover:bg-[var(--divider)]/10 select-none">
                    <span>{faq.question}</span>
                    <span className="transition-transform duration-200 group-open:rotate-180 text-secondary text-xs">
                      ▼
                    </span>
                  </summary>
                  <div className="p-5 pt-0 border-t border-[var(--divider)]/40 text-secondary text-xs leading-relaxed bg-[#FAF8F5]/30">
                    <p dangerouslySetInnerHTML={{ __html: faq.answer }} />
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-charcoal mb-2">
                Send a Message
              </h2>
              <p className="text-secondary text-sm">
                Average response time: <strong>under 24 hours</strong>.
              </p>
            </div>

            <div className="card p-6 sm:p-8">
              <ContactForm />
              <div className="mt-6 pt-5 border-t border-[var(--divider)]/40 text-center">
                <p className="text-secondary text-xs">
                  Or email us directly:{" "}
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-primary hover:underline font-bold"
                  >
                    {contactEmail}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
