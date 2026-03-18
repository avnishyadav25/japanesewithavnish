"use client";

import React, { useState, useCallback, type ReactNode } from "react";

type Meta = Record<string, unknown>;

export function TTSPlayButton({ text, lang = "ja-JP" }: { text: string; lang?: string }) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(() => {
    if (!text.trim() || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.trim());
    u.lang = lang;
    u.onstart = () => setSpeaking(true);
    u.onend = u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [text, lang]);

  if (!text.trim()) return null;
  return (
    <button
      type="button"
      onClick={speak}
      aria-label="Play pronunciation"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--divider)] bg-base hover:bg-[var(--divider)]/30 text-charcoal disabled:opacity-50"
      disabled={speaking}
    >
      {speaking ? (
        <span className="text-xs">…</span>
      ) : (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path d="M18 3a1 1 0 0 0-1.196-.98l-10 2A1 1 0 0 0 6 5v9.114A1.966 1.966 0 0 0 5 14c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2V7.82l8-1.6v5.894A1.966 1.966 0 0 0 15 13c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2V3z" />
        </svg>
      )}
    </button>
  );
}

const JAPANESE_CHAR = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3000-\u303f\uff00-\uffef]/;

/** Extract Japanese for TTS only in Combination column: short "日本語 (romaji)" style. No Example Word cells (Japanese + romaji + meaning). */
function extractWordForTTS(text: string): string | null {
  const t = text.trim();
  if (!t || t.includes("*")) return null;
  const match = t.match(/^([^(]+?)\s*\([^)]*\)\s*$/);
  if (match) {
    const w = match[1].trim().replace(/\*\*/g, "").trim();
    if (w.length > 12 || w.includes(".")) return null;
    if (/[a-zA-Z]/.test(w)) return null;
    return JAPANESE_CHAR.test(w) ? w : null;
  }
  const first = t.split(/\s+/)[0];
  if (first && first.length <= 12 && JAPANESE_CHAR.test(first) && !first.includes(".") && !/[a-zA-Z]/.test(first)) return first;
  return null;
}

function flattenNode(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(flattenNode).join("");
  if (node && typeof node === "object" && "props" in node) return flattenNode((node as { props: { children?: React.ReactNode } }).props?.children);
  return "";
}

/** For sounds content: table cell with TTS only for Japanese; icon appears after the Japanese text. */
export function SoundsTableCellWithTTS({ children, className, ...props }: { children?: ReactNode; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement>) {
  const raw = flattenNode(children);
  const word = extractWordForTTS(raw);
  const rest = word ? (() => {
    const idx = raw.indexOf(word);
    if (idx === -1) return raw;
    return raw.slice(idx + word.length).replace(/^\s*\**\s*/, "").trimStart();
  })() : "";
  return (
    <td className={className} {...props}>
      <span className="inline-flex items-center gap-2 flex-wrap">
        {word ? (
          <>
            <span>{word}</span>
            <TTSPlayButton text={word} />
            {rest && <span>{rest}</span>}
          </>
        ) : (
          <span>{children}</span>
        )}
      </span>
    </td>
  );
}

type Sentence = {
  number?: number;
  japanese?: string;
  romaji?: string;
  translation?: string;
};

type ExampleItem = {
  japanese?: string;
  romaji?: string;
  translation?: string;
  meaning?: string;
};

function ExamplesAccordion({
  examples,
  title = "Examples",
}: {
  examples: ExampleItem[];
  title?: string;
}) {
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  const expandAll = () => setOpenSet(new Set(examples.map((_, i) => i)));
  const collapseAll = () => setOpenSet(new Set());

  if (!examples.length) return null;
  return (
    <div className="mt-4 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
        <p className="text-[1rem] font-medium text-charcoal">{title}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-xs text-primary hover:underline"
          >
            Expand all
          </button>
          <span className="text-[var(--divider)]">|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs text-secondary hover:underline"
          >
            Collapse all
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {examples.map((ex, i) => {
          const isOpen = openSet.has(i);
          const hasContent = !!(ex.romaji || ex.translation || ex.meaning);
          return (
            <div
              key={i}
              className="border border-[var(--divider)] rounded-bento overflow-hidden bg-white"
            >
              <div className="w-full flex items-center justify-between gap-2 py-2 px-3">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex-1 flex items-center justify-center gap-2 text-left hover:bg-[var(--divider)]/10 transition rounded min-w-0"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-charcoal text-[1rem] truncate">
                    {ex.japanese || `Example ${i + 1}`}
                  </span>
                  <span className="shrink-0 text-secondary">
                    {isOpen ? "▼" : "▶"}
                  </span>
                </button>
                {ex.japanese && (
                  <span className="shrink-0">
                    <TTSPlayButton text={ex.japanese} />
                  </span>
                )}
              </div>
              {hasContent && (
                <div
                  className={`border-t border-[var(--divider)]/50 px-3 pb-3 pt-1 text-[1rem] ${isOpen ? "block" : "hidden"}`}
                  aria-hidden={!isOpen}
                >
                  {ex.romaji && (
                    <p className="text-secondary mb-1">{ex.romaji}</p>
                  )}
                  {(ex.translation ?? ex.meaning) && (
                    <p className="text-secondary italic">
                      {String(ex.translation ?? ex.meaning)}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type SoundChar = {
  hiragana?: string | null;
  katakana?: string | null;
  romaji?: string | null;
  meaning?: string | null;
};

function hasVal(v: string | null | undefined): boolean {
  return v != null && String(v).trim() !== "";
}

/** Characters table for sounds: hide columns that are all null, show — for null cells, TTS after Hiragana/Katakana. */
export function SoundsCharactersBlock({ meta, headingLevel = "h2" }: { meta: Meta; headingLevel?: "h2" | "h3" }) {
  const chars = Array.isArray(meta?.characters) ? (meta.characters as SoundChar[]) : [];
  if (chars.length === 0) return null;

  const hasHiragana = chars.some((c) => hasVal(c.hiragana));
  const hasKatakana = chars.some((c) => hasVal(c.katakana));
  const hasRomaji = chars.some((c) => hasVal(c.romaji));
  const hasMeaning = chars.some((c) => hasVal(c.meaning));
  if (!hasHiragana && !hasKatakana && !hasRomaji && !hasMeaning) return null;

  const Heading = headingLevel;
  return (
    <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center">
      <Heading className="text-3xl font-heading font-bold text-charcoal mb-3 scroll-mt-24">Characters</Heading>
      <div className="overflow-x-auto">
        <table className="w-full text-[1rem] border-collapse mx-auto border border-[var(--divider)]">
          <thead>
            <tr className="border-b border-[var(--divider)] bg-[var(--divider)]/20">
              {hasHiragana && (
                <th className="text-center py-2 px-2 text-secondary font-medium border border-[var(--divider)]">Hiragana</th>
              )}
              {hasKatakana && (
                <th className="text-center py-2 px-2 text-secondary font-medium border border-[var(--divider)]">Katakana</th>
              )}
              {hasRomaji && (
                <th className="text-center py-2 px-2 text-secondary font-medium border border-[var(--divider)]">Romaji</th>
              )}
              {hasMeaning && (
                <th className="text-center py-2 px-2 text-secondary font-medium border border-[var(--divider)]">Meaning</th>
              )}
            </tr>
          </thead>
          <tbody>
            {chars.map((c, i) => (
              <tr key={i} className="border-b border-[var(--divider)]/50 last:border-b-0">
                {hasHiragana && (
                  <td className="py-2 px-2 text-center text-charcoal font-medium border border-[var(--divider)]">
                    <span className="inline-flex items-center justify-center gap-2">
                      {c.hiragana != null && String(c.hiragana).trim() !== "" ? (
                        <>
                          <span>{String(c.hiragana).trim()}</span>
                          <TTSPlayButton text={String(c.hiragana).trim()} />
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </td>
                )}
                {hasKatakana && (
                  <td className="py-2 px-2 text-center text-charcoal border border-[var(--divider)]">
                    <span className="inline-flex items-center justify-center gap-2">
                      {c.katakana != null && String(c.katakana).trim() !== "" ? (
                        <>
                          <span>{String(c.katakana).trim()}</span>
                          <TTSPlayButton text={String(c.katakana).trim()} />
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </td>
                )}
                {hasRomaji && (
                  <td className="py-2 px-2 text-center text-secondary border border-[var(--divider)]">
                    {c.romaji != null && String(c.romaji).trim() !== "" ? String(c.romaji).trim() : "—"}
                  </td>
                )}
                {hasMeaning && (
                  <td className="py-2 px-2 text-center text-secondary border border-[var(--divider)]">
                    {c.meaning != null && String(c.meaning).trim() !== "" ? String(c.meaning).trim() : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function str(m: Meta, key: string): string {
  const v = m[key];
  return v != null ? String(v) : "";
}

function arr(m: Meta, key: string): string[] {
  const v = m[key];
  if (Array.isArray(v)) return v.map((x) => (x != null ? String(x) : ""));
  return [];
}

export function LessonMetaContent({
  contentType,
  meta,
  omitCharactersBlock = false,
}: {
  contentType: string;
  meta: Meta;
  omitCharactersBlock?: boolean;
}) {
  const [showRomaji, setShowRomaji] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const audioUrl = meta.audio_url != null ? String(meta.audio_url) : "";
  const audioUrls = arr(meta, "audio_urls").filter(Boolean);
  const sentences = Array.isArray(meta.sentences)
    ? (meta.sentences as Sentence[])
    : [];

  return (
    <div className="text-center max-w-3xl mx-auto">
      {/* Real-time audio: single URL */}
      {audioUrl && (
        <div className="mb-6">
          <p className="text-[1rem] text-secondary mb-1">Listen</p>
          <audio controls className="w-full max-w-md mx-auto" src={audioUrl} preload="metadata">
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Real-time audio: multiple URLs (e.g. practice test sections) */}
      {audioUrls.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-[1rem] text-secondary mb-1">Audio</p>
          {audioUrls.map((url, i) => (
            <div key={i}>
              <audio controls className="w-full max-w-md mx-auto" src={url} preload="metadata">
                Your browser does not support the audio element.
              </audio>
            </div>
          ))}
        </div>
      )}

      {/* Vocabulary: examples only (term/meaning/structure moved to LearnMarkdown) */}
      {contentType === "vocabulary" && Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center">
          <ExamplesAccordion examples={meta.examples as ExampleItem[]} title="Examples" />
        </div>
      )}

      {/* Grammar: examples only (term/meaning/structure moved to LearnMarkdown) */}
      {contentType === "grammar" && Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center">
          <ExamplesAccordion examples={meta.examples as ExampleItem[]} title="Examples" />
        </div>
      )}

      {/* Kanji: examples only (character/readings moved to LearnMarkdown) */}
      {contentType === "kanji" && Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center">
          <ExamplesAccordion examples={meta.examples as ExampleItem[]} title="Examples" />
        </div>
      )}

      {/* Listening: summary, examples, audio */}
      {contentType === "listening" && (str(meta, "summary") || (Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0)) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center">
          {str(meta, "summary") && <p className="text-charcoal mb-3">{str(meta, "summary")}</p>}
          {Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
            <ExamplesAccordion
              examples={meta.examples as ExampleItem[]}
              title="Key phrases / dialogue"
            />
          )}
        </div>
      )}

      {/* Writing: summary, examples */}
      {contentType === "writing" && (str(meta, "summary") || (Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0)) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center">
          {str(meta, "summary") && <p className="text-charcoal mb-3">{str(meta, "summary")}</p>}
          {Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
            <ExamplesAccordion
              examples={meta.examples as ExampleItem[]}
              title="Sample sentences / responses"
            />
          )}
        </div>
      )}

      {/* Sounds: characters rendered at top of page when omitCharactersBlock; otherwise inline for preview etc. */}
      {contentType === "sounds" && !omitCharactersBlock && Array.isArray(meta.characters) && (meta.characters as SoundChar[]).length > 0 && (
        <SoundsCharactersBlock meta={meta} />
      )}

      {/* Reading practice: sentences with show/hide romaji and translation */}
      {contentType === "reading" && sentences.length > 0 && (
        <div className="mb-6 space-y-4 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowRomaji((v) => !v)}
              className="text-[1rem] px-3 py-1.5 rounded-bento border border-[var(--divider)] bg-base hover:bg-[var(--divider)]/30 text-charcoal"
            >
              {showRomaji ? "Hide romaji" : "Show romaji"}
            </button>
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className="text-[1rem] px-3 py-1.5 rounded-bento border border-[var(--divider)] bg-base hover:bg-[var(--divider)]/30 text-charcoal"
            >
              {showTranslation ? "Hide translation" : "Show translation"}
            </button>
          </div>
          <ol className="space-y-4 list-decimal list-inside">
            {sentences.map((s, i) => (
              <li key={i} className="text-charcoal">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-charcoal">{s.japanese ?? ""}</span>
                  {s.japanese && <TTSPlayButton text={s.japanese} />}
                </div>
                {showRomaji && s.romaji && (
                  <p className="text-secondary text-[1rem] mt-1 ml-6">{s.romaji}</p>
                )}
                {showTranslation && s.translation && (
                  <p className="text-secondary text-[1rem] mt-1 ml-6 italic">{s.translation}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Practice test: PDF link, sections */}
      {contentType === "practice_test" && (
        <div className="mb-6 space-y-3 text-center">
          {str(meta, "pdf_url") && (
            <a
              href={str(meta, "pdf_url")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-block"
            >
              Open practice test (PDF)
            </a>
          )}
          {Array.isArray(meta.sections) && (meta.sections as { name?: string; durationMinutes?: number }[]).length > 0 && (
            <ul className="text-[1rem] text-secondary list-disc list-inside">
              {(meta.sections as { name?: string; durationMinutes?: number }[]).map((s, i) => (
                <li key={i}>
                  {s.name ?? "Section"}
                  {s.durationMinutes != null && ` — ${s.durationMinutes} min`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
