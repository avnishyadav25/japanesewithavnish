"use client";

import { useEffect, useState } from "react";
import { WritingCanvas, type CharacterType } from "./WritingCanvas";

interface ExampleItem {
  word: string;
  reading: string;
  meaning: string;
}

interface WritingPracticeModalProps {
  character: string;
  characterType: CharacterType;
  expectedStrokeCount?: number | null;
  reading?: string | null;
  meaning?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WritingPracticeModal({
  character,
  characterType,
  expectedStrokeCount,
  reading,
  meaning,
  isOpen,
  onClose,
}: WritingPracticeModalProps) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<{
    meaning?: string | null;
    reading?: string | null;
    onyomi?: string[] | null;
    kunyomi?: string[] | null;
    strokeCount?: number | null;
    examples?: ExampleItem[];
  } | null>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fetch character details & examples
  useEffect(() => {
    if (!isOpen || !character) return;
    setLoading(true);
    setDetails(null);

    fetch(`/api/learn/writing/character?char=${encodeURIComponent(character)}&type=${characterType}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setDetails({
            meaning: data.meaning || meaning,
            reading: data.reading || reading,
            onyomi: data.onyomi || null,
            kunyomi: data.kunyomi || null,
            strokeCount: data.strokeCount !== undefined ? data.strokeCount : expectedStrokeCount,
            examples: data.examples || [],
          });
        }
      })
      .catch((err) => {
        console.error("[WritingPracticeModal] Fetch error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, character, characterType, meaning, reading, expectedStrokeCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[var(--base)] rounded-2xl shadow-xl border border-[var(--divider)] overflow-hidden flex flex-col my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)] bg-white sticky top-0 z-10">
          <div>
            <h3 className="font-heading text-lg font-bold text-charcoal">
              {characterType === "kanji" ? "Kanji Practice" : `${characterType.charAt(0).toUpperCase() + characterType.slice(1)} Practice`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-secondary hover:text-charcoal p-1.5 rounded-full hover:bg-[var(--divider)]/40 transition"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto max-h-[75vh] flex-1">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center bg-[#FAF8F5]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
              <p className="text-secondary text-sm">Loading details...</p>
            </div>
          ) : (
            <div className="bg-[#FAF8F5]">
              
              {/* Top Details Card */}
              <div className="p-6 bg-white border-b border-[var(--divider)]/60 text-center sm:text-left flex flex-col sm:flex-row items-center gap-6">
                {/* Big watermark character */}
                <div className="w-24 h-24 flex items-center justify-center rounded-2xl border border-[var(--divider)] bg-[#FAF8F5] select-none text-5xl font-bold text-charcoal shadow-sm shrink-0">
                  {character}
                </div>

                {/* Meta details */}
                <div className="flex-1 min-w-0">
                  {characterType === "kanji" ? (
                    <>
                      <h4 className="text-xl font-heading font-bold text-charcoal mb-1">
                        {details?.meaning || "Meaning loading..."}
                      </h4>
                      <div className="space-y-1 text-sm text-secondary">
                        {details?.onyomi && details.onyomi.length > 0 && (
                          <p>
                            <span className="font-semibold text-charcoal">On-yomi:</span> {details.onyomi.join(", ")}
                          </p>
                        )}
                        {details?.kunyomi && details.kunyomi.length > 0 && (
                          <p>
                            <span className="font-semibold text-charcoal">Kun-yomi:</span> {details.kunyomi.join(", ")}
                          </p>
                        )}
                        {details?.strokeCount != null && (
                          <p>
                            <span className="font-semibold text-charcoal">Strokes:</span> {details.strokeCount}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="text-xl font-heading font-bold text-charcoal mb-1">
                        Romaji: <span className="font-mono text-primary font-bold uppercase">{details?.reading || reading}</span>
                      </h4>
                      <p className="text-sm text-secondary">
                        {details?.strokeCount != null && (
                          <span>Stroke count: <span className="font-semibold text-charcoal">{details.strokeCount}</span></span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Drawing Practice Box */}
              <div className="p-6 flex flex-col items-center justify-center bg-white border-b border-[var(--divider)]/60">
                <p className="text-xs text-secondary mb-3 font-medium">Trace/draw inside the canvas box below:</p>
                <WritingCanvas
                  character={character}
                  characterType={characterType}
                  expectedStrokeCount={details?.strokeCount ?? expectedStrokeCount}
                  reading={details?.reading ?? reading}
                  className="w-full"
                />
              </div>

              {/* Dynamic Vocabulary Examples */}
              <div className="p-6">
                <h5 className="font-heading text-sm font-bold text-charcoal mb-4 uppercase tracking-wider">
                  Example Words containing &quot;{character}&quot;
                </h5>
                {details?.examples && details.examples.length > 0 ? (
                  <div className="space-y-3">
                    {details.examples.map((ex, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-[var(--divider)] rounded-xl flex items-center justify-between shadow-xs hover:border-primary/50 transition duration-150"
                      >
                        <div>
                          <span className="text-lg font-bold text-charcoal block">{ex.word}</span>
                          <span className="text-xs text-secondary">({ex.reading})</span>
                        </div>
                        <span className="text-sm text-secondary font-medium italic text-right max-w-[200px] truncate">
                          {ex.meaning}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-secondary italic">
                    Practice writing the character above. No direct vocabulary examples found in the database.
                  </p>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--divider)] bg-white flex justify-end sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-charcoal text-white rounded-bento text-sm font-semibold hover:bg-charcoal/90 transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
