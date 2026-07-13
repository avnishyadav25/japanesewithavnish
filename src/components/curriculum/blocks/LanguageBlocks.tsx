"use client";

import { useState } from "react";
import Link from "next/link";
import type { JapaneseLearningTextData, KanaCharacterData, KanaGridData, VocabularySetData, GrammarRuleData, KanjiFocusData, ExampleSetData, ComparisonData } from "@/lib/curriculum/blockTypes";
import type { VocabResolved, GrammarResolved, KanjiResolved, KanaResolved, ExampleResolved } from "@/lib/curriculum/getLessonBlocks";
import { TTSPlayButton } from "@/components/learn/LessonMetaContent";
import { WritingPracticeModal } from "@/components/learn/WritingPracticeModal";
import type { CharacterType } from "@/components/learn/WritingCanvas";

export function JapaneseLearningTextBlock({ data }: { data: JapaneseLearningTextData }) {
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-charcoal text-lg font-semibold">{data.japanese}</p>
        {data.japanese && <TTSPlayButton text={data.japanese} />}
      </div>
      {data.showFurigana !== false && data.furigana && <p className="text-secondary text-xs mt-1">{data.furigana}</p>}
      {data.showRomaji !== false && data.romaji && <p className="text-secondary text-xs font-mono mt-0.5">{data.romaji}</p>}
      <p className="text-charcoal text-sm mt-2">{data.meaning}</p>
      {data.notes && <p className="text-secondary text-xs mt-2 italic">{data.notes}</p>}
    </div>
  );
}

export function KanaCharacterBlock({ kana }: { data: KanaCharacterData; kana: KanaResolved[] }) {
  const [practiceChar, setPracticeChar] = useState<{ character: string; characterType: CharacterType } | null>(null);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {kana.map((k) => (
        <button
          key={k.id}
          type="button"
          onClick={() => setPracticeChar({ character: k.character, characterType: k.type === "katakana" ? "katakana" : "hiragana" })}
          className="bg-white border border-[var(--divider)] rounded-bento p-4 text-center hover:border-primary/40 transition"
        >
          <p className="text-3xl font-bold text-charcoal">{k.character}</p>
          <p className="text-secondary text-xs font-mono mt-1">{k.romaji}</p>
        </button>
      ))}
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

export function KanaGridBlock({ data, kana }: { data: KanaGridData; kana: KanaResolved[] }) {
  const [practiceChar, setPracticeChar] = useState<{ character: string; characterType: CharacterType } | null>(null);
  const rows = new Map<string, KanaResolved[]>();
  for (const k of kana) {
    const key = k.rowLabel || "";
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(k);
  }
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5 overflow-x-auto">
      <table className="w-full text-center">
        <tbody>
          {Array.from(rows.entries()).map(([label, items]) => (
            <tr key={label} className="border-b border-[var(--divider)]/40 last:border-0">
              <td className="text-xs text-secondary font-semibold pr-3">{label}</td>
              {items.map((k) => (
                <td key={k.id} className="p-2">
                  <button
                    type="button"
                    onClick={() => setPracticeChar({ character: k.character, characterType: k.type === "katakana" ? "katakana" : "hiragana" })}
                    className="text-xl font-bold text-charcoal block hover:text-primary transition"
                  >
                    {k.character}
                  </button>
                  {data.showRomaji !== false && <span className="text-secondary text-[10px] font-mono">{k.romaji}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

export function VocabularySetBlock({ data, vocabulary }: { data: VocabularySetData; vocabulary: VocabResolved[] }) {
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
      <h3 className="font-heading font-bold text-sm text-charcoal mb-3">Vocabulary</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {vocabulary.map((v) => (
          <div key={v.id} className="border border-[var(--divider)] rounded-xl p-3 hover:border-primary/40 transition flex items-start justify-between gap-2">
            <Link href={`/learn/vocabulary/${v.slug}`} className="min-w-0 block">
              <p className="text-charcoal font-semibold text-sm">
                {v.word} {data.showRomaji !== false && v.reading ? `(${v.reading})` : ""}
              </p>
              {data.showMeaning !== false && <p className="text-secondary text-xs mt-0.5">{v.meaning}</p>}
            </Link>
            {v.word && <TTSPlayButton text={v.word} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GrammarRuleBlock({ grammar }: { data: GrammarRuleData; grammar: GrammarResolved[] }) {
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
      <h3 className="font-heading font-bold text-sm text-charcoal mb-3">Grammar</h3>
      <div className="space-y-3">
        {grammar.map((g) => (
          <div key={g.id} className="flex items-start justify-between gap-2 border-b border-[var(--divider)]/40 pb-3 last:border-0 last:pb-0">
            <Link href={`/learn/grammar/${g.slug}`} className="min-w-0 block">
              <p className="text-primary font-bold text-sm hover:underline">{g.pattern}</p>
              {g.structure && <p className="text-secondary text-xs font-mono mt-0.5">{g.structure}</p>}
            </Link>
            {g.pattern && <TTSPlayButton text={g.pattern} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KanjiFocusBlock({ kanji }: { data: KanjiFocusData; kanji: KanjiResolved[] }) {
  const [practiceChar, setPracticeChar] = useState<string | null>(null);
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {kanji.map((k) => (
        <div key={k.id} className="bg-white border border-[var(--divider)] rounded-bento p-4 hover:border-primary/40 transition">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-3">
              <button
                type="button"
                onClick={() => setPracticeChar(k.character)}
                className="text-3xl font-bold text-charcoal hover:text-primary transition"
                title="Practice this kanji"
              >
                {k.character}
              </button>
              <Link href={`/learn/kanji/${k.slug}`} className="text-secondary text-sm hover:text-primary hover:underline">
                {k.meaning}
              </Link>
            </div>
            {k.character && <TTSPlayButton text={k.character} />}
          </div>
          <div className="text-[10px] text-secondary mt-2 space-y-0.5">
            {k.onyomi && k.onyomi.length > 0 && <p>On: {k.onyomi.join("、")}</p>}
            {k.kunyomi && k.kunyomi.length > 0 && <p>Kun: {k.kunyomi.join("、")}</p>}
          </div>
        </div>
      ))}
      {practiceChar && (
        <WritingPracticeModal
          character={practiceChar}
          characterType="kanji"
          isOpen={!!practiceChar}
          onClose={() => setPracticeChar(null)}
        />
      )}
    </div>
  );
}

export function ExampleSetBlock({ data, examples }: { data: ExampleSetData; examples: ExampleResolved[] }) {
  return (
    <div className="space-y-3">
      {examples.map((ex) => (
        <div key={ex.id} className="bg-white border border-[var(--divider)] rounded-bento p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-charcoal text-sm font-semibold">{ex.sentenceJa}</p>
            {ex.sentenceJa && <TTSPlayButton text={ex.sentenceJa} />}
          </div>
          {!data.hideRomaji && ex.sentenceRomaji && <p className="text-secondary text-xs mt-1 font-mono">{ex.sentenceRomaji}</p>}
          <p className="text-secondary text-xs mt-1">{ex.sentenceEn}</p>
          {ex.notes && <p className="text-secondary text-xs mt-1 italic">{ex.notes}</p>}
        </div>
      ))}
    </div>
  );
}

export function ComparisonBlock({ data }: { data: ComparisonData }) {
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-secondary border-b border-[var(--divider)]">
            <th className="py-2 pr-4">Pattern</th>
            <th className="py-2 pr-4">Meaning</th>
            <th className="py-2">Usage</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--divider)]/40 last:border-0">
              <td className="py-2 pr-4 font-semibold text-charcoal">{r.pattern}</td>
              <td className="py-2 pr-4 text-secondary">{r.meaning}</td>
              <td className="py-2 text-secondary">{r.usage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
