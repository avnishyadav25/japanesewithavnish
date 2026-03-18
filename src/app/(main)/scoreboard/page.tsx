import Link from "next/link";
import { ScoreboardClient } from "./ScoreboardClient";

export const metadata = {
  title: "Scoreboard",
  description: "Top streaks and points — Japanese with Avnish",
};

export default function ScoreboardPage() {
  return (
    <div className="min-h-screen bg-[var(--base)] py-12 px-4">
      <div className="max-w-[600px] mx-auto">
        <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Scoreboard</h1>
        <p className="text-secondary mb-6">
          Top learners by streak and points. Sign in, turn on &quot;Show me on the scoreboard&quot; in settings, and study to climb the board.
        </p>
        <ScoreboardClient />
        <Link href="/learn/dashboard" className="text-primary font-medium text-sm mt-6 inline-block hover:underline">
          My progress →
        </Link>
      </div>
    </div>
  );
}
