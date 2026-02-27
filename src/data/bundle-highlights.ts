export interface BundleHighlights {
  kanji_count?: string | number;
  vocab_count?: string | number;
  grammar_count?: string | number;
  mock_tests?: string | number;
  audio?: boolean;
}

export const BUNDLE_HIGHLIGHTS: Record<string, BundleHighlights> = {
  "japanese-n5-mastery-bundle": {
    kanji_count: "~80",
    vocab_count: "~800",
    grammar_count: "~40",
    mock_tests: 5,
    audio: true,
  },
  "japanese-n4-upgrade-bundle": {
    kanji_count: "~166",
    vocab_count: "~1500",
    grammar_count: "~50",
    mock_tests: 5,
    audio: true,
  },
  "japanese-n3-power-bundle": {
    kanji_count: "~369",
    vocab_count: "~3750",
    grammar_count: "~100",
    mock_tests: 5,
    audio: true,
  },
  "japanese-n2-pro-bundle": {
    kanji_count: "~367",
    vocab_count: "~6000",
    grammar_count: "~150",
    mock_tests: 5,
    audio: true,
  },
  "japanese-n1-elite-bundle": {
    kanji_count: "~1130",
    vocab_count: "~10000",
    grammar_count: "~200",
    mock_tests: 5,
    audio: true,
  },
  "complete-japanese-n5-n1-mega-bundle": {
    kanji_count: "All",
    vocab_count: "All",
    grammar_count: "All",
    mock_tests: "All",
    audio: true,
  },
};

export function getBundleHighlights(slug: string): BundleHighlights | undefined {
  return BUNDLE_HIGHLIGHTS[slug];
}
