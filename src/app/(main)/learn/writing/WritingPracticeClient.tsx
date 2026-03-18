"use client";

import { useEffect, useState } from "react";
import { WritingCanvas, type CharacterType } from "@/components/learn/WritingCanvas";

const DEFAULT_KANJI = ["日", "本", "人", "水", "火"];
const DEFAULT_HIRAGANA = ["あ", "い", "う", "え", "お"];
const DEFAULT_KATAKANA = ["ア", "イ", "ウ", "エ", "オ"];

type CharInfo = { character: string; type: CharacterType; strokeCount: number | null; reading: string | null };

export function WritingPracticeClient() {
  const [characterType, setCharacterType] = useState<CharacterType>("kanji");
  const [characters, setCharacters] = useState<string[]>(DEFAULT_KANJI);
  const [selectedChar, setSelectedChar] = useState<string>(DEFAULT_KANJI[0]);
  const [charInfo, setCharInfo] = useState<CharInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const list = characterType === "kanji" ? DEFAULT_KANJI : characterType === "hiragana" ? DEFAULT_HIRAGANA : DEFAULT_KATAKANA;
    setCharacters(list);
    setSelectedChar(list[0]);
  }, [characterType]);

  useEffect(() => {
    if (!selectedChar) return;
    setLoading(true);
    fetch(`/api/learn/writing/character?char=${encodeURIComponent(selectedChar)}&type=${characterType}`)
      .then((r) => r.json())
      .then((data) => {
        setCharInfo({
          character: data.character ?? selectedChar,
          type: characterType,
          strokeCount: data.strokeCount ?? null,
          reading: data.reading ?? null,
        });
      })
      .catch(() => setCharInfo({ character: selectedChar, type: characterType, strokeCount: null, reading: null }))
      .finally(() => setLoading(false));
  }, [selectedChar, characterType]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {(["kanji", "hiragana", "katakana"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setCharacterType(type)}
            className={`px-3 py-1.5 rounded-bento text-sm font-medium capitalize ${characterType === type ? "bg-primary text-white" : "border border-[var(--divider)] hover:bg-[var(--divider)]/20"}`}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {characters.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSelectedChar(c)}
            className={`w-10 h-10 rounded-bento text-lg font-medium ${selectedChar === c ? "bg-primary text-white" : "border border-[var(--divider)] hover:bg-[var(--divider)]/20"}`}
            aria-label={`Practice ${c}`}
          >
            {c}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-secondary text-sm">Loading…</p>
      ) : charInfo ? (
        <WritingCanvas
          character={charInfo.character}
          characterType={charInfo.type}
          expectedStrokeCount={charInfo.strokeCount}
          reading={charInfo.reading}
        />
      ) : null}
    </div>
  );
}
