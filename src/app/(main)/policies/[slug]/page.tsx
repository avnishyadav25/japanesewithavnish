import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

/* ────────────────────────────────────────────────────────────
   Policy content – comprehensive, subscription-aware, legally sound
   ──────────────────────────────────────────────────────────── */

const EFFECTIVE_DATE = "July 6, 2026";

type PolicySection = { id: string; heading: string; body: string };

type PolicyDef = {
  title: string;
  description: string;
  sections: PolicySection[];
};

const POLICIES: Record<string, PolicyDef> = {
  /* ═══════════════════════════════════════════════════════════
     PRIVACY POLICY
     ═══════════════════════════════════════════════════════════ */
  privacy: {
    title: "Privacy Policy",
    description:
      "How Japanese with Avnish collects, uses, stores, and protects your personal data.",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        body: `<p>Japanese with Avnish ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website <strong>japanesewithavnish.com</strong> and use our learning platform services.</p>
        <p>By using our services, you consent to the data practices described in this policy. If you do not agree, please discontinue use of our services.</p>`,
      },
      {
        id: "information-we-collect",
        heading: "Information We Collect",
        body: `<h3>Information You Provide</h3>
        <ul>
          <li><strong>Account Information:</strong> Name, email address, and password when you create an account or sign up via magic link.</li>
          <li><strong>Profile Information:</strong> Target JLPT level, avatar, display name, and learning preferences.</li>
          <li><strong>Payment Information:</strong> Billing details processed securely by our payment partners (Stripe and Razorpay). We do <strong>not</strong> store your credit card or bank details on our servers.</li>
          <li><strong>Contact & Feedback:</strong> Name, email, and message content when you use our contact form or feedback widget.</li>
          <li><strong>AI Tutor Interactions:</strong> Questions and conversations you submit to Nihongo Navi, our AI tutor, to provide personalized responses.</li>
        </ul>
        <h3>Information Collected Automatically</h3>
        <ul>
          <li><strong>Learning Activity:</strong> Lesson completions, quiz scores, streak data, XP points, badges earned, and progress metrics.</li>
          <li><strong>Device & Usage Data:</strong> Browser type, operating system, IP address, pages visited, and access timestamps.</li>
          <li><strong>Cookies & Local Storage:</strong> Session tokens, authentication state, and user preferences. See our <a href="/policies/cookies" class="text-primary hover:underline">Cookie Policy</a> for details.</li>
        </ul>`,
      },
      {
        id: "how-we-use",
        heading: "How We Use Your Information",
        body: `<p>We use the information we collect for the following purposes:</p>
        <ul>
          <li><strong>Service Delivery:</strong> To provide, maintain, and improve our Japanese learning platform, including tracking your progress, streaks, and achievements.</li>
          <li><strong>Account Management:</strong> To create and manage your account, process magic link authentication, and deliver password reset emails.</li>
          <li><strong>Subscription & Billing:</strong> To process premium pass purchases, manage subscription status, and send payment confirmations.</li>
          <li><strong>AI Tutoring:</strong> Your Nihongo Navi queries are sent to Google Gemini AI to generate personalized Japanese language tutoring responses. These queries are processed in real-time and are not stored by Google for model training.</li>
          <li><strong>Communication:</strong> To send order confirmations, streak reminders, learning nudges, and respond to your support inquiries.</li>
          <li><strong>Improvement:</strong> To analyze usage patterns, fix bugs, and enhance the learning experience.</li>
        </ul>`,
      },
      {
        id: "third-party-services",
        heading: "Third-Party Service Providers",
        body: `<p>We share your information with trusted third-party service providers who assist us in operating our platform:</p>
        <table>
          <thead><tr><th>Provider</th><th>Purpose</th><th>Data Shared</th></tr></thead>
          <tbody>
            <tr><td><strong>Neon (NeonDB)</strong></td><td>Database hosting</td><td>Account data, learning progress, content</td></tr>
            <tr><td><strong>Cloudflare R2</strong></td><td>File & media storage</td><td>Uploaded avatars, generated images</td></tr>
            <tr><td><strong>Stripe</strong></td><td>Global payment processing</td><td>Email, payment details (handled by Stripe)</td></tr>
            <tr><td><strong>Razorpay</strong></td><td>India payment processing</td><td>Email, payment details (handled by Razorpay)</td></tr>
            <tr><td><strong>Google Gemini AI</strong></td><td>AI tutor (Nihongo Navi)</td><td>Your tutor queries (processed in real-time)</td></tr>
            <tr><td><strong>Netlify</strong></td><td>Web hosting & deployment</td><td>Standard HTTP request data</td></tr>
          </tbody>
        </table>
        <p>We do <strong>not</strong> sell, rent, or trade your personal information to any third party for marketing purposes.</p>`,
      },
      {
        id: "data-retention",
        heading: "Data Retention",
        body: `<p>We retain your personal information for as long as your account is active or as needed to provide services. Specifically:</p>
        <ul>
          <li><strong>Account Data:</strong> Retained while your account is active. Deleted within 30 days of account deletion request.</li>
          <li><strong>Learning Progress:</strong> Retained while your account is active to preserve streaks, XP, and badges.</li>
          <li><strong>Payment Records:</strong> Retained for 7 years as required by Indian tax regulations.</li>
          <li><strong>Contact Submissions:</strong> Retained for 1 year, then automatically purged.</li>
          <li><strong>AI Tutor Conversations:</strong> Retained for 90 days to improve response quality, then deleted.</li>
        </ul>`,
      },
      {
        id: "your-rights",
        heading: "Your Rights",
        body: `<p>Depending on your location, you may have the following rights regarding your personal data:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong>Deletion:</strong> Request deletion of your account and associated data ("Right to be Forgotten").</li>
          <li><strong>Data Portability:</strong> Request your data in a structured, machine-readable format.</li>
          <li><strong>Objection:</strong> Object to processing of your data for specific purposes.</li>
          <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing at any time by contacting us.</li>
        </ul>
        <p>To exercise any of these rights, please email us at <strong>support@japanesewithavnish.com</strong> or use our <a href="/contact" class="text-primary hover:underline">Contact page</a>. We will respond within 30 days.</p>`,
      },
      {
        id: "childrens-privacy",
        heading: "Children's Privacy",
        body: `<p>Our services are intended for users aged <strong>13 years and older</strong>. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will delete it promptly. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.</p>`,
      },
      {
        id: "security",
        heading: "Security",
        body: `<p>We implement industry-standard security measures to protect your data, including:</p>
        <ul>
          <li>HTTPS encryption for all data in transit</li>
          <li>Encrypted database connections</li>
          <li>Secure, HTTP-only session cookies</li>
          <li>Access controls limiting data access to authorized personnel only</li>
        </ul>
        <p>While we strive to protect your information, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.</p>`,
      },
      {
        id: "international-transfers",
        heading: "International Data Transfers",
        body: `<p>Your data may be transferred to and processed in countries other than your own, including the United States (for cloud infrastructure). We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.</p>`,
      },
      {
        id: "changes",
        heading: "Changes to This Policy",
        body: `<p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the "Last Updated" date. Your continued use of our services after changes constitutes acceptance of the updated policy.</p>`,
      },
      {
        id: "contact",
        heading: "Contact Us",
        body: `<p>If you have questions about this Privacy Policy, please contact us:</p>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:support@japanesewithavnish.com" class="text-primary hover:underline">support@japanesewithavnish.com</a></li>
          <li><strong>Contact Form:</strong> <a href="/contact" class="text-primary hover:underline">japanesewithavnish.com/contact</a></li>
        </ul>`,
      },
    ],
  },

  /* ═══════════════════════════════════════════════════════════
     TERMS OF SERVICE
     ═══════════════════════════════════════════════════════════ */
  terms: {
    title: "Terms of Service",
    description:
      "Terms and conditions governing the use of Japanese with Avnish learning platform.",
    sections: [
      {
        id: "acceptance",
        heading: "Acceptance of Terms",
        body: `<p>By accessing or using the Japanese with Avnish website and platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you must not use our Service.</p>
        <p>These Terms apply to all visitors, registered users, and premium subscribers.</p>`,
      },
      {
        id: "eligibility",
        heading: "Eligibility",
        body: `<p>You must be at least <strong>13 years of age</strong> to use our Service. If you are under 18, you must have the consent of a parent or guardian. By using our Service, you represent and warrant that you meet these requirements.</p>`,
      },
      {
        id: "accounts",
        heading: "Your Account",
        body: `<p>When you create an account, you are responsible for:</p>
        <ul>
          <li>Providing accurate and complete registration information</li>
          <li>Maintaining the security of your account credentials</li>
          <li>All activities that occur under your account</li>
          <li>Notifying us immediately of any unauthorized access</li>
        </ul>
        <p>We reserve the right to suspend or terminate accounts that violate these Terms or remain inactive for extended periods.</p>`,
      },
      {
        id: "free-premium",
        heading: "Free & Premium Access",
        body: `<h3>Free Tier</h3>
        <p>All registered users receive free access to limited daily lessons, basic quizzes, the JLPT placement quiz, and selected blog content. Free access may be subject to daily limits (e.g., lessons per day, AI tutor queries).</p>
        <h3>Premium Pass</h3>
        <p>Premium pass holders receive access to all lessons, mock exams, advanced AI tutoring, writing practice, and streak freeze purchases for the pass duration purchased. Premium passes are available as 30-day, 365-day, or lifetime access.</p>
        <p>Pass details, pricing, and access terms are displayed on our <a href="/pricing" class="text-primary hover:underline">Pricing page</a> at the time of purchase. Monthly and yearly passes are one-time purchases and do not renew automatically.</p>`,
      },
      {
        id: "billing",
        heading: "Billing & Payments",
        body: `<ul>
          <li><strong>30-Day Passes:</strong> One-time payment granting 30 days of premium access.</li>
          <li><strong>365-Day Passes:</strong> One-time payment granting 365 days of premium access.</li>
          <li><strong>Lifetime Passes:</strong> One-time payment granting indefinite premium access, subject to the continued operation of the Service.</li>
        </ul>
        <p>Payments are processed securely by <strong>Stripe</strong> (international) and <strong>Razorpay</strong> (India). We do not store your payment card details. All prices are inclusive of applicable taxes unless stated otherwise.</p>
        <p>For cancellation and refund terms, see our <a href="/policies/refunds" class="text-primary hover:underline">Cancellation & Refund Policy</a>.</p>`,
      },
      {
        id: "intellectual-property",
        heading: "Intellectual Property",
        body: `<p>All content on Japanese with Avnish — including but not limited to lessons, quizzes, practice tests, illustrations, audio, design, and software — is the intellectual property of Japanese with Avnish and is protected by copyright laws.</p>
        <p>You may <strong>not</strong>:</p>
        <ul>
          <li>Copy, reproduce, or redistribute any content for commercial purposes</li>
          <li>Share your account credentials with others</li>
          <li>Scrape, crawl, or use automated tools to extract content</li>
          <li>Create derivative works from our content without written permission</li>
          <li>Resell or sublicense access to our platform</li>
        </ul>
        <p>You are granted a limited, non-exclusive, non-transferable license to access and use the content for <strong>personal, non-commercial learning purposes only</strong>.</p>`,
      },
      {
        id: "ai-tutor",
        heading: "AI Tutor (Nihongo Navi)",
        body: `<p>Nihongo Navi is an AI-powered Japanese language tutor that uses third-party AI models (Google Gemini) to generate responses. By using Nihongo Navi, you acknowledge:</p>
        <ul>
          <li>AI responses may contain inaccuracies. Always verify important information with authoritative sources.</li>
          <li>Your queries are processed by Google's AI infrastructure. See our <a href="/policies/privacy" class="text-primary hover:underline">Privacy Policy</a> for details.</li>
          <li>Nihongo Navi is a learning aid, not a replacement for professional instruction or official JLPT preparation materials.</li>
          <li>We are not liable for any decisions made based on AI-generated content.</li>
        </ul>`,
      },
      {
        id: "acceptable-use",
        heading: "Acceptable Use",
        body: `<p>You agree not to use our Service to:</p>
        <ul>
          <li>Violate any applicable laws or regulations</li>
          <li>Harass, abuse, or harm other users</li>
          <li>Submit false, misleading, or offensive content</li>
          <li>Attempt to gain unauthorized access to our systems</li>
          <li>Interfere with the proper functioning of the Service</li>
          <li>Use bots, scripts, or automated tools to interact with the Service</li>
        </ul>`,
      },
      {
        id: "termination",
        heading: "Account Termination",
        body: `<p>We may suspend or terminate your account at our sole discretion if you violate these Terms, engage in fraudulent activity, or abuse the Service. Upon termination:</p>
        <ul>
          <li>Your access to premium content will be revoked immediately</li>
          <li>Your learning data may be retained for 30 days before permanent deletion</li>
          <li>No refund will be issued for termination due to Terms violation</li>
        </ul>
        <p>You may delete your account at any time by contacting us at <a href="/contact" class="text-primary hover:underline">our contact page</a>.</p>`,
      },
      {
        id: "disclaimers",
        heading: "Disclaimers & Limitation of Liability",
        body: `<p>Our Service is provided <strong>"as is"</strong> and <strong>"as available"</strong> without warranties of any kind, express or implied. We do not guarantee:</p>
        <ul>
          <li>Uninterrupted or error-free access to the Service</li>
          <li>That content will be accurate, complete, or current at all times</li>
          <li>Specific learning outcomes or JLPT examination results</li>
        </ul>
        <p>To the maximum extent permitted by law, Japanese with Avnish shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</p>
        <p>Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.</p>`,
      },
      {
        id: "governing-law",
        heading: "Governing Law & Jurisdiction",
        body: `<p>These Terms are governed by and construed in accordance with the laws of <strong>India</strong>. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in India.</p>`,
      },
      {
        id: "changes",
        heading: "Changes to Terms",
        body: `<p>We reserve the right to modify these Terms at any time. Material changes will be communicated via email or a prominent notice on our website. Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms.</p>`,
      },
      {
        id: "contact",
        heading: "Contact",
        body: `<p>Questions about these Terms? Contact us at <a href="mailto:support@japanesewithavnish.com" class="text-primary hover:underline">support@japanesewithavnish.com</a> or visit our <a href="/contact" class="text-primary hover:underline">Contact page</a>.</p>`,
      },
    ],
  },

  /* ═══════════════════════════════════════════════════════════
     CANCELLATION & REFUND POLICY
     ═══════════════════════════════════════════════════════════ */
  refunds: {
    title: "Cancellation & Refund Policy",
    description:
      "Refund policy for Japanese with Avnish premium passes and digital products.",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        body: `<p>We want you to be satisfied with your Japanese with Avnish experience. This policy outlines our refund procedures for premium passes and one-time digital purchases.</p>`,
      },
      {
        id: "subscription-cancellation",
        heading: "Premium Pass Access",
        body: `<p>Premium passes are fixed-duration one-time purchases and do not renew automatically:</p>
        <table>
          <thead><tr><th>Pass Type</th><th>Access Duration</th></tr></thead>
          <tbody>
            <tr><td><strong>30-Day</strong></td><td>Your premium access continues for 30 days from purchase.</td></tr>
            <tr><td><strong>365-Day</strong></td><td>Your premium access continues for 365 days from purchase.</td></tr>
            <tr><td><strong>Lifetime</strong></td><td>Lifetime access continues indefinitely, subject to continued operation of the Service.</td></tr>
          </tbody>
        </table>
        <p>Because these passes do not renew automatically, there is no cancellation workflow for 30-day or 365-day passes.</p>`,
      },
      {
        id: "refund-policy",
        heading: "Refund Policy",
        body: `<h3>30-Day Passes</h3>
        <p>30-day premium passes are <strong>non-refundable</strong> once access has been granted.</p>
        <h3>365-Day Passes</h3>
        <p>If you request a refund within the <strong>first 7 days</strong> of purchase and have not completed more than 5 lessons, you may request a full refund. After 7 days, 365-day passes are non-refundable, but your access continues until the pass expires.</p>
        <h3>Lifetime Passes</h3>
        <p>Lifetime passes include a <strong>7-day cooling-off period</strong>. If you request a refund within 7 days of purchase and have not completed more than 5 lessons, we will issue a full refund. After 7 days, lifetime purchases are final and non-refundable.</p>
        <h3>One-Time Bundle Purchases (Legacy)</h3>
        <p>Due to the nature of digital products, all one-time digital bundle purchases are <strong>final and non-refundable</strong> once access has been granted.</p>`,
      },
      {
        id: "exceptions",
        heading: "Exceptions",
        body: `<p>We will consider refunds outside of the above policy in the following cases:</p>
        <ul>
          <li><strong>Technical Issues:</strong> If you are unable to access your purchased content due to a persistent technical issue on our end that we cannot resolve within 72 hours.</li>
          <li><strong>Duplicate Charges:</strong> If you were charged more than once for the same subscription or purchase.</li>
          <li><strong>Unauthorized Transactions:</strong> If a charge was made without your authorization.</li>
        </ul>`,
      },
      {
        id: "how-to-request",
        heading: "How to Request a Refund",
        body: `<p>To request a refund:</p>
        <ol>
          <li>Email us at <a href="mailto:support@japanesewithavnish.com" class="text-primary hover:underline">support@japanesewithavnish.com</a> with the subject line <strong>"Refund Request"</strong></li>
          <li>Include your registered email address, order/subscription ID, and reason for the refund</li>
          <li>We will review your request and respond within <strong>3-5 business days</strong></li>
        </ol>
        <p>Approved refunds are processed to the original payment method within <strong>7-10 business days</strong>, depending on your bank or payment provider.</p>`,
      },
      {
        id: "before-purchase",
        heading: "Before You Purchase",
        body: `<p>We encourage you to:</p>
        <ul>
          <li>Explore our free tier content to ensure our platform is right for you</li>
          <li>Take our free <a href="/quiz" class="text-primary hover:underline">JLPT Placement Quiz</a> to find your level</li>
          <li>Review plan details on our <a href="/pricing" class="text-primary hover:underline">Pricing page</a></li>
          <li>Contact us with any questions before purchasing</li>
        </ul>`,
      },
      {
        id: "contact",
        heading: "Contact",
        body: `<p>For refund or cancellation questions, contact us at <a href="mailto:support@japanesewithavnish.com" class="text-primary hover:underline">support@japanesewithavnish.com</a> or visit our <a href="/contact" class="text-primary hover:underline">Contact page</a>.</p>`,
      },
    ],
  },

  /* ═══════════════════════════════════════════════════════════
     COOKIE POLICY
     ═══════════════════════════════════════════════════════════ */
  cookies: {
    title: "Cookie Policy",
    description:
      "How Japanese with Avnish uses cookies and local storage on our learning platform.",
    sections: [
      {
        id: "what-are-cookies",
        heading: "What Are Cookies?",
        body: `<p>Cookies are small text files stored on your device when you visit a website. They help us provide you with a better experience by remembering your preferences and login state.</p>`,
      },
      {
        id: "cookies-we-use",
        heading: "Cookies We Use",
        body: `<table>
          <thead><tr><th>Cookie / Storage</th><th>Type</th><th>Purpose</th><th>Duration</th></tr></thead>
          <tbody>
            <tr><td><strong>session_token</strong></td><td>Essential</td><td>Keeps you logged in</td><td>7 days</td></tr>
            <tr><td><strong>admin_session</strong></td><td>Essential</td><td>Admin panel authentication</td><td>Session</td></tr>
            <tr><td><strong>theme_preference</strong></td><td>Functional</td><td>Remembers your display preferences</td><td>1 year</td></tr>
            <tr><td><strong>localStorage (progress)</strong></td><td>Functional</td><td>Caches learning progress for faster page loads</td><td>Persistent</td></tr>
          </tbody>
        </table>`,
      },
      {
        id: "third-party-cookies",
        heading: "Third-Party Cookies",
        body: `<p>Our payment partners (Stripe and Razorpay) may set their own cookies during the checkout process to prevent fraud and process payments securely. These cookies are governed by their respective privacy policies.</p>
        <p>We do not currently use third-party advertising or analytics cookies.</p>`,
      },
      {
        id: "managing-cookies",
        heading: "Managing Cookies",
        body: `<p>You can control cookies through your browser settings. Most browsers allow you to:</p>
        <ul>
          <li>View and delete existing cookies</li>
          <li>Block all cookies or third-party cookies</li>
          <li>Set preferences for specific websites</li>
        </ul>
        <p><strong>Note:</strong> Disabling essential cookies will prevent you from logging in and using core features of our platform.</p>`,
      },
      {
        id: "changes",
        heading: "Changes to This Policy",
        body: `<p>We may update this Cookie Policy periodically. Changes will be reflected on this page with an updated effective date.</p>`,
      },
      {
        id: "contact",
        heading: "Contact",
        body: `<p>Questions about our use of cookies? Contact us at <a href="mailto:support@japanesewithavnish.com" class="text-primary hover:underline">support@japanesewithavnish.com</a>.</p>`,
      },
    ],
  },
};

const ALL_POLICIES = [
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "terms", label: "Terms of Service" },
  { slug: "refunds", label: "Cancellation & Refunds" },
  { slug: "cookies", label: "Cookie Policy" },
];

/* ── SEO metadata ─────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) return {};
  return {
    title: `${policy.title} | Japanese with Avnish`,
    description: policy.description,
  };
}

/* ── Page Component ───────────────────────────────────────── */

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Breadcrumb */}
        <nav className="text-sm text-secondary mb-8">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{policy.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
          {/* ── Sidebar ──────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {/* Other Policies */}
              <div className="card p-5">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[.1em] mb-3">
                  Legal
                </h3>
                <ul className="space-y-1.5">
                  {ALL_POLICIES.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/policies/${p.slug}`}
                        className={`block text-[13px] py-1.5 px-3 rounded-lg transition-colors ${
                          p.slug === slug
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-secondary hover:text-charcoal hover:bg-[var(--divider)]/30"
                        }`}
                      >
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Table of Contents */}
              <div className="card p-5">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[.1em] mb-3">
                  On This Page
                </h3>
                <ul className="space-y-1">
                  {policy.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="block text-[12px] text-secondary hover:text-primary py-1 transition-colors"
                      >
                        {s.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Need Help? */}
              <div className="card p-5 bg-primary/5 border-primary/15">
                <h3 className="font-heading text-sm font-bold text-charcoal mb-2">
                  Need Help?
                </h3>
                <p className="text-secondary text-xs mb-3">
                  Have questions about our policies? We are happy to help.
                </p>
                <Link
                  href="/contact"
                  className="text-primary text-xs font-semibold hover:underline"
                >
                  Contact Support →
                </Link>
              </div>
            </div>
          </aside>

          {/* ── Main Content ─────────────────────────────── */}
          <div className="card p-6 sm:p-10">
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-3">
              {policy.title}
            </h1>
            <p className="text-secondary text-sm mb-8">
              Last updated: <time>{EFFECTIVE_DATE}</time>
            </p>

            {/* Mobile: quick nav */}
            <div className="lg:hidden mb-8">
              <details className="group">
                <summary className="text-sm font-semibold text-primary cursor-pointer flex items-center gap-2">
                  <span>📑</span> Jump to section
                  <svg
                    className="w-4 h-4 transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <ul className="mt-3 space-y-1 pl-6 border-l-2 border-[var(--divider)]">
                  {policy.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="block text-[13px] text-secondary hover:text-primary py-1"
                      >
                        {s.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            {/* Sections */}
            <div className="space-y-10">
              {policy.sections.map((section, i) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="font-heading text-xl font-bold text-charcoal mb-3 flex items-baseline gap-3">
                    <span className="text-primary/40 text-sm font-mono">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {section.heading}
                  </h2>
                  <div
                    className="prose prose-sm max-w-none text-secondary leading-relaxed
                      [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-charcoal [&_h3]:mt-4 [&_h3]:mb-2
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:my-3
                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:my-3
                      [&_li]:text-sm
                      [&_p]:mb-3
                      [&_table]:w-full [&_table]:text-sm [&_table]:my-4
                      [&_th]:text-left [&_th]:text-charcoal [&_th]:font-semibold [&_th]:py-2 [&_th]:px-3 [&_th]:bg-[var(--base)] [&_th]:border-b [&_th]:border-[var(--divider)]
                      [&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-[var(--divider)]
                      [&_strong]:text-charcoal [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: section.body }}
                  />
                </section>
              ))}
            </div>

            {/* Bottom nav */}
            <div className="mt-12 pt-8 border-t border-[var(--divider)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {ALL_POLICIES.filter((p) => p.slug !== slug).map((p) => (
                  <Link
                    key={p.slug}
                    href={`/policies/${p.slug}`}
                    className="text-xs text-secondary border border-[var(--divider)] px-3 py-1.5 rounded-full hover:border-primary hover:text-primary transition-colors"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
              <Link
                href="/contact"
                className="text-primary text-sm font-semibold hover:underline"
              >
                Questions? Contact us →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
