import Link from "next/link";
import { CurriculumBrowserClient } from "./CurriculumBrowserClient";
import { getCurriculumData, getCurriculumOverview } from "@/lib/curriculum-data";

export const metadata = {
  title: "Curriculum",
  description: "Browse the full Japanese curriculum by level, module, and lesson — Japanese with Avnish",
};

export default async function LearnCurriculumPage() {
  let initialData;
  try {
    initialData = await getCurriculumData(true);
  } catch (e) {
    console.error("Curriculum SSR fetch failed:", e);
    initialData = null;
  }

  // Static shell data used only if the full personalized fetch failed.
  const overview = initialData ? null : await getCurriculumOverview().catch(() => ({ levels: [] }));

  return (
    <div className="min-h-screen bg-[var(--base)] py-8 px-4">
      <div className="max-w-[1200px] mx-auto">
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Curriculum</h1>
        <p className="text-secondary mb-6">
          Browse all levels and lessons. Your next lesson is on your{" "}
          <Link href="/learn/dashboard" className="text-primary hover:underline">dashboard</Link>.
        </p>
        {initialData ? (
          <CurriculumBrowserClient initialData={initialData} />
        ) : (
          <div className="space-y-3">
            <p className="text-secondary text-sm">
              We couldn&apos;t load your personalized progress right now. Here&apos;s the course outline:
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {(overview?.levels ?? []).map((lvl) => (
                <div key={lvl.code} className="rounded-2xl border border-[var(--divider)] bg-white p-4">
                  <h3 className="font-heading text-sm font-bold text-charcoal">{lvl.code} — {lvl.name}</h3>
                  <p className="text-secondary text-xs mt-1">Modules: {lvl.moduleCount}</p>
                  <p className="text-secondary text-xs">Lessons: {lvl.lessonCount}</p>
                </div>
              ))}
            </div>
          </div>
        )}
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
