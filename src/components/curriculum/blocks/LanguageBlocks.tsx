"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  JapaneseLearningTextData,
  KanaCharacterData,
  KanaGridData,
  VocabularySetData,
  GrammarRuleData,
  KanjiFocusData,
  ExampleSetData,
  ComparisonData,
  KanjiRadicalsData,
  SimilarKanjiData,
  MemoryAidData,
  GrammarFormationData,
  NuanceData,
  RegisterData,
  WhenNotToUseData,
  CollocationsData,
  RelatedWordsData,
} from "@/lib/blocks/blockTypes";
import type { VocabResolved, GrammarResolved, KanjiResolved, KanaResolved, ExampleResolved } from "@/lib/curriculum/getLessonBlocks";
import { TTSPlayButton } from "@/components/learn/LessonMetaContent";
import { WritingPracticeModal } from "@/components/learn/WritingPracticeModal";
import type { CharacterType } from "@/components/learn/WritingCanvas";
import { EmptyBlockState } from "./BlockStates";

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
  if (kana.length === 0) return <EmptyBlockState label="No kana characters available for this block." />;
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
  if (kana.length === 0) return <EmptyBlockState label="No kana characters available for this block." />;
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
  if (vocabulary.length === 0) return <EmptyBlockState label="No vocabulary available for this block." />;
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
  if (grammar.length === 0) return <EmptyBlockState label="No grammar rules available for this block." />;
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
  if (kanji.length === 0) return <EmptyBlockState label="No kanji available for this block." />;
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
  if (examples.length === 0) return <EmptyBlockState label="No examples available for this block." />;
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

export function KanjiRadicalsBlock({ data }: { data: KanjiRadicalsData }) {
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Radicals</h3>
      <div className="flex flex-wrap gap-3">
        {data.radicals.map((r, j) => (
          <div key={j} className="flex items-center gap-2 bg-white border border-[var(--divider)] rounded-[8px] px-3 py-2">
            <span className="text-2xl font-heading text-charcoal">{r.character}</span>
            <div className="text-sm text-secondary">
              <div>{r.meaning}</div>
              {r.strokeCount != null && <div className="text-xs">{r.strokeCount} strokes</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimilarKanjiBlock({ data, kanji }: { data: SimilarKanjiData; kanji: KanjiResolved[] }) {
  if (kanji.length === 0 && !data.note) return <EmptyBlockState label="No similar kanji available for this block." />;
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Similar kanji — don&apos;t confuse these</h3>
      <div className="space-y-3">
        {kanji.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {kanji.map((k) => (
              <div key={k.id} className="flex items-center gap-2 bg-white border border-[var(--divider)] rounded-[8px] px-3 py-2">
                <span className="text-2xl font-heading text-charcoal">{k.character}</span>
                {k.meaning && <span className="text-sm text-secondary">{k.meaning}</span>}
              </div>
            ))}
          </div>
        )}
        {data.note && <p className="text-sm text-secondary leading-relaxed">{data.note}</p>}
      </div>
    </div>
  );
}

export function MemoryAidBlock({ data }: { data: MemoryAidData }) {
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Memory aid</h3>
      <p className="text-sm text-secondary leading-relaxed italic">{data.text}</p>
    </div>
  );
}

export function GrammarFormationBlock({ data }: { data: GrammarFormationData }) {
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5 overflow-x-auto">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Formation</h3>
      <table className="w-full text-sm">
        <tbody>
          {data.variants.map((v, j) => (
            <tr key={j} className="border-b border-[var(--divider)] last:border-0">
              <td className="py-2 pr-4 font-semibold text-charcoal whitespace-nowrap align-top">{v.label}</td>
              <td className="py-2 pr-4 text-charcoal align-top">{v.form}</td>
              {v.example && <td className="py-2 text-secondary align-top">{v.example}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NuanceBlock({ data }: { data: NuanceData }) {
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Nuance</h3>
      <p className="text-sm text-secondary leading-relaxed">{data.text}</p>
    </div>
  );
}

export function RegisterBlock({ data }: { data: RegisterData }) {
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Register</h3>
      <p className="text-sm text-secondary leading-relaxed">{data.text}</p>
    </div>
  );
}

export function WhenNotToUseBlock({ data }: { data: WhenNotToUseData }) {
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">When not to use</h3>
      <p className="text-sm text-secondary leading-relaxed">{data.text}</p>
    </div>
  );
}

export function CollocationsBlock({ data }: { data: CollocationsData }) {
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Common collocations</h3>
      <ul className="space-y-1.5">
        {data.items.map((it, j) => (
          <li key={j} className="text-sm">
            <span className="font-semibold text-charcoal">{it.phrase}</span>
            {it.translation && <span className="text-secondary"> — {it.translation}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RelatedWordsBlock({ data }: { data: RelatedWordsData }) {
  return (
    <div className="bg-base border border-[var(--divider)] rounded-bento p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Related words</h3>
      <div className="space-y-2 text-sm">
        {data.synonyms && data.synonyms.length > 0 && (
          <p><span className="font-semibold text-charcoal">Synonyms: </span><span className="text-secondary">{data.synonyms.join(", ")}</span></p>
        )}
        {data.antonyms && data.antonyms.length > 0 && (
          <p><span className="font-semibold text-charcoal">Antonyms: </span><span className="text-secondary">{data.antonyms.join(", ")}</span></p>
        )}
        {data.wordFamily && data.wordFamily.length > 0 && (
          <p><span className="font-semibold text-charcoal">Word family: </span><span className="text-secondary">{data.wordFamily.join(", ")}</span></p>
        )}
      </div>
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
