"use client";

import { useState } from "react";

const TABS = ["Kanji", "Vocab", "Mock Test"] as const;
type Tab = (typeof TABS)[number];

const KANJI_SAMPLE = {
  char: "学",
  readings: { on: "ガク", kun: "まな.ぶ" },
  meaning: "study, learning",
  compounds: [
    { word: "学校", reading: "がっこう", meaning: "school" },
    { word: "学生", reading: "がくせい", meaning: "student" },
    { word: "勉学", reading: "べんがく", meaning: "studying hard" },
  ],
};

const VOCAB_SAMPLE = [
  { word: "毎日", reading: "まいにち", meaning: "every day", jlpt: "N5" },
  { word: "練習", reading: "れんしゅう", meaning: "practice", jlpt: "N4" },
  { word: "覚える", reading: "おぼえる", meaning: "to memorize", jlpt: "N4" },
  { word: "復習", reading: "ふくしゅう", meaning: "review", jlpt: "N3" },
];

const MOCK_SAMPLE = {
  question: "彼女は毎朝ジョギングを（　）います。",
  options: ["して", "され", "させて", "しなくて"],
  correct: 0,
  explanation: "「して」is the て-form of する, used with いる for ongoing actions.",
};

export function SamplePreviewTabs() {
  const [active, setActive] = useState<Tab>("Kanji");

  return (
    <div className="border border-[var(--divider)] rounded-xl overflow-hidden mb-8">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--divider)] bg-[var(--background)]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-5 py-3 text-[13px] font-semibold transition-colors ${
              active === tab
                ? "text-primary border-b-2 border-primary bg-white -mb-px"
                : "text-[#888] hover:text-[#1A1A1A]"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="flex-1 flex items-center justify-end px-4">
          <span className="text-[11px] text-[#888] font-semibold uppercase tracking-[.06em]">
            Sample content
          </span>
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6 bg-white">
        {active === "Kanji" && (
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="text-center flex-shrink-0">
              <div className="text-[72px] font-serif leading-none text-[#1A1A1A] mb-2">
                {KANJI_SAMPLE.char}
              </div>
              <div className="text-[12px] text-[#888]">{KANJI_SAMPLE.meaning}</div>
            </div>
            <div className="flex-1">
              <div className="flex gap-4 mb-4">
                <div className="bg-[var(--background)] rounded-lg px-4 py-2 text-center">
                  <div className="text-[11px] text-[#888] font-bold uppercase mb-1">On</div>
                  <div className="text-[16px] font-bold text-[#1A1A1A]">{KANJI_SAMPLE.readings.on}</div>
                </div>
                <div className="bg-[var(--background)] rounded-lg px-4 py-2 text-center">
                  <div className="text-[11px] text-[#888] font-bold uppercase mb-1">Kun</div>
                  <div className="text-[16px] font-bold text-[#1A1A1A]">{KANJI_SAMPLE.readings.kun}</div>
                </div>
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--divider)]">
                    <th className="text-left py-1.5 text-[#888] font-semibold">Word</th>
                    <th className="text-left py-1.5 text-[#888] font-semibold">Reading</th>
                    <th className="text-left py-1.5 text-[#888] font-semibold">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {KANJI_SAMPLE.compounds.map((c) => (
                    <tr key={c.word} className="border-b border-[var(--divider)] last:border-0">
                      <td className="py-1.5 font-bold text-[#1A1A1A]">{c.word}</td>
                      <td className="py-1.5 text-[#555]">{c.reading}</td>
                      <td className="py-1.5 text-[#555]">{c.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {active === "Vocab" && (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--divider)]">
                <th className="text-left py-1.5 text-[#888] font-semibold">Word</th>
                <th className="text-left py-1.5 text-[#888] font-semibold">Reading</th>
                <th className="text-left py-1.5 text-[#888] font-semibold">Meaning</th>
                <th className="text-left py-1.5 text-[#888] font-semibold">JLPT</th>
              </tr>
            </thead>
            <tbody>
              {VOCAB_SAMPLE.map((v) => (
                <tr key={v.word} className="border-b border-[var(--divider)] last:border-0">
                  <td className="py-2 font-bold text-[#1A1A1A]">{v.word}</td>
                  <td className="py-2 text-[#555]">{v.reading}</td>
                  <td className="py-2 text-[#555]">{v.meaning}</td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--red-light)] text-primary text-[11px] font-bold">
                      {v.jlpt}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {active === "Mock Test" && (
          <div>
            <p className="text-[14px] text-[#555] mb-1 font-semibold">Grammar — Q1 of 20</p>
            <p className="text-[16px] text-[#1A1A1A] mb-5 leading-relaxed font-medium">
              {MOCK_SAMPLE.question}
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {MOCK_SAMPLE.options.map((opt, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 rounded-lg border text-[14px] font-medium ${
                    i === MOCK_SAMPLE.correct
                      ? "border-green-400 bg-green-50 text-green-800"
                      : "border-[var(--divider)] text-[#555]"
                  }`}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                  {i === MOCK_SAMPLE.correct && (
                    <span className="ml-2 text-[11px] font-bold text-green-600">✓ Correct</span>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-[var(--background)] rounded-lg px-4 py-3 text-[13px] text-[#555] border border-[var(--divider)]">
              <strong className="text-[#1A1A1A]">Explanation:</strong> {MOCK_SAMPLE.explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
