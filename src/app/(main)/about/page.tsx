import Link from "next/link";
import { sql } from "@/lib/db";

export const metadata = {
  title: "About — Japanese with Avnish",
  description: "The person and the process behind Japanese with Avnish — structured Japanese learning from N5 to N1.",
};

const JOURNEY_POST_SLUGS = [
  "my-journey-from-n5-to-n3",
  "mistakes-i-made-while-learning-japanese",
  "how-i-study-kanji-every-day",
  "what-helped-me-move-beyond-beginner-japanese",
  "building-japanese-with-avnish-as-a-learner",
];

const CONTENT_PROCESS_STEPS = [
  { title: "AI-assisted draft", body: "Every lesson, blog post, or vocabulary set starts as an AI-assisted first draft, built from a structured JLPT curriculum outline rather than free-form generation." },
  { title: "Automated language and curriculum checks", body: "Drafts are checked for accuracy — correct readings, natural phrasing, JLPT-appropriate grammar and vocabulary — and cross-checked against where the content sits in the N5→N1 progression, so nothing is introduced before its prerequisites." },
  { title: "Founder review and approval", body: "I personally review and approve content before it goes live — nothing is published on autopilot." },
  { title: "External educator review", body: "Available on selected content and expanding over time — dedicated Japanese-language educators are being brought on to give every level a second set of expert eyes." },
  { title: "Published", body: "Once approved, it's published to the site and becomes part of the structured curriculum you're learning from." },
];

export default async function AboutPage() {
  let journeyPosts: { slug: string; title: string }[] = [];

  if (sql) {
    const postRows = await sql`SELECT slug, title FROM posts WHERE status = 'published' AND slug = ANY(${JOURNEY_POST_SLUGS})`;
    const rows = (postRows as { slug: string; title: string }[]) ?? [];
    journeyPosts = JOURNEY_POST_SLUGS.map((slug) => rows.find((r) => r.slug === slug)).filter(
      (p): p is { slug: string; title: string } => Boolean(p)
    );
  }

  return (
    <div className="bg-[#FAF8F5] japanese-wave-bg">
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1000px] mx-auto">
          <p className="japanese-kanji-accent text-sm mb-2 text-center">私について</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-6 text-center">
            About Japanese with Avnish
          </h1>

          <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
            <h2 className="font-heading text-xl font-bold text-charcoal mb-3">Hi, I&apos;m Avnish.</h2>
            <p className="text-secondary leading-relaxed mb-3">
              I started learning Japanese the same way most of you probably are — one grammar point, one kanji, one
              small win at a time. Japanese with Avnish grew out of that process: the notes, the structure, and the
              systems I built for myself to actually get from N5 toward N1, instead of bouncing between apps and
              never finishing a level.
            </p>
            <p className="text-secondary leading-relaxed">
              This site is a JLPT curriculum built the way I wish I&apos;d had it from day one — structured, level by
              level, with real explanations instead of disconnected flashcards.
            </p>
          </div>

          <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
            <h2 className="font-heading text-xl font-bold text-charcoal mb-4">How the content is made</h2>
            <p className="text-secondary text-sm mb-5">
              Being upfront about this matters to me — here&apos;s exactly how a lesson goes from idea to published:
            </p>
            <ol className="space-y-4">
              {CONTENT_PROCESS_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--red-light)] text-primary font-bold text-sm flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold text-charcoal text-sm">{step.title}</p>
                    <p className="text-secondary text-sm leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
            <h2 className="font-heading text-xl font-bold text-charcoal mb-3">As the platform grows</h2>
            <p className="text-secondary leading-relaxed">
              Right now, content review is me. As Japanese with Avnish grows, the plan is to bring on dedicated
              Japanese-language educators and curriculum reviewers so every level gets a second set of expert eyes
              before publishing — I&apos;d rather tell you honestly where that process stands today than overstate it.
            </p>
          </div>

          {journeyPosts.length > 0 && (
            <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
              <h2 className="font-heading text-xl font-bold text-charcoal mb-3">My learning journey</h2>
              <p className="text-secondary text-sm mb-4">
                I write about my own N5→N3 progress on the blog — mistakes included.
              </p>
              <ul className="space-y-2">
                {journeyPosts.map((post) => (
                  <li key={post.slug}>
                    <Link href={`/blog/${post.slug}`} className="text-primary text-sm font-semibold hover:underline">
                      {post.title} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
            <h2 className="font-heading text-xl font-bold text-charcoal mb-3">Two voices on this site</h2>
            <p className="text-secondary leading-relaxed">
              You&apos;ll see two bylines across the blog: <strong className="text-charcoal">Avnish</strong> for
              personal, first-person posts about my own learning journey and how I built this platform, and{" "}
              <strong className="text-charcoal">Japanese with Avnish Editorial Team</strong> for structured lesson
              content and reference articles produced through the process above. Neither voice is meant to be
              anonymous or impersonal — it&apos;s just a way to be clear about what you&apos;re reading.
            </p>
          </div>

          <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-xs">
            <h2 className="font-heading text-xl font-bold text-charcoal mb-3">On the name</h2>
            <p className="text-secondary leading-relaxed mb-3">
              I considered rebranding this platform more than once as it grew beyond a personal project. In the end,
              I decided to keep the name <strong className="text-charcoal">Japanese with Avnish</strong> — it&apos;s
              honest about who built this and who stands behind it, even as the team behind the content grows.
            </p>
            <p className="text-secondary leading-relaxed font-semibold text-charcoal">
              Structured Japanese Learning from N5 to N1.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center mt-10">
            <Link href="/start-here" className="btn-primary">
              Find My Level
            </Link>
            <Link href="/guide" className="btn-secondary">
              Read the Site Guide
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
