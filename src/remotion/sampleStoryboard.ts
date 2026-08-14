/**
 * Fixture used as Remotion Studio's default props, so `npx remotion studio` opens on something
 * real instead of an empty timeline. Never used by a render — the worker always passes a
 * storyboard from the database.
 *
 * It has no `audio` on any narration segment, which exercises the "no resolved timeline yet"
 * path in VideoRoot: durations fall back to each scene's authored hint.
 */
import type { Storyboard } from "@/lib/video/types";
import { BRAND } from "@/lib/brand";
import { DEFAULT_BRANDING, MASCOT_INTRO_SECONDS, OUTRO_MIN_SECONDS } from "@/lib/video/branding";

export const SAMPLE_STORYBOARD: Storyboard = {
  schemaVersion: 1,
  projectId: "sample",
  title: "5 essential N5 words",
  narrationLang: "en",
  themeKey: "washi-light",
  captions: { enabled: true, burnIn: true, style: "bold-center" },
  scenes: [
    {
      // The opening beat the storyboard builder now emits when branding.mascots is on. Present
      // in the fixture so Studio and the preview exercise it like any other scene type.
      id: "sc-mascot",
      sceneType: "mascot_intro",
      durationMode: "fixed",
      durationSeconds: MASCOT_INTRO_SECONDS,
      transitionIn: { kind: "fade", durationSeconds: 0.3 },
      narration: [],
      visual: {
        sceneType: "mascot_intro",
        mascot: "fox-wave",
        greeting: "こんにちは",
        greetingRomaji: "konnichiwa",
        topic: "5 essential N5 words",
        eyebrow: "JLPT N5",
      },
    },
    {
      id: "sc-intro",
      sceneType: "title_card",
      durationMode: "fixed",
      durationSeconds: 3,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [],
      visual: {
        sceneType: "title_card",
        eyebrow: "JLPT N5",
        title: "5 essential N5 words",
        subtitle: "Japanese vocabulary",
        jlptLevel: "N5",
      },
    },
    {
      id: "sc-w1",
      sceneType: "vocab_card",
      durationMode: "fixed",
      durationSeconds: 6,
      transitionIn: { kind: "slide", durationSeconds: 0.3 },
      narration: [],
      visual: {
        sceneType: "vocab_card",
        index: 1,
        total: 5,
        showFurigana: true,
        item: {
          word: "猫",
          reading: "ねこ",
          romaji: "neko",
          meaning: "cat",
          partOfSpeech: "noun",
          example: { ja: "猫が好きです。", romaji: "Neko ga suki desu.", en: "I like cats." },
        },
      },
    },
    {
      id: "sc-k1",
      sceneType: "kanji_stroke",
      durationMode: "fixed",
      durationSeconds: 7,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [],
      visual: {
        sceneType: "kanji_stroke",
        character: "山",
        meaning: "mountain",
        onyomi: ["サン"],
        kunyomi: ["やま"],
        strokeCount: 3,
        // Real KanjiVG geometry for 山 on the standard 109x109 grid.
        strokePaths: [
          "M23.5,23.5c0.9,0.9,1.2,2.2,1.2,3.7c0,7.1,0,32.5,0,44.3",
          "M54.3,15.5c0.9,1,1.3,2.3,1.3,3.9c0,9.4,0,50.9,0,60.4",
          "M84.5,21.8c0.9,0.9,1.3,2.2,1.3,3.7c0,8.6,0,48.5,0,58.7c0,8.1-6.4,1.6-9.2-0.4",
        ],
      },
    },
    {
      id: "sc-outro",
      sceneType: "cta_outro",
      durationMode: "fixed",
      durationSeconds: OUTRO_MIN_SECONDS,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [],
      visual: {
        sceneType: "cta_outro",
        headline: "Practise these on",
        subline: BRAND.shortName,
        url: BRAND.displayUrl,
        showLogo: true,
        handle: DEFAULT_BRANDING.handle,
        socials: DEFAULT_BRANDING.socials,
        mascot: "fox-celebrate",
      },
    },
  ],
  branding: DEFAULT_BRANDING,
};
