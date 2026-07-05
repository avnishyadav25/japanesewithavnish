"use client";

import { useEffect } from "react";
import { WritingCanvas, type CharacterType } from "./WritingCanvas";

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-[var(--base)] rounded-2xl shadow-xl border border-[var(--divider)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)] bg-white">
          <div>
            <h3 className="font-heading text-lg font-bold text-charcoal">
              Stroke Practice
            </h3>
            {meaning && (
              <p className="text-xs text-secondary mt-0.5">
                Meaning: <span className="font-medium text-charcoal">{meaning}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-secondary hover:text-charcoal p-1.5 rounded-full hover:bg-[var(--divider)]/40 transition"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 flex flex-col items-center justify-center bg-[#FAF8F5]">
          <WritingCanvas
            character={character}
            characterType={characterType}
            expectedStrokeCount={expectedStrokeCount}
            reading={reading}
            className="w-full"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--divider)] bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-charcoal text-white rounded-bento text-sm font-medium hover:bg-charcoal/90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
