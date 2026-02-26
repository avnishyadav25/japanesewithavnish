import Link from "next/link";

const isComingSoon = process.env.COMING_SOON === "true" || process.env.COMING_SOON === "1";

function ComingSoonView() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 japanese-wave-bg">
      <div className="text-center max-w-lg">
        <p className="text-primary font-medium uppercase tracking-widest text-sm mb-4">日本語</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-charcoal mb-4">
          Something Great Is Coming
        </h1>
        <p className="text-secondary text-lg mb-8">
          We&apos;re building premium Japanese learning resources — JLPT bundles, placement quiz, and more. Stay tuned.
        </p>
        <p className="text-secondary text-sm">Coming soon</p>
      </div>
    </div>
  );
}

function FullHomeView() {
  return (
    <div>
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-4 bento-row-2 card flex flex-col justify-between bg-primary text-white border-0">
              <div>
                <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
                  Learn Japanese the Right Way
                </h1>
                <p className="text-white/90 text-lg max-w-md">
                  Premium JLPT resources from N5 to N1. Structured bundles, placement quiz, and lessons.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link href="/quiz" className="bg-white text-primary px-6 py-3 rounded-button font-semibold hover:bg-white/90 transition">
                  Take the Quiz
                </Link>
                <Link href="/store" className="border-2 border-white/80 text-white px-6 py-3 rounded-button font-semibold hover:bg-white/10 transition">
                  Browse Bundles
                </Link>
              </div>
            </div>
            <div className="bento-span-2 bento-row-2 card flex flex-col justify-center items-center text-center bg-base border-[var(--divider)]">
              <span className="text-5xl font-bold text-primary mb-2">1</span>
              <h3 className="font-heading font-bold text-charcoal mb-1">Quiz</h3>
              <p className="text-secondary text-sm mb-4">Find your level</p>
              <Link href="/quiz" className="text-primary text-sm font-medium hover:underline">Start →</Link>
            </div>
            <div className="bento-span-2 bento-row-2 card flex flex-col justify-center items-center text-center bg-base border-[var(--divider)]">
              <span className="text-5xl font-bold text-primary mb-2">2</span>
              <h3 className="font-heading font-bold text-charcoal mb-1">Bundle</h3>
              <p className="text-secondary text-sm mb-4">Get resources</p>
              <Link href="/store" className="text-primary text-sm font-medium hover:underline">Store →</Link>
            </div>
            <div className="bento-span-2 bento-row-2 card flex flex-col justify-center items-center text-center bg-base border-[var(--divider)]">
              <span className="text-5xl font-bold text-primary mb-2">3</span>
              <h3 className="font-heading font-bold text-charcoal mb-1">Library</h3>
              <p className="text-secondary text-sm mb-4">Study offline</p>
              <Link href="/login" className="text-primary text-sm font-medium hover:underline">Login →</Link>
            </div>
            <div className="bento-span-4 card flex flex-col justify-center bg-white">
              <h2 className="font-heading text-xl font-bold text-charcoal mb-2">JLPT N5 to N1</h2>
              <p className="text-secondary text-sm mb-4">Complete coverage. Grammar, vocabulary, kanji.</p>
              <Link href="/jlpt/n5" className="btn-primary inline-block w-fit">Explore Levels</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  return isComingSoon ? <ComingSoonView /> : <FullHomeView />;
}
