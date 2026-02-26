import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-charcoal mb-4">
            Learn Japanese the Right Way
          </h1>
          <p className="text-xl text-secondary max-w-2xl mx-auto mb-8">
            Premium JLPT resources from N5 to N1. Structured bundles, placement quiz, and lessons to help you pass.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/quiz" className="btn-primary text-center">
              Take the Placement Quiz
            </Link>
            <Link href="/store" className="btn-secondary text-center">
              Browse Bundles
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-y border-[var(--divider)]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-charcoal mb-8 text-center">
            Start Your Journey
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">1</div>
              <h3 className="font-bold text-charcoal mb-2">Take the Quiz</h3>
              <p className="text-secondary text-sm">
                Find your level in 5 minutes. Get a personalized bundle recommendation.
              </p>
              <Link href="/quiz" className="text-primary font-medium text-sm mt-2 inline-block hover:underline">
                Start Quiz →
              </Link>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">2</div>
              <h3 className="font-bold text-charcoal mb-2">Get Your Bundle</h3>
              <p className="text-secondary text-sm">
                PDFs, audio, and resources tailored to your level. Instant access.
              </p>
              <Link href="/store" className="text-primary font-medium text-sm mt-2 inline-block hover:underline">
                View Store →
              </Link>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">3</div>
              <h3 className="font-bold text-charcoal mb-2">Study & Pass</h3>
              <p className="text-secondary text-sm">
                Access your library anytime. Download and study offline.
              </p>
              <Link href="/login" className="text-primary font-medium text-sm mt-2 inline-block hover:underline">
                My Library →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto text-center">
          <h2 className="text-2xl font-bold text-charcoal mb-4">
            JLPT N5 to N1 — Complete Coverage
          </h2>
          <p className="text-secondary mb-8 max-w-xl mx-auto">
            From beginner to advanced. Each bundle includes grammar, vocabulary, kanji, and practice materials.
          </p>
          <Link href="/jlpt/n5" className="btn-primary">
            Explore JLPT Levels
          </Link>
        </div>
      </section>
    </div>
  );
}
