import { notFound } from "next/navigation";
import Link from "next/link";

const POLICIES: Record<string, { title: string; content: string }> = {
  privacy: {
    title: "Privacy Policy",
    content: `
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">Information We Collect</h2>
      <p class="text-secondary mb-4">We collect your name, email, and phone when you make a purchase or sign up for our newsletter. We use this to deliver your purchases and communicate with you.</p>
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">How We Use It</h2>
      <p class="text-secondary mb-4">Your information is used to process orders, send magic links for library access, and deliver order confirmations. We do not sell your data.</p>
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">Data Storage</h2>
      <p class="text-secondary mb-4">Data is stored securely with Supabase. Payment processing is handled by Razorpay.</p>
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">Contact</h2>
      <p class="text-secondary">For privacy questions, contact us through the site.</p>
    `,
  },
  terms: {
    title: "Terms of Service",
    content: `
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">Use of Service</h2>
      <p class="text-secondary mb-4">By using Japanese with Avnish, you agree to use the service for personal learning only. Do not redistribute or share purchased materials.</p>
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">Account</h2>
      <p class="text-secondary mb-4">You are responsible for keeping your email secure. Access to your library is via magic link sent to your email.</p>
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">Changes</h2>
      <p class="text-secondary">We may update these terms. Continued use constitutes acceptance.</p>
    `,
  },
  refunds: {
    title: "Refund Policy",
    content: `
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">No Refunds</h2>
      <p class="text-secondary mb-4">All digital bundle purchases are final. Due to the nature of digital products, we do not offer refunds once access has been granted.</p>
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">Before Purchase</h2>
      <p class="text-secondary mb-4">Please review the product details and ensure the bundle is right for your level. Use our placement quiz to get a recommendation.</p>
      <h2 class="font-heading text-xl font-bold text-charcoal mt-6 mb-2">Technical Issues</h2>
      <p class="text-secondary">If you cannot access your purchases due to a technical issue, contact us and we will help resolve it.</p>
    `,
  },
};

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-6 card">
            <nav className="text-sm text-secondary mb-8">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-charcoal">{policy.title}</span>
            </nav>
            <h1 className="font-heading text-3xl font-bold text-charcoal mb-8">{policy.title}</h1>
            <div
              className="prose prose-charcoal text-secondary [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-4"
              dangerouslySetInnerHTML={{ __html: policy.content }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
