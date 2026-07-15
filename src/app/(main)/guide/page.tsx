import Link from "next/link";
import { sql } from "@/lib/db";

type GuideSection = {
  id: string;
  title: string;
  slug: string | null;
  short_description: string;
  body: string | null;
  icon: string | null;
  link_href: string | null;
  link_label: string | null;
};

export const metadata = {
  title: "Site Guide — Japanese with Avnish",
  description: "A quick walkthrough of the curriculum, blog, kanji, vocabulary, Nihongo Navi, and other features of Japanese with Avnish.",
};

export default async function GuidePage() {
  let sections: GuideSection[] = [];
  if (sql) {
    const rows = await sql`
      SELECT id, title, slug, short_description, body, icon, link_href, link_label
      FROM platform_guide_sections
      WHERE published = true
      ORDER BY sort_order, created_at
    `;
    sections = rows as GuideSection[];
  }

  return (
    <div className="bg-[#FAF8F5] japanese-wave-bg">
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1000px] mx-auto text-center">
          <p className="japanese-kanji-accent text-sm mb-2">案内</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4">
            Site Guide
          </h1>
          <p className="text-secondary max-w-2xl mx-auto">
            New here? Here&apos;s a quick tour of everything Japanese with Avnish offers — the structured JLPT
            curriculum, the free libraries, the blog, and Nihongo Navi, your AI study partner.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link href="/start-here" className="btn-primary">
              Find My Level
            </Link>
            <Link href="/learn/dashboard" className="btn-secondary">
              Go to My Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-5 lg:px-6 pb-16">
        <div className="max-w-[1000px] mx-auto">
          {sections.length === 0 ? (
            <p className="text-secondary text-center py-8">
              The site guide is being set up. In the meantime, check out the{" "}
              <Link href="/learn" className="text-primary hover:underline">Learn Hub</Link>.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-5">
              {sections.map((s) => (
                <div key={s.id} className="bg-white border border-[var(--divider)] rounded-3xl p-6 shadow-xs flex flex-col">
                  <div className="flex items-start gap-3 mb-2">
                    {s.icon && <span className="text-3xl leading-none shrink-0">{s.icon}</span>}
                    <h2 className="font-heading text-lg font-bold text-charcoal">{s.title}</h2>
                  </div>
                  <p className="text-secondary text-sm leading-relaxed">{s.short_description}</p>

                  {s.body && (
                    s.slug ? (
                      <Link href={`/guide/${s.slug}`} className="text-primary text-xs font-bold hover:underline mt-3 inline-block">
                        Read more →
                      </Link>
                    ) : (
                      <details className="mt-3 group">
                        <summary className="text-primary text-xs font-bold cursor-pointer hover:underline list-none">
                          Read more <span className="inline-block transition-transform group-open:rotate-90">→</span>
                        </summary>
                        <p className="text-secondary text-sm leading-relaxed mt-2 whitespace-pre-line">{s.body}</p>
                      </details>
                    )
                  )}

                  {s.link_href && (
                    <div className="mt-4 pt-3 border-t border-[var(--divider)]/60">
                      <Link href={s.link_href} className="text-primary text-sm font-bold hover:underline">
                        {s.link_label || "Learn more"} →
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
