import Link from "next/link";

export default function StartHerePage() {
  return (
    <div className="py-16 px-4 sm:px-6">
      <div className="max-w-[700px] mx-auto">
        <h1 className="text-3xl font-bold text-charcoal mb-4">Start Here</h1>
        <p className="text-secondary mb-6">
          Welcome to Japanese with Avnish. Whether you&apos;re a complete beginner or preparing for N1, here&apos;s how to get the most out of our resources.
        </p>

        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">1. Find Your Level</h2>
            <p className="text-secondary mb-4">
              Not sure where to start? Take our 5-minute placement quiz. We&apos;ll recommend the best bundle for your current level.
            </p>
            <Link href="/quiz" className="btn-primary">
              Take the Quiz
            </Link>
          </div>

          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">2. Choose Your Bundle</h2>
            <p className="text-secondary mb-4">
              We offer bundles for each JLPT level (N5–N1) plus a Mega Bundle with everything. Each includes PDFs, audio, and practice materials.
            </p>
            <Link href="/store" className="btn-secondary">
              Browse Store
            </Link>
          </div>

          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">3. Access Your Library</h2>
            <p className="text-secondary mb-4">
              After purchase, you&apos;ll get instant access via email. Log in anytime to download your materials.
            </p>
            <Link href="/login" className="text-primary font-medium hover:underline">
              Go to My Library →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
