import Link from "next/link";
import { sql } from "@/lib/db";
import { clampTitle, clampDescription, canonicalUrl } from "@/lib/seo";
import { BreadcrumbListSchema } from "@/components/JsonLd";
import { MyScoreboardRank } from "./MyScoreboardRank";

const TITLE = clampTitle("Scoreboard — Top Streaks & Points | Japanese with Avnish");
const DESCRIPTION = clampDescription(
  "See the top Japanese learners by daily streak and points earned. Turn on \"Show me on the scoreboard\" in your settings to join the board."
);
const PATH = "/scoreboard";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonicalUrl(PATH), type: "website", images: ["/og-default.png"] },
};

export const revalidate = 300;

type Entry = { display_name: string | null; avatar_url: string | null; recommended_level: string | null; streak: number; points: number };

const TOP_N = 50;

async function getTopEntries(orderBy: "streak" | "points"): Promise<Entry[]> {
  if (!sql) return [];
  const rows =
    orderBy === "streak"
      ? await sql`
          SELECT p.display_name, p.avatar_url, p.recommended_level,
            COALESCE(p.current_streak, 0)::int AS streak, COALESCE(p.points, 0)::int AS points
          FROM profiles p
          WHERE p.show_on_scoreboard = TRUE AND p.is_test_user = FALSE
            AND (COALESCE(p.current_streak, 0) > 0 OR COALESCE(p.points, 0) > 0)
          ORDER BY streak DESC, points DESC
          LIMIT ${TOP_N}
        `
      : await sql`
          SELECT p.display_name, p.avatar_url, p.recommended_level,
            COALESCE(p.current_streak, 0)::int AS streak, COALESCE(p.points, 0)::int AS points
          FROM profiles p
          WHERE p.show_on_scoreboard = TRUE AND p.is_test_user = FALSE
            AND (COALESCE(p.current_streak, 0) > 0 OR COALESCE(p.points, 0) > 0)
          ORDER BY points DESC, streak DESC
          LIMIT ${TOP_N}
        `;
  return rows as Entry[];
}

function avatar(entry: Entry, rank: number, size = "w-9 h-9") {
  const name = entry.display_name?.trim() || `Learner #${rank}`;
  return entry.avatar_url?.trim() ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={entry.avatar_url} alt="" className={`${size} rounded-full object-cover flex-shrink-0 bg-[var(--divider)]`} />
  ) : (
    <span className={`${size} rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ScoreList({ entries, metric }: { entries: Entry[]; metric: "streak" | "points" }) {
  const topMetric = metric === "streak" ? "days" : "pts";
  return (
    <ul className="divide-y divide-[var(--divider)]">
      {entries.map((e, i) => {
        const rank = i + 1;
        const name = e.display_name?.trim() || `Learner #${rank}`;
        return (
          <li key={`${metric}-${rank}`} className="flex items-center gap-4 px-4 py-3">
            <span className="text-sm font-bold text-secondary w-9 text-center">#{rank}</span>
            {avatar(e, rank)}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-charcoal truncate">{name}</p>
              {e.recommended_level && <p className="text-xs text-secondary">{e.recommended_level}</p>}
            </div>
            <div className="text-right">
              <span className="font-semibold text-charcoal text-sm">{metric === "streak" ? e.streak : e.points} {topMetric}</span>
              <p className="text-[10px] text-secondary">{metric === "streak" ? `${e.points} pts` : `${e.streak} days`}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function ScoreboardPage() {
  const [byStreak, byPoints] = await Promise.all([getTopEntries("streak"), getTopEntries("points")]);
  const empty = byStreak.length === 0 && byPoints.length === 0;

  return (
    <div className="min-h-screen bg-[var(--base)] py-12 px-4">
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: canonicalUrl("/") },
          { name: "Scoreboard", url: canonicalUrl(PATH) },
        ]}
      />
      <div className="max-w-[900px] mx-auto">
        <nav className="text-sm text-secondary mb-6">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Scoreboard</span>
        </nav>
        <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Scoreboard</h1>
        <p className="text-secondary mb-6">
          Top learners by streak and points. Sign in, turn on &quot;Show me on the scoreboard&quot; in settings, and study to climb the board.
        </p>

        {empty ? (
          <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
            <p className="text-secondary text-sm">
              No one on the board yet. Turn on &quot;Show me on the scoreboard&quot; in{" "}
              <Link href="/account" className="text-primary hover:underline">My settings</Link> and keep your streak or earn points to appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
              <h2 className="font-heading font-semibold text-charcoal px-4 py-3 border-b border-[var(--divider)] bg-base/50">
                Top {TOP_N} streaks
              </h2>
              <MyScoreboardRank metric="streak" />
              <ScoreList entries={byStreak} metric="streak" />
            </section>

            <section className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
              <h2 className="font-heading font-semibold text-charcoal px-4 py-3 border-b border-[var(--divider)] bg-base/50">
                Top {TOP_N} points
              </h2>
              <MyScoreboardRank metric="points" />
              <ScoreList entries={byPoints} metric="points" />
            </section>
          </div>
        )}

        <Link href="/learn/dashboard" className="text-primary font-medium text-sm mt-6 inline-block hover:underline">
          My progress →
        </Link>
      </div>
    </div>
  );
}
