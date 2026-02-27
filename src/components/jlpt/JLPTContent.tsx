"use client";

import { useSearchParams } from "next/navigation";
import { JLPTLevelTabs } from "./JLPTLevelTabs";
import { JLPTLevelOverview } from "./JLPTLevelOverview";
import { JLPTSevenDayPlan } from "./JLPTSevenDayPlan";
import { JLPTLessonsSection } from "./JLPTLessonsSection";
import { JLPTBundleCTA } from "./JLPTBundleCTA";
import { JLPTMegaHighlight } from "./JLPTMegaHighlight";
import { JLPTFAQ } from "./JLPTFAQ";
import { JLPT_LEVELS, type JLPTLevel } from "@/data/jlpt-levels";

type Post = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  jlpt_level?: string[] | null;
  tags?: string[] | null;
  published_at?: string | null;
};

interface JLPTContentProps {
  initialLevel: JLPTLevel;
  initialPosts: Post[];
  pinnedByLevel: Record<string, string[]>;
}

export function JLPTContent({
  initialLevel,
  initialPosts,
  pinnedByLevel,
}: JLPTContentProps) {
  const levelParam = useSearchParams().get("level")?.toLowerCase();
  const level: JLPTLevel =
    levelParam && JLPT_LEVELS.includes(levelParam as JLPTLevel)
      ? (levelParam as JLPTLevel)
      : initialLevel;

  const postsForLevel =
    level === initialLevel
      ? initialPosts
      : [];

  return (
    <>
      <JLPTLevelTabs active={level} />

      <div className="space-y-8 mt-8">
        <JLPTLevelOverview level={level} />
        <JLPTSevenDayPlan level={level} />
        <JLPTLessonsSection
          level={level}
          initialPosts={level === initialLevel ? initialPosts : postsForLevel}
          pinnedSlugs={pinnedByLevel[level] ?? []}
        />
        <JLPTBundleCTA level={level} />
        <JLPTMegaHighlight />
        <JLPTFAQ />
      </div>
    </>
  );
}
