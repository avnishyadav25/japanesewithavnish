"use client";

import { useState } from "react";
import Link from "next/link";
import type { AudioData, PronunciationData, DialogueData, ReadingPassageData, ResourceLinkData, NextLessonData } from "@/lib/blocks/blockTypes";
import type { LessonResolved } from "@/lib/curriculum/getLessonBlocks";
import { EmptyBlockState } from "./BlockStates";

export function AudioBlock({ data }: { data: AudioData }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
      {failed ? (
        <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">Audio unavailable — the file couldn&apos;t be loaded.</p>
      ) : (
        <audio controls loop={data.loop} src={data.audioUrl} className="w-full" onError={() => setFailed(true)} />
      )}
      {data.transcript && <p className="text-charcoal text-sm mt-3">{data.transcript}</p>}
      {data.translation && <p className="text-secondary text-xs mt-1">{data.translation}</p>}
    </div>
  );
}

const RESOURCE_TYPE_ICONS: Record<ResourceLinkData["resourceType"], string> = {
  article: "📄",
  video: "🎬",
  audio: "🎧",
  tool: "🛠️",
  pdf: "📑",
  other: "🔗",
};

export function ResourceLinkBlock({ data }: { data: ResourceLinkData }) {
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 bg-white border border-[var(--divider)] rounded-bento p-5 hover:border-primary/40 transition"
    >
      <span className="text-2xl shrink-0">{RESOURCE_TYPE_ICONS[data.resourceType] ?? "🔗"}</span>
      <div className="min-w-0">
        <p className="text-charcoal font-semibold text-sm">{data.title}</p>
        {data.description && <p className="text-secondary text-xs mt-1">{data.description}</p>}
        <p className="text-primary text-xs mt-1 font-semibold">Open resource →</p>
      </div>
    </a>
  );
}

export function NextLessonBlock({ data, lessons }: { data: NextLessonData; lessons: LessonResolved[] }) {
  const lesson = lessons[0];
  if (!lesson) return <EmptyBlockState label="The next lesson for this block is unavailable." />;
  return (
    <Link
      href={`/learn/curriculum/lesson/${lesson.slug || lesson.id}`}
      className="flex items-center justify-between gap-3 bg-white border border-primary/20 rounded-bento p-5 hover:border-primary/40 transition"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{data.note || "Next lesson"}</p>
        <p className="text-charcoal font-semibold text-sm mt-1">{lesson.title}</p>
      </div>
      <span className="text-primary text-lg shrink-0">→</span>
    </Link>
  );
}

export function PronunciationBlock({ data }: { data: PronunciationData }) {
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
      <p className="text-2xl font-bold text-charcoal">{data.targetSound}</p>
      {data.commonMistake && (
        <p className="text-red-700 text-xs mt-2">
          <span className="font-semibold">Common mistake: </span>
          {data.commonMistake}
        </p>
      )}
      <p className="text-secondary text-sm mt-2">{data.correctGuidance}</p>
      <div className="flex gap-3 mt-3">
        {data.audioSlowUrl && (
          <div>
            <p className="text-[10px] text-secondary mb-1">Slow</p>
            <audio controls src={data.audioSlowUrl} className="h-8" />
          </div>
        )}
        {data.audioNormalUrl && (
          <div>
            <p className="text-[10px] text-secondary mb-1">Normal</p>
            <audio controls src={data.audioNormalUrl} className="h-8" />
          </div>
        )}
      </div>
    </div>
  );
}

export function DialogueBlock({ data }: { data: DialogueData }) {
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5 space-y-3">
      {data.lines.map((line, i) => (
        <div key={i} className="flex gap-3">
          <span className="text-xs font-bold text-primary shrink-0 w-6">{line.speaker}</span>
          <div>
            <p className="text-charcoal text-sm">{line.japanese}</p>
            {line.furigana && <p className="text-secondary text-xs">{line.furigana}</p>}
            {line.romaji && <p className="text-secondary text-xs font-mono">{line.romaji}</p>}
            {line.translation && <p className="text-secondary text-xs italic">{line.translation}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReadingPassageBlock({ data }: { data: ReadingPassageData }) {
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
      <h3 className="font-heading font-bold text-sm text-charcoal mb-2">{data.title}</h3>
      {data.estimatedReadingMinutes && (
        <p className="text-[10px] text-secondary mb-3">{data.estimatedReadingMinutes} min read</p>
      )}
      <p className="text-charcoal text-sm leading-relaxed whitespace-pre-line">{data.passage}</p>
      {data.translation && (
        <details className="mt-3">
          <summary className="text-xs text-primary font-semibold cursor-pointer">Show translation</summary>
          <p className="text-secondary text-sm mt-2 whitespace-pre-line">{data.translation}</p>
        </details>
      )}
    </div>
  );
}
