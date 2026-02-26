import Link from "next/link";

export default function ThankYouPage() {
  return (
    <div className="py-24 px-4 sm:px-6 text-center">
      <div className="max-w-[600px] mx-auto">
        <h1 className="text-3xl font-bold text-charcoal mb-4">Thank You!</h1>
        <p className="text-secondary mb-8">
          Your purchase is complete. Check your email for a link to access your library and download your materials.
        </p>
        <Link href="/library" className="btn-primary">
          Go to My Library
        </Link>
      </div>
    </div>
  );
}
