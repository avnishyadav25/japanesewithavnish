import Link from "next/link";

export default function ThankYouPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderId = searchParams.order;

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-6 card p-8 sm:p-12">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl">
                ✓
              </div>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal">
                Payment successful!
              </h1>
              <p className="text-secondary max-w-md">
                We&apos;ve sent your access link to your email. You can also open your
                library anytime to download your bundles.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <Link href="/library" className="btn-primary">
                  Go to My Library
                </Link>
                <Link href="/learn" className="btn-secondary">
                  Continue learning
                </Link>
              </div>

              <div className="w-full mt-8 grid gap-4 sm:grid-cols-2 text-left">
                <div className="border border-[var(--divider)] rounded-bento p-4">
                  <h2 className="font-heading text-sm font-semibold text-charcoal mb-2">
                    Order details
                  </h2>
                  <p className="text-secondary text-sm">
                    <span className="font-medium text-charcoal">Order ID:</span>{" "}
                    {orderId || "Available in your email receipt"}
                  </p>
                  <p className="text-secondary text-sm mt-1">
                    <span className="font-medium text-charcoal">Access:</span> Check
                    your inbox for the confirmation email and magic link.
                  </p>
                </div>
                <div className="border border-[var(--divider)] rounded-bento p-4">
                  <h2 className="font-heading text-sm font-semibold text-charcoal mb-2">
                    Next steps
                  </h2>
                  <ul className="text-secondary text-sm space-y-1">
                    <li>Open the email we just sent you.</li>
                    <li>Click the access link to open your library.</li>
                    <li>Download your PDFs and audio to start studying.</li>
                  </ul>
                  <p className="text-secondary text-xs mt-3">
                    If you don&apos;t see the email in 5 minutes, check your spam /
                    promotions folder or use the contact email on the site.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
