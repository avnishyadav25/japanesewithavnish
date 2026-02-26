import Link from "next/link";

export default function StartHerePage() {
  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">Start Here</h1>
          <p className="text-secondary max-w-2xl">
            Welcome to Japanese with Avnish. Whether you&apos;re a complete beginner or preparing for N1, here&apos;s how to get the most out of our resources.
          </p>
        </div>

        <div className="bento-grid">
          <div className="bento-span-4 card">
            <span className="text-4xl font-bold text-primary mb-4 block">1</span>
            <h2 className="font-heading text-xl font-bold text-charcoal mb-2">Find Your Level</h2>
            <p className="text-secondary mb-6">
              Not sure where to start? Take our 5-minute placement quiz. We&apos;ll recommend the best bundle for your current level.
            </p>
            <Link href="/quiz" className="btn-primary">Take the Quiz</Link>
          </div>
          <div className="bento-span-2 card flex flex-col justify-between">
            <span className="text-4xl font-bold text-primary mb-2 block">2</span>
            <h2 className="font-heading text-lg font-bold text-charcoal mb-2">Choose Your Bundle</h2>
            <p className="text-secondary text-sm mb-4">
              Bundles for each JLPT level (N5–N1) plus a Mega Bundle. PDFs, audio, and practice materials.
            </p>
            <Link href="/store" className="btn-secondary text-sm py-2">Browse Store</Link>
          </div>
          <div className="bento-span-2 bento-row-2 card flex flex-col justify-between">
            <span className="text-4xl font-bold text-primary mb-2 block">3</span>
            <h2 className="font-heading text-lg font-bold text-charcoal mb-2">Access Your Library</h2>
            <p className="text-secondary text-sm mb-4">
              Instant access via email after purchase. Log in anytime to download.
            </p>
            <Link href="/login" className="text-primary font-medium hover:underline">My Library →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
