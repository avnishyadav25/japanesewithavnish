"use client";

import { useState } from "react";
import Link from "next/link";
import { WritingPracticeModal } from "@/components/learn/WritingPracticeModal";


// 46 Main Hiragana organized by columns: A, I, U, E, O for rows
const MAIN_HIRAGANA_ROWS = [
  // row name, characters
  { row: "A", items: [{ char: "あ", romaji: "a", strokes: 3 }, { char: "い", romaji: "i", strokes: 2 }, { char: "う", romaji: "u", strokes: 2 }, { char: "え", romaji: "e", strokes: 2 }, { char: "お", romaji: "o", strokes: 3 }] },
  { row: "K", items: [{ char: "か", romaji: "ka", strokes: 3 }, { char: "き", romaji: "ki", strokes: 4 }, { char: "く", romaji: "ku", strokes: 1 }, { char: "け", romaji: "ke", strokes: 3 }, { char: "こ", romaji: "ko", strokes: 2 }] },
  { row: "S", items: [{ char: "さ", romaji: "sa", strokes: 3 }, { char: "し", romaji: "shi", strokes: 1 }, { char: "す", romaji: "su", strokes: 2 }, { char: "せ", romaji: "se", strokes: 3 }, { char: "そ", romaji: "so", strokes: 1 }] },
  { row: "T", items: [{ char: "た", romaji: "ta", strokes: 4 }, { char: "ち", romaji: "chi", strokes: 2 }, { char: "つ", romaji: "tsu", strokes: 1 }, { char: "て", romaji: "te", strokes: 1 }, { char: "と", romaji: "to", strokes: 2 }] },
  { row: "N", items: [{ char: "な", romaji: "na", strokes: 4 }, { char: "に", romaji: "ni", strokes: 3 }, { char: "ぬ", romaji: "nu", strokes: 2 }, { char: "ね", romaji: "ne", strokes: 2 }, { char: "の", romaji: "no", strokes: 1 }] },
  { row: "H", items: [{ char: "は", romaji: "ha", strokes: 3 }, { char: "ひ", romaji: "hi", strokes: 1 }, { char: "ふ", romaji: "fu", strokes: 4 }, { char: "へ", romaji: "he", strokes: 1 }, { char: "ほ", romaji: "ho", strokes: 4 }] },
  { row: "M", items: [{ char: "ま", romaji: "ma", strokes: 3 }, { char: "み", romaji: "mi", strokes: 2 }, { char: "む", romaji: "mu", strokes: 3 }, { char: "め", romaji: "me", strokes: 2 }, { char: "も", romaji: "mo", strokes: 3 }] },
  { row: "Y", items: [{ char: "や", romaji: "ya", strokes: 3 }, null, { char: "ゆ", romaji: "yu", strokes: 2 }, null, { char: "よ", romaji: "yo", strokes: 2 }] },
  { row: "R", items: [{ char: "ら", romaji: "ra", strokes: 2 }, { char: "り", romaji: "ri", strokes: 2 }, { char: "る", romaji: "ru", strokes: 1 }, { char: "れ", romaji: "re", strokes: 2 }, { char: "ろ", romaji: "ro", strokes: 1 }] },
  { row: "W", items: [{ char: "わ", romaji: "wa", strokes: 2 }, null, null, null, { char: "を", romaji: "wo", strokes: 3 }] },
  { row: "N", items: [{ char: "ん", romaji: "n", strokes: 1 }, null, null, null, null] }
];

// Dakuten & Handakuten
const DAKUTEN_ROWS = [
  { row: "G", items: [{ char: "が", romaji: "ga", strokes: 5 }, { char: "ぎ", romaji: "gi", strokes: 6 }, { char: "ぐ", romaji: "gu", strokes: 3 }, { char: "げ", romaji: "ge", strokes: 5 }, { char: "ご", romaji: "go", strokes: 4 }] },
  { row: "Z", items: [{ char: "ざ", romaji: "za", strokes: 5 }, { char: "じ", romaji: "ji", strokes: 3 }, { char: "ず", romaji: "zu", strokes: 4 }, { char: "ぜ", romaji: "ze", strokes: 5 }, { char: "ぞ", romaji: "zo", strokes: 3 }] },
  { row: "D", items: [{ char: "だ", romaji: "da", strokes: 6 }, { char: "ぢ", romaji: "dji/ji", strokes: 4 }, { char: "づ", romaji: "dzu/zu", strokes: 3 }, { char: "で", romaji: "de", strokes: 3 }, { char: "ど", romaji: "do", strokes: 4 }] },
  { row: "B", items: [{ char: "ば", romaji: "ba", strokes: 5 }, { char: "び", romaji: "bi", strokes: 3 }, { char: "ぶ", romaji: "bu", strokes: 6 }, { char: "べ", romaji: "be", strokes: 3 }, { char: "ぼ", romaji: "bo", strokes: 6 }] },
  { row: "P", items: [{ char: "ぱ", romaji: "pa", strokes: 4 }, { char: "ぴ", romaji: "pi", strokes: 2 }, { char: "ぷ", romaji: "pu", strokes: 5 }, { char: "ぺ", romaji: "pe", strokes: 2 }, { char: "ぽ", romaji: "po", strokes: 5 }] }
];

// Yoon (Combinations)
const YOON_GROUPS = [
  { row: "K/S", items: [{ char: "きゃ", romaji: "kya" }, { char: "きゅ", romaji: "kyu" }, { char: "きょ", romaji: "kyo" }, { char: "しゃ", romaji: "sha" }, { char: "しゅ", romaji: "shu" }, { char: "しょ", romaji: "sho" }] },
  { row: "T/N", items: [{ char: "ちゃ", romaji: "cha" }, { char: "ちゅ", romaji: "chu" }, { char: "ちょ", romaji: "cho" }, { char: "にゃ", romaji: "nya" }, { char: "にゅ", romaji: "nyu" }, { char: "にょ", romaji: "nyo" }] },
  { row: "H/M", items: [{ char: "ひゃ", romaji: "hya" }, { char: "ひゅ", romaji: "hyu" }, { char: "ひょ", romaji: "hyo" }, { char: "みゃ", romaji: "mya" }, { char: "みゅ", romaji: "myu" }, { char: "みょ", romaji: "myo" }] },
  { row: "R/G", items: [{ char: "りゃ", romaji: "rya" }, { char: "りゅ", romaji: "ryu" }, { char: "りょ", romaji: "ryo" }, { char: "ぎゃ", romaji: "gya" }, { char: "ぎゅ", romaji: "gyu" }, { char: "ぎょ", romaji: "gyo" }] },
  { row: "J/B", items: [{ char: "じゃ", romaji: "ja" }, { char: "じゅ", romaji: "ju" }, { char: "じょ", romaji: "jo" }, { char: "びゃ", romaji: "bya" }, { char: "びゅ", romaji: "byu" }, { char: "びょ", romaji: "byo" }] },
  { row: "P", items: [{ char: "ぴゃ", romaji: "pya" }, { char: "ぴゅ", romaji: "pyu" }, { char: "ぴょ", romaji: "pyo" }, null, null, null] }
];

export function HiraganaClient() {
  const [activeTab, setActiveTab] = useState<"main" | "dakuten" | "yoon">("main");

  // Drawing Modal State
  const [writingChar, setWritingChar] = useState("");
  const [writingStrokes, setWritingStrokes] = useState<number | null>(null);
  const [writingReading, setWritingReading] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenWriting = (char: string, romaji: string, strokes?: number) => {
    setWritingChar(char);
    setWritingStrokes(strokes || null);
    setWritingReading(romaji);
    setIsModalOpen(true);
  };

  const playTTS = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-[#FAF8F5] min-h-[90vh]">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Breadcrumb */}
        <nav className="text-sm text-secondary mb-4 flex items-center gap-2">
          <Link href="/learn" className="hover:text-primary transition">Learn</Link>
          <span>/</span>
          <Link href="/learn/kana" className="hover:text-primary transition">Kana Portal</Link>
          <span>/</span>
          <span className="text-charcoal font-medium">Hiragana Practice</span>
        </nav>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-charcoal mb-3">
            Hiragana Chart & Stroke Practice
          </h1>
          <p className="text-secondary max-w-xl mx-auto">
            Click on any card to hear pronunciation. Click the brush icon (✍️) to open the interactive canvas and practice drawing characters!
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center gap-3 mb-8">
          {[
            { id: "main", label: "Main Hiragana" },
            { id: "dakuten", label: "Dakuten & Handakuten" },
            { id: "yoon", label: "Yoon (Combinations)" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "main" | "dakuten" | "yoon")}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold border transition duration-200 ${
                activeTab === tab.id
                  ? "bg-primary border-primary text-white shadow-sm"
                  : "bg-white border-[var(--divider)] text-[#555] hover:border-primary hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid Sheets */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[var(--divider)] shadow-sm">
          {activeTab === "main" && (
            <div className="flex flex-col gap-3">
              {MAIN_HIRAGANA_ROWS.map((rowItem, rIdx) => (
                <div key={rIdx} className="grid grid-cols-5 gap-3 max-w-2xl mx-auto w-full">
                  {rowItem.items.map((item, cIdx) =>
                    item ? (
                      <div
                        key={cIdx}
                        onClick={() => playTTS(item.char)}
                        className="group relative flex flex-col items-center justify-between p-4 rounded-xl border border-[var(--divider)] bg-[#FAF8F5] cursor-pointer hover:border-primary hover:shadow-md transition-all text-center aspect-square"
                      >
                        <span className="text-3xl sm:text-4xl font-bold text-charcoal mb-1">
                          {item.char}
                        </span>
                        <div className="flex items-center justify-between w-full mt-2 border-t border-[var(--divider)]/40 pt-1.5 text-xs text-secondary">
                          <span className="font-mono uppercase font-semibold">{item.romaji}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWriting(item.char, item.romaji, item.strokes);
                            }}
                            className="p-1 rounded hover:bg-primary/10 text-primary hover:text-primary-dark transition font-bold"
                            title="Practice Drawing"
                          >
                            ✍️
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={cIdx} className="bg-transparent aspect-square" />
                    )
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "dakuten" && (
            <div className="flex flex-col gap-3">
              {DAKUTEN_ROWS.map((rowItem, rIdx) => (
                <div key={rIdx} className="grid grid-cols-5 gap-3 max-w-2xl mx-auto w-full">
                  {rowItem.items.map((item, cIdx) => (
                    <div
                      key={cIdx}
                      onClick={() => playTTS(item.char)}
                      className="group relative flex flex-col items-center justify-between p-4 rounded-xl border border-[var(--divider)] bg-[#FAF8F5] cursor-pointer hover:border-primary hover:shadow-md transition-all text-center aspect-square"
                    >
                      <span className="text-3xl sm:text-4xl font-bold text-charcoal mb-1">
                        {item.char}
                      </span>
                      <div className="flex items-center justify-between w-full mt-2 border-t border-[var(--divider)]/40 pt-1.5 text-xs text-secondary">
                        <span className="font-mono uppercase font-semibold">{item.romaji}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWriting(item.char, item.romaji, item.strokes);
                          }}
                          className="p-1 rounded hover:bg-primary/10 text-primary hover:text-primary-dark transition font-bold"
                          title="Practice Drawing"
                        >
                          ✍️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeTab === "yoon" && (
            <div className="flex flex-col gap-3">
              {YOON_GROUPS.map((rowItem, rIdx) => (
                <div key={rIdx} className="grid grid-cols-6 gap-3 max-w-3xl mx-auto w-full">
                  {rowItem.items.map((item, cIdx) =>
                    item ? (
                      <div
                        key={cIdx}
                        onClick={() => playTTS(item.char)}
                        className="group relative flex flex-col items-center justify-between p-3 rounded-xl border border-[var(--divider)] bg-[#FAF8F5] cursor-pointer hover:border-primary hover:shadow-md transition-all text-center aspect-square"
                      >
                        <span className="text-2xl sm:text-3xl font-bold text-charcoal mb-1">
                          {item.char}
                        </span>
                        <div className="flex items-center justify-between w-full mt-2 border-t border-[var(--divider)]/40 pt-1 text-xs text-secondary">
                          <span className="font-mono lowercase font-semibold truncate max-w-[40px]">{item.romaji}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWriting(item.char, item.romaji);
                            }}
                            className="p-0.5 rounded hover:bg-primary/10 text-primary hover:text-primary-dark transition font-bold"
                            title="Practice Drawing"
                          >
                            ✍️
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={cIdx} className="bg-transparent aspect-square" />
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WritingPracticeModal
        character={writingChar}
        characterType="hiragana"
        expectedStrokeCount={writingStrokes}
        reading={writingReading}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
