"use client";

import { useState } from "react";
import Link from "next/link";
import { TTSPlayButton } from "@/components/learn/LessonMetaContent";
import { WritingPracticeModal } from "@/components/learn/WritingPracticeModal";
import type { CharacterType } from "@/components/learn/WritingCanvas";

type VocabItem = { id: string; word: string | null; reading: string | null; meaning: string | null; slug: string };
type GrammarItem = { id: string; pattern: string | null; structure: string | null; slug: string };
type KanjiItem = { id: string; character: string | null; meaning: string | null; onyomi: string[] | null; kunyomi: string[] | null; slug: string };
type KanaItem = { id: string; character: string; romaji: string; type: string };

export function LessonMaterialsSidebar({
  vocab,
  grammar,
  kanji,
  kana,
}: {
  vocab: VocabItem[];
  grammar: GrammarItem[];
  kanji: KanjiItem[];
  kana: KanaItem[];
}) {
  const [practiceChar, setPracticeChar] = useState<{ character: string; characterType: CharacterType } | null>(null);

  return (
    <div id="lists" className="space-y-4">
      <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-secondary pl-1">
        Lesson Materials
      </h3>

      {/* Vocabulary */}
      <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
        <h4 className="font-heading font-semibold text-xs text-charcoal mb-2">Vocabulary</h4>
        {vocab.length ? (
          <div className="space-y-2.5">
            {vocab.map((v) => (
              <div key={v.id} className="flex items-start justify-between gap-2 border-b border-[var(--divider)]/40 pb-2 last:border-0 last:pb-0">
                <div className="flex flex-col min-w-0">
                  <Link href={`/learn/vocabulary/${v.slug}`} className="text-xs font-bold text-primary hover:underline">
                    {v.word} ({v.reading})
                  </Link>
                  <span className="text-[11px] text-secondary mt-0.5">{v.meaning}</span>
                </div>
                {v.word && <TTSPlayButton text={v.word} />}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary text-xs italic">No vocabulary in this lesson.</p>
        )}
      </div>

      {/* Grammar */}
      <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
        <h4 className="font-heading font-semibold text-xs text-charcoal mb-2">Grammar</h4>
        {grammar.length ? (
          <div className="space-y-2.5">
            {grammar.map((g) => (
              <div key={g.id} className="flex items-start justify-between gap-2 border-b border-[var(--divider)]/40 pb-2 last:border-0 last:pb-0">
                <div className="flex flex-col min-w-0">
                  <Link href={`/learn/grammar/${g.slug}`} className="text-xs font-bold text-primary hover:underline">
                    {g.pattern}
                  </Link>
                  <span className="text-[11px] text-secondary mt-0.5 font-mono">{g.structure}</span>
                </div>
                {g.pattern && <TTSPlayButton text={g.pattern} />}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary text-xs italic">No grammar rules in this lesson.</p>
        )}
      </div>

      {/* Kanji */}
      <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
        <h4 className="font-heading font-semibold text-xs text-charcoal mb-2">Kanji</h4>
        {kanji.length ? (
          <div className="space-y-2.5">
            {kanji.map((k) => (
              <div key={k.id} className="flex items-start justify-between gap-2 border-b border-[var(--divider)]/40 pb-2 last:border-0 last:pb-0">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    {k.character && (
                      <button
                        type="button"
                        onClick={() => setPracticeChar({ character: k.character!, characterType: "kanji" })}
                        className="text-base font-bold text-charcoal hover:text-primary transition"
                        title="Practice this kanji"
                      >
                        {k.character}
                      </button>
                    )}
                    <Link href={`/learn/kanji/${k.slug}`} className="text-xs font-bold text-primary hover:underline">
                      — {k.meaning}
                    </Link>
                  </div>
                  {k.onyomi && k.onyomi.length > 0 && (
                    <span className="text-[10px] text-secondary mt-0.5">Onyomi: {k.onyomi.join(", ")}</span>
                  )}
                  {k.kunyomi && k.kunyomi.length > 0 && (
                    <span className="text-[10px] text-secondary">Kunyomi: {k.kunyomi.join(", ")}</span>
                  )}
                </div>
                {k.character && <TTSPlayButton text={k.character} />}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary text-xs italic">No kanji characters in this lesson.</p>
        )}
      </div>

      {/* Kana */}
      <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
        <h4 className="font-heading font-semibold text-xs text-charcoal mb-2">Kana</h4>
        {kana.length ? (
          <div className="flex flex-wrap gap-1.5">
            {kana.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setPracticeChar({ character: k.character, characterType: k.type === "katakana" ? "katakana" : "hiragana" })}
                className="px-2 py-0.5 rounded-full border border-[var(--divider)] text-charcoal bg-[var(--divider)]/10 text-[10px] font-semibold hover:border-primary hover:text-primary transition"
                title="Practice this character"
              >
                {k.character} <span className="text-secondary text-[9px] font-mono">({k.romaji})</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-secondary text-xs italic">No kana characters in this lesson.</p>
        )}
      </div>

      {practiceChar && (
        <WritingPracticeModal
          character={practiceChar.character}
          characterType={practiceChar.characterType}
          isOpen={!!practiceChar}
          onClose={() => setPracticeChar(null)}
        />
      )}
    </div>
  );
}
