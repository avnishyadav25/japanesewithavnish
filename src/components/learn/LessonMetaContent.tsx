"use client";

import { useState, useCallback } from "react";

type Meta = Record<string, unknown>;

function TTSPlayButton({ text, lang = "ja-JP" }: { text: string; lang?: string }) {
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

type SoundChar = {
  hiragana?: string;
  katakana?: string;
  romaji?: string;
  meaning?: string;
};

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
}: {
  contentType: string;
  meta: Meta;
}) {
  const [showRomaji, setShowRomaji] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const audioUrl = meta.audio_url != null ? String(meta.audio_url) : "";
  const audioUrls = arr(meta, "audio_urls").filter(Boolean);
  const hasAudio = !!audioUrl || audioUrls.length > 0;
  const sentences = Array.isArray(meta.sentences)
    ? (meta.sentences as Sentence[])
    : [];

  return (
    <>
      {/* Real-time audio: single URL */}
      {audioUrl && (
        <div className="mb-6">
          <p className="text-sm text-secondary mb-1">Listen</p>
          <audio controls className="w-full max-w-md" src={audioUrl} preload="metadata">
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Real-time audio: multiple URLs (e.g. practice test sections) */}
      {audioUrls.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-sm text-secondary mb-1">Audio</p>
          {audioUrls.map((url, i) => (
            <div key={i}>
              <audio controls className="w-full max-w-md" src={url} preload="metadata">
                Your browser does not support the audio element.
              </audio>
            </div>
          ))}
        </div>
      )}

      {/* Vocabulary: japanese, reading, type, meaning, examples */}
      {contentType === "vocabulary" && (str(meta, "japanese") || str(meta, "meaning")) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20">
          <div className="flex flex-wrap items-baseline gap-2 mb-2">
            {str(meta, "japanese") && (
              <>
                <span className="text-2xl font-medium text-charcoal">{str(meta, "japanese")}</span>
                {!hasAudio && <TTSPlayButton text={str(meta, "japanese")} />}
              </>
            )}
            {str(meta, "reading") && (
              <span className="text-secondary text-lg">({str(meta, "reading")})</span>
            )}
            {str(meta, "type") && (
              <span className="text-xs text-secondary border border-[var(--divider)] px-2 py-0.5 rounded">
                {str(meta, "type")}
              </span>
            )}
          </div>
          {str(meta, "meaning") && <p className="text-charcoal mb-2">{str(meta, "meaning")}</p>}
          {Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-charcoal mb-2">Examples</p>
              <ol className="space-y-2 list-decimal list-inside">
                {(meta.examples as ExampleItem[]).map((ex, i) => (
                  <li key={i} className="text-charcoal">
                    <div className="flex flex-wrap items-center gap-2">
                      {ex.japanese && <span className="font-medium">{ex.japanese}</span>}
                      {ex.japanese && <TTSPlayButton text={ex.japanese} />}
                    </div>
                    {ex.romaji && <span className="text-secondary text-sm block ml-6">{ex.romaji}</span>}
                    {(ex.translation ?? ex.meaning) && (
                      <span className="text-secondary text-sm block ml-6 italic">{String(ex.translation ?? ex.meaning)}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Grammar: grammar_form, reading, meaning, structure, examples */}
      {contentType === "grammar" && (str(meta, "grammar_form") || str(meta, "meaning")) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20">
          <div className="flex flex-wrap items-baseline gap-2 mb-2">
            {str(meta, "grammar_form") && (
              <>
                <span className="text-2xl font-medium text-charcoal">{str(meta, "grammar_form")}</span>
                {!hasAudio && <TTSPlayButton text={str(meta, "grammar_form")} />}
              </>
            )}
            {str(meta, "reading") && (
              <span className="text-secondary text-lg">({str(meta, "reading")})</span>
            )}
          </div>
          {str(meta, "meaning") && <p className="text-charcoal mb-2">{str(meta, "meaning")}</p>}
          {str(meta, "structure") && (
            <p className="text-sm text-secondary font-mono mb-3">{str(meta, "structure")}</p>
          )}
          {Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-charcoal mb-2">Examples</p>
              <ol className="space-y-2 list-decimal list-inside">
                {(meta.examples as ExampleItem[]).map((ex, i) => (
                  <li key={i} className="text-charcoal">
                    <div className="flex flex-wrap items-center gap-2">
                      {ex.japanese && <span className="font-medium">{ex.japanese}</span>}
                      {ex.japanese && <TTSPlayButton text={ex.japanese} />}
                    </div>
                    {ex.romaji && <span className="text-secondary text-sm block ml-6">{ex.romaji}</span>}
                    {(ex.translation ?? ex.meaning) && (
                      <span className="text-secondary text-sm block ml-6 italic">{String(ex.translation ?? ex.meaning)}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Kanji: character, onyomi, kunyomi, meaning, stroke_count, examples */}
      {contentType === "kanji" && (str(meta, "character") || str(meta, "meaning")) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20">
          <div className="flex flex-wrap items-baseline gap-3 mb-2">
            {str(meta, "character") && (
              <>
                <span className="text-4xl font-medium text-charcoal">{str(meta, "character")}</span>
                {!hasAudio && <TTSPlayButton text={str(meta, "character")} />}
              </>
            )}
            {str(meta, "meaning") && <span className="text-charcoal">{str(meta, "meaning")}</span>}
            {meta.stroke_count != null && (
              <span className="text-xs text-secondary">{Number(meta.stroke_count)} strokes</span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {Array.isArray(meta.onyomi) && (meta.onyomi as string[]).length > 0 && (
              <span>
                <span className="text-secondary">On: </span>
                {(meta.onyomi as string[]).join(", ")}
              </span>
            )}
            {Array.isArray(meta.kunyomi) && (meta.kunyomi as string[]).length > 0 && (
              <span>
                <span className="text-secondary">Kun: </span>
                {(meta.kunyomi as string[]).join(", ")}
              </span>
            )}
          </div>
          {Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-charcoal mb-2">Examples</p>
              <ol className="space-y-2 list-decimal list-inside">
                {(meta.examples as ExampleItem[]).map((ex, i) => (
                  <li key={i} className="text-charcoal">
                    <div className="flex flex-wrap items-center gap-2">
                      {ex.japanese && <span className="font-medium">{ex.japanese}</span>}
                      {ex.japanese && <TTSPlayButton text={ex.japanese} />}
                    </div>
                    {ex.romaji && <span className="text-secondary text-sm block ml-6">{ex.romaji}</span>}
                    {(ex.translation ?? ex.meaning) && (
                      <span className="text-secondary text-sm block ml-6 italic">{String(ex.translation ?? ex.meaning)}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Listening: summary, examples, audio */}
      {contentType === "listening" && (str(meta, "summary") || (Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0)) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20">
          {str(meta, "summary") && <p className="text-charcoal mb-3">{str(meta, "summary")}</p>}
          {Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
            <div>
              <p className="text-sm font-medium text-charcoal mb-2">Key phrases / dialogue</p>
              <ol className="space-y-2 list-decimal list-inside">
                {(meta.examples as ExampleItem[]).map((ex, i) => (
                  <li key={i} className="text-charcoal">
                    <div className="flex flex-wrap items-center gap-2">
                      {ex.japanese && <span className="font-medium">{ex.japanese}</span>}
                      {ex.japanese && <TTSPlayButton text={ex.japanese} />}
                    </div>
                    {ex.romaji && <span className="text-secondary text-sm block ml-6">{ex.romaji}</span>}
                    {(ex.translation ?? ex.meaning) && (
                      <span className="text-secondary text-sm block ml-6 italic">{String(ex.translation ?? ex.meaning)}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Writing: summary, examples */}
      {contentType === "writing" && (str(meta, "summary") || (Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0)) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20">
          {str(meta, "summary") && <p className="text-charcoal mb-3">{str(meta, "summary")}</p>}
          {Array.isArray(meta.examples) && (meta.examples as ExampleItem[]).length > 0 && (
            <div>
              <p className="text-sm font-medium text-charcoal mb-2">Sample sentences / responses</p>
              <ol className="space-y-2 list-decimal list-inside">
                {(meta.examples as ExampleItem[]).map((ex, i) => (
                  <li key={i} className="text-charcoal">
                    <div className="flex flex-wrap items-center gap-2">
                      {ex.japanese && <span className="font-medium">{ex.japanese}</span>}
                      {ex.japanese && <TTSPlayButton text={ex.japanese} />}
                    </div>
                    {ex.romaji && <span className="text-secondary text-sm block ml-6">{ex.romaji}</span>}
                    {(ex.translation ?? ex.meaning) && (
                      <span className="text-secondary text-sm block ml-6 italic">{String(ex.translation ?? ex.meaning)}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Sounds: characters (hiragana, katakana, romaji, meaning) */}
      {contentType === "sounds" && Array.isArray(meta.characters) && (meta.characters as SoundChar[]).length > 0 && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20">
          <p className="text-sm font-medium text-charcoal mb-3">Characters</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--divider)]">
                  <th className="text-left py-2 px-2 text-secondary font-medium">Hiragana</th>
                  <th className="text-left py-2 px-2 text-secondary font-medium">Katakana</th>
                  <th className="text-left py-2 px-2 text-secondary font-medium">Romaji</th>
                  <th className="text-left py-2 px-2 text-secondary font-medium">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {(meta.characters as SoundChar[]).map((c, i) => (
                  <tr key={i} className="border-b border-[var(--divider)]/50">
                    <td className="py-2 px-2 text-charcoal font-medium">{c.hiragana ?? "—"}</td>
                    <td className="py-2 px-2 text-charcoal">{c.katakana ?? "—"}</td>
                    <td className="py-2 px-2 text-secondary">{c.romaji ?? "—"}</td>
                    <td className="py-2 px-2 text-secondary">{c.meaning ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reading practice: sentences with show/hide romaji and translation */}
      {contentType === "reading" && sentences.length > 0 && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowRomaji((v) => !v)}
              className="text-sm px-3 py-1.5 rounded-bento border border-[var(--divider)] bg-base hover:bg-[var(--divider)]/30 text-charcoal"
            >
              {showRomaji ? "Hide romaji" : "Show romaji"}
            </button>
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className="text-sm px-3 py-1.5 rounded-bento border border-[var(--divider)] bg-base hover:bg-[var(--divider)]/30 text-charcoal"
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
                  <p className="text-secondary text-sm mt-1 ml-6">{s.romaji}</p>
                )}
                {showTranslation && s.translation && (
                  <p className="text-secondary text-sm mt-1 ml-6 italic">{s.translation}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Practice test: PDF link, sections */}
      {contentType === "practice_test" && (
        <div className="mb-6 space-y-3">
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
            <ul className="text-sm text-secondary list-disc list-inside">
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
    </>
  );
}
