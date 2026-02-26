import Link from "next/link";

export default function ThankYouPage() {
  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-6 card p-12 sm:p-16 text-center">
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4">Thank You!</h1>
            <p className="text-secondary mb-8 max-w-md mx-auto">
              Your purchase is complete. Check your email for a link to access your library and download your materials.
            </p>
            <Link href="/library" className="btn-primary">
              Go to My Library
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
