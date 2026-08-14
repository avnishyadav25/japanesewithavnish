"use client";

import { useState } from "react";
import Link from "next/link";
import { WritingPracticeModal } from "@/components/learn/WritingPracticeModal";


// 46 Main Katakana organized by columns: A, I, U, E, O for rows
const MAIN_KATAKANA_ROWS = [
  { row: "A", items: [{ char: "ア", romaji: "a", strokes: 2 }, { char: "イ", romaji: "i", strokes: 2 }, { char: "ウ", romaji: "u", strokes: 3 }, { char: "エ", romaji: "e", strokes: 3 }, { char: "オ", romaji: "o", strokes: 3 }] },
  { row: "K", items: [{ char: "カ", romaji: "ka", strokes: 2 }, { char: "キ", romaji: "ki", strokes: 3 }, { char: "ク", romaji: "ku", strokes: 2 }, { char: "ケ", romaji: "ke", strokes: 3 }, { char: "コ", romaji: "ko", strokes: 2 }] },
  { row: "S", items: [{ char: "サ", romaji: "sa", strokes: 3 }, { char: "シ", romaji: "shi", strokes: 3 }, { char: "ス", romaji: "su", strokes: 2 }, { char: "セ", romaji: "se", strokes: 2 }, { char: "ソ", romaji: "so", strokes: 2 }] },
  { row: "T", items: [{ char: "タ", romaji: "ta", strokes: 3 }, { char: "チ", romaji: "chi", strokes: 3 }, { char: "ツ", romaji: "tsu", strokes: 3 }, { char: "テ", romaji: "te", strokes: 3 }, { char: "ト", romaji: "to", strokes: 2 }] },
  { row: "N", items: [{ char: "ナ", romaji: "na", strokes: 2 }, { char: "ニ", romaji: "ni", strokes: 2 }, { char: "ヌ", romaji: "nu", strokes: 2 }, { char: "ネ", romaji: "ne", strokes: 4 }, { char: "ノ", romaji: "no", strokes: 1 }] },
  { row: "H", items: [{ char: "ハ", romaji: "ha", strokes: 2 }, { char: "ヒ", romaji: "hi", strokes: 2 }, { char: "フ", romaji: "fu", strokes: 1 }, { char: "ヘ", romaji: "he", strokes: 1 }, { char: "ホ", romaji: "ho", strokes: 4 }] },
  { row: "M", items: [{ char: "マ", romaji: "ma", strokes: 2 }, { char: "ミ", romaji: "mi", strokes: 3 }, { char: "ム", romaji: "mu", strokes: 2 }, { char: "メ", romaji: "me", strokes: 2 }, { char: "モ", romaji: "mo", strokes: 3 }] },
  { row: "Y", items: [{ char: "ヤ", romaji: "ya", strokes: 2 }, null, { char: "ユ", romaji: "yu", strokes: 2 }, null, { char: "ヨ", romaji: "yo", strokes: 3 }] },
  { row: "R", items: [{ char: "ラ", romaji: "ra", strokes: 2 }, { char: "リ", romaji: "ri", strokes: 2 }, { char: "ル", romaji: "ru", strokes: 2 }, { char: "レ", romaji: "re", strokes: 1 }, { char: "ロ", romaji: "ro", strokes: 3 }] },
  { row: "W", items: [{ char: "ワ", romaji: "wa", strokes: 2 }, null, null, null, { char: "ヲ", romaji: "wo", strokes: 3 }] },
  { row: "N", items: [{ char: "ン", romaji: "n", strokes: 2 }, null, null, null, null] }
];

// Dakuten & Handakuten
const DAKUTEN_ROWS = [
  { row: "G", items: [{ char: "ガ", romaji: "ga", strokes: 4 }, { char: "ギ", romaji: "gi", strokes: 5 }, { char: "グ", romaji: "gu", strokes: 5 }, { char: "ゲ", romaji: "ge", strokes: 5 }, { char: "ゴ", romaji: "go", strokes: 4 }] },
  { row: "Z", items: [{ char: "ザ", romaji: "za", strokes: 5 }, { char: "ジ", romaji: "ji", strokes: 5 }, { char: "ズ", romaji: "zu", strokes: 4 }, { char: "ぜ", romaji: "ze", strokes: 4 }, { char: "ゾ", romaji: "zo", strokes: 5 }] },
  { row: "D", items: [{ char: "ダ", romaji: "da", strokes: 5 }, { char: "ヂ", romaji: "dji/ji", strokes: 5 }, { char: "ヅ", romaji: "dzu/zu", strokes: 5 }, { char: "デ", romaji: "de", strokes: 5 }, { char: "ド", romaji: "do", strokes: 4 }] },
  { row: "B", items: [{ char: "バ", romaji: "ba", strokes: 4 }, { char: "ビ", romaji: "bi", strokes: 4 }, { char: "ブ", romaji: "bu", strokes: 3 }, { char: "ベ", romaji: "be", strokes: 3 }, { char: "ボ", romaji: "bo", strokes: 6 }] },
  { row: "P", items: [{ char: "パ", romaji: "pa", strokes: 3 }, { char: "ピ", romaji: "pi", strokes: 3 }, { char: "プ", romaji: "pu", strokes: 2 }, { char: "ペ", romaji: "pe", strokes: 2 }, { char: "ポ", romaji: "po", strokes: 5 }] }
];

// Yoon (Combinations)
const YOON_GROUPS = [
  { row: "K/S", items: [{ char: "キャ", romaji: "kya" }, { char: "キュ", romaji: "kyu" }, { char: "キョ", romaji: "kyo" }, { char: "シャ", romaji: "sha" }, { char: "シュ", romaji: "shu" }, { char: "ショ", romaji: "sho" }] },
  { row: "T/N", items: [{ char: "チャ", romaji: "cha" }, { char: "チュ", romaji: "chu" }, { char: "チョ", romaji: "cho" }, { char: "ニャ", romaji: "nya" }, { char: "ニュ", romaji: "nyu" }, { char: "ニョ", romaji: "nyo" }] },
  { row: "H/M", items: [{ char: "ヒャ", romaji: "hya" }, { char: "ヒュ", romaji: "hyu" }, { char: "ヒョ", romaji: "hyo" }, { char: "ミャ", romaji: "mya" }, { char: "ミュ", romaji: "myu" }, { char: "ミョ", romaji: "myo" }] },
  { row: "R/G", items: [{ char: "リャ", romaji: "rya" }, { char: "リュ", romaji: "ryu" }, { char: "リョ", romaji: "ryo" }, { char: "ギャ", romaji: "gya" }, { char: "ギュ", romaji: "gyu" }, { char: "ギョ", romaji: "gyo" }] },
  { row: "J/B", items: [{ char: "ジャ", romaji: "ja" }, { char: "ジュ", romaji: "ju" }, { char: "ジョ", romaji: "jo" }, { char: "ビャ", romaji: "bya" }, { char: "ビュ", romaji: "byu" }, { char: "ビョ", romaji: "byo" }] },
  { row: "P", items: [{ char: "ピャ", romaji: "pya" }, { char: "ピュ", romaji: "pyu" }, { char: "ピョ", romaji: "pyo" }, null, null, null] }
];

export function KatakanaClient() {
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
          <span className="text-charcoal font-medium">Katakana Practice</span>
        </nav>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-charcoal mb-3">
            Katakana Chart & Stroke Practice
          </h1>
          <p className="text-secondary max-w-xl mx-auto">
            Click on any card to hear pronunciation. Click the brush icon (✍️) to open the interactive canvas and practice drawing characters!
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center gap-3 mb-8">
          {[
            { id: "main", label: "Main Katakana" },
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
              {MAIN_KATAKANA_ROWS.map((rowItem, rIdx) => (
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
        characterType="katakana"
        expectedStrokeCount={writingStrokes}
        reading={writingReading}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
