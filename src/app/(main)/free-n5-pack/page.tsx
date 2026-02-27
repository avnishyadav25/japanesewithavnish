import Link from "next/link";
import { LeadMagnetForm } from "@/components/LeadMagnetForm";

export const metadata = {
  title: "Free N5 Kana Practice Pack | Japanese with Avnish",
  description: "Get your free N5 Hiragana and Katakana practice pack. Instant download. No spam.",
};

export default function FreeN5PackPage() {
  return (
    <div className="bg-[#FAF8F5] py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-6">
          <Link
            href="/start-here"
            className="text-sm text-secondary hover:text-primary"
          >
            ← Back to Start Here
          </Link>
        </div>

        {/* Hero */}
        <section className="max-w-2xl mb-10">
          <p className="text-primary font-medium uppercase tracking-widest text-sm mb-2">
            無料
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-3">
            Free N5 Kana Practice Pack
          </h1>
          <p className="text-secondary mb-2">
            Instant Hiragana + Katakana practice sheets for beginners.
          </p>
          <p className="text-secondary text-sm">
            はじめての方にぴったりの「ひらがな・カタカナ」練習プリントを無料でお届けします。
          </p>
        </section>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
          {/* Lead magnet card */}
          <section>
            <LeadMagnetForm />
          </section>

          {/* What’s included */}
          <section className="card">
            <h2 className="font-heading text-lg font-semibold text-charcoal mb-3">
              What&apos;s included
            </h2>
            <ul className="list-disc list-inside text-secondary text-sm space-y-1 mb-4">
              <li>Hiragana chart + handwriting practice sheets</li>
              <li>Katakana chart + handwriting practice sheets</li>
              <li>7-day kana study routine (printable)</li>
            </ul>
            <p className="text-secondary text-xs">
              We&apos;ll send the download link to your email. No spam — JLPT
              study tips only.
            </p>
          </section>
        </div>

        {/* After-download CTAs (always visible, copy still relevant post-submit) */}
        <section className="mt-10 card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-charcoal mb-1">
              Next steps after your kana pack
            </h2>
            <p className="text-secondary text-sm">
              Check your inbox, then continue with a quick level quiz or N5
              lessons.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/quiz" className="btn-primary">
              Take the placement quiz
            </Link>
            <Link
              href="/learn?level=n5"
              className="text-sm text-primary font-medium hover:underline"
            >
              Start learning N5 →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
