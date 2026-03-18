import Link from "next/link";
import { CurriculumBrowserClient } from "./CurriculumBrowserClient";

export const metadata = {
  title: "Curriculum",
  description: "Browse the full Japanese curriculum by level, module, and lesson — Japanese with Avnish",
};

export default function LearnCurriculumPage() {
  return (
    <div className="min-h-screen bg-[var(--base)] py-8 px-4">
      <div className="max-w-[720px] mx-auto">
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Curriculum</h1>
        <p className="text-secondary mb-6">
          Browse all levels and lessons. Your next lesson is on your{" "}
          <Link href="/learn/dashboard" className="text-primary hover:underline">dashboard</Link>.
        </p>
        <CurriculumBrowserClient />
        <div className="mt-8 flex gap-4">
          <Link href="/learn/dashboard" className="text-primary font-medium text-sm hover:underline">
            My progress →
          </Link>
          <Link href="/learn" className="text-primary font-medium text-sm hover:underline">
            Browse Learn content →
          </Link>
        </div>
      </div>
    </div>
  );
}
