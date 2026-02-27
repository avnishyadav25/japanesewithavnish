export const JLPT_LEVELS = ["n5", "n4", "n3", "n2", "n1", "mega"] as const;
export type JLPTLevel = (typeof JLPT_LEVELS)[number];

export const LEVEL_NAMES: Record<string, string> = {
  n5: "N5 — Beginner",
  n4: "N4 — Elementary",
  n3: "N3 — Intermediate",
  n2: "N2 — Upper Intermediate",
  n1: "N1 — Advanced",
  mega: "Mega (All Levels)",
};

export const LEVEL_SLUGS: Record<string, string> = {
  n5: "japanese-n5-mastery-bundle",
  n4: "japanese-n4-upgrade-bundle",
  n3: "japanese-n3-power-bundle",
  n2: "japanese-n2-pro-bundle",
  n1: "japanese-n1-elite-bundle",
  mega: "complete-japanese-n5-n1-mega-bundle",
};

export const LEVEL_SUMMARIES: Record<string, string> = {
  n5: "Start your Japanese journey with the fundamentals. N5 covers the basics every learner needs.",
  n4: "Build on N5 foundations. N4 adds everyday vocabulary and grammar for real-world communication.",
  n3: "Bridge to intermediate. N3 develops reading and listening for practical situations.",
  n2: "Professional level. N2 prepares you for business and academic Japanese.",
  n1: "Near-native mastery. N1 represents the highest JLPT certification level.",
  mega: "Complete system from beginner to advanced. Best value for serious learners.",
};

export const LEVEL_OUTCOMES: Record<string, string[]> = {
  n5: [
    "Master hiragana, katakana, and ~80 kanji",
    "Core grammar and ~800 vocabulary words",
    "Basic reading and listening comprehension",
  ],
  n4: [
    "~166 additional kanji, ~1500 total vocab",
    "Everyday grammar and sentence patterns",
    "Short passages and conversations",
  ],
  n3: [
    "~369 kanji, ~3750 vocabulary",
    "Bridge grammar (causative, passive)",
    "Reading and listening for daily life",
  ],
  n2: [
    "~367 new kanji, ~6000 total vocab",
    "Keigo and formal expressions",
    "Business and academic materials",
  ],
  n1: [
    "~1130 kanji, ~10000 vocabulary",
    "Complex grammar and idioms",
    "Academic and literary texts",
  ],
  mega: [
    "All levels from N5 to N1",
    "Complete grammar, vocab, and kanji",
    "Best value — save 60% vs buying separately",
  ],
};

export const LEVEL_LEARN_BULLETS: Record<string, string[]> = {
  n5: [
    "Essential grammar (は, です, を, に, で)",
    "Core vocabulary for daily situations",
    "Hiragana, katakana, and basic kanji",
    "Simple reading and listening practice",
  ],
  n4: [
    "Expanded grammar (て-form, potential, volitional)",
    "Everyday vocabulary and expressions",
    "Additional kanji for common words",
    "Short passages and dialogues",
  ],
  n3: [
    "Bridge grammar (causative, passive, honorifics)",
    "Intermediate vocabulary and idioms",
    "Kanji for newspapers and magazines",
    "Reading comprehension and listening",
  ],
  n2: [
    "Keigo and formal Japanese",
    "Business and academic vocabulary",
    "Complex sentence structures",
    "Advanced reading and listening",
  ],
  n1: [
    "Academic and literary Japanese",
    "Near-native vocabulary and idioms",
    "Complex grammar patterns",
    "Full N1 mock tests",
  ],
  mega: [
    "Everything from N5 to N1",
    "Structured progression",
    "All worksheets, mock tests, audio",
    "Lifetime access, study offline",
  ],
};
