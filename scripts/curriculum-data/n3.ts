import type { ModuleEntry } from "./types";

// STALE: describes the pre-expansion 6-module/28-lesson N3 baseline only.
// The live DB was restructured to 11 modules/87 lessons directly via SQL + the
// AI-generation/review-gate pipeline (Curriculum V2 N3 expansion) and this file was
// never updated to match. Do NOT run seed-full-curriculum.ts against N3 against
// the live DB — its upsert (ON CONFLICT ... DO UPDATE) would revert module/lesson
// titles and structure back to this baseline. Safe for a fresh/empty database only.
export const n3Modules: ModuleEntry[] = [
  {
    code: "1",
    title: "Complex Sentence Building",
    submodules: [
      {
        code: "1", title: "Conditionals",
        lessons: [
          { code: "L1", title: "と / ば / たら / なら — Conditionals", description: "Master all four conditional forms in Japanese: と (natural/inevitable result), ば (general condition), たら (completed condition/when), なら (topic-based condition). Learn the nuanced differences with clear examples.", content_type: "grammar", access_type: "free", estimated_minutes: 25, practices: [{ title: "Conditional Choice Drill", description: "Choose the correct conditional form for 15 sentences.", practice_type: "mcq", estimated_minutes: 12 }, { title: "Conditional Fill-in", description: "Complete 10 conditional sentences with the appropriate form.", practice_type: "fill_blank", estimated_minutes: 10 }] },
        ],
      },
      {
        code: "2", title: "Purpose and Change",
        lessons: [
          { code: "L1", title: "ように / ために — Purpose", description: "Express purpose and goals using ために (concrete goal) and ように (state change goal). Build sentences about study goals, health habits, and future plans.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Purpose Sentence Practice", description: "Write 8 purpose-based sentences using ように and ために.", practice_type: "roleplay", estimated_minutes: 10 }, { title: "Purpose Fill-in", description: "Choose ように or ために for 10 goal sentences.", practice_type: "fill_blank", estimated_minutes: 8 }] },
          { code: "L2", title: "ようになる / ことになる — Change and Decision", description: "Express gradual change (ようになる) and decided outcomes/external decisions (ことになる). Practice describing life changes and institutional decisions.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Change Expression Drill", description: "Describe 8 life or study changes using the correct pattern.", practice_type: "roleplay", estimated_minutes: 10 }, { title: "Change vs Decision MCQ", description: "Choose ようになる or ことになる for each situation.", practice_type: "mcq", estimated_minutes: 8 }] },
        ],
      },
      {
        code: "3", title: "Passive and Causative",
        lessons: [
          { code: "L1", title: "Passive Form (〜られる)", description: "Learn the passive form (受身形) for all verb groups. Understand direct passive (object becomes subject) and indirect passive (someone is affected). Practice with real-world N3 sentences.", content_type: "grammar", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Passive Transformation", description: "Convert 12 active sentences into their passive equivalents.", practice_type: "fill_blank", estimated_minutes: 12 }, { title: "Passive vs Active MCQ", description: "Identify whether a sentence is active or passive and correct errors.", practice_type: "mcq", estimated_minutes: 10 }] },
          { code: "L2", title: "Causative Form (〜させる)", description: "Learn the causative form (使役形) for making or letting someone do something. Understand the allow/force nuance. Use in parenting, teaching, and management contexts.", content_type: "grammar", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Causative Practice", description: "Build 10 causative sentences describing school or workplace situations.", practice_type: "fill_blank", estimated_minutes: 12 }, { title: "Causative MCQ", description: "Choose the correct causative nuance (make vs let) for each situation.", practice_type: "mcq", estimated_minutes: 10 }] },
        ],
      },
    ],
  },

  {
    code: "2",
    title: "Nuance and Natural Expressions",
    submodules: [
      {
        code: "1", title: "Appearance and Inference",
        lessons: [
          { code: "L1", title: "そうです / ようです / みたいです", description: "Express appearance (looks like), inference, and similarity. そうです (looks/seems from direct observation), ようです (seems from information), みたいです (like/similar to, casual). Master these three look-alike patterns.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Nuance Practice", description: "Choose the correct appearance expression for 10 situations.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Appearance Fill-in", description: "Complete 8 appearance sentences with the correct expression.", practice_type: "fill_blank", estimated_minutes: 8 }] },
          { code: "L2", title: "らしい / はず — Hearsay and Expectation", description: "Learn らしい for hearsay/rumor and はずです for logical expectation based on known information. Distinguish from other inference expressions.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Guessing Drill", description: "Interpret meaning from context and choose らしい or はず.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Inference Fill-in", description: "Complete 8 inference sentences with the correct expression.", practice_type: "fill_blank", estimated_minutes: 8 }] },
        ],
      },
      {
        code: "2", title: "Habit and Regret",
        lessons: [
          { code: "L1", title: "ことにしている / ようにしている — Habits", description: "Talk about personal habits (decisions you make regularly) using ことにしている and sustained effort using ようにしている. Describe study and health routines.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Habit Writing", description: "Write 5 personal study habits and 3 health habits using both patterns.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Habit Pattern MCQ", description: "Choose ことにしている or ようにしている for each habit description.", practice_type: "mcq", estimated_minutes: 5 }] },
          { code: "L2", title: "ばよかった / てしまう — Regret and Completion", description: "Express regret using 〜ばよかった (should have done). Express unintended completion or regret using 〜てしまう/ちゃう. Practice with natural conversational contexts.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Regret Sentence Drill", description: "Write 6 regret expressions for given past situations.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Regret Fill-in", description: "Complete 8 sentences using ばよかった or てしまった.", practice_type: "fill_blank", estimated_minutes: 5 }] },
          { code: "L3", title: "づらい / にくい / やすい — Ease and Difficulty", description: "Express how easy or difficult actions are using 〜やすい (easy to), 〜にくい/づらい (hard to). Understand the subtle difference between にくい (physical difficulty) and づらい (psychological difficulty).", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Ease/Difficulty Practice", description: "Describe 8 tasks using やすい, にくい, or づらい.", practice_type: "fill_blank", estimated_minutes: 8 }, { title: "Difficulty Expression MCQ", description: "Choose the correct difficulty expression for each task.", practice_type: "mcq", estimated_minutes: 5 }] },
        ],
      },
    ],
  },

  {
    code: "3",
    title: "Intermediate Vocabulary and Kanji",
    submodules: [
      {
        code: "1", title: "N3 Kanji Sets",
        lessons: [
          { code: "L1", title: "Daily Abstract Kanji", description: "Learn 7 abstract concept kanji used in everyday N3 contexts: 意味理由予定経験生活. Read in phrases and short sentences.", content_type: "kanji", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Kanji Context Reading", description: "Read 14 phrases using the 7 abstract kanji.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Abstract Kanji Writing", description: "Write each of the 7 kanji 5 times on the stroke canvas.", practice_type: "writing_canvas", estimated_minutes: 12 }] },
          { code: "L2", title: "Work and Society Kanji", description: "Learn 5 work and society kanji: 仕事社会問題活動. Build vocabulary compounds and use in professional sentences.", content_type: "kanji", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Kanji Meaning Practice", description: "Match 5 kanji to sentence meanings and choose correct readings.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Society Kanji Writing", description: "Write all 5 kanji with stroke order.", practice_type: "writing_canvas", estimated_minutes: 12 }] },
        ],
      },
      {
        code: "2", title: "N3 Vocabulary Building",
        lessons: [
          { code: "L1", title: "2500 Core N3 Words", description: "Build your N3 vocabulary base of 2500 words using thematic groups: abstract nouns, compound verbs, adverbs, and N3-level adjectives.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 30, practices: [{ title: "SRS Daily Review", description: "Daily 25-card spaced repetition session with example sentences.", practice_type: "mcq", estimated_minutes: 15 }] },
          { code: "L2", title: "Natural Japanese Adverbs", description: "Learn high-frequency N3 adverbs: だんだん (gradually), どんどん (rapidly), しっかり (firmly), なかなか (quite/not easily), ずいぶん (quite a lot). Place them correctly in sentences.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Adverb Sentence Drill", description: "Place the correct adverb in 12 sentences.", practice_type: "fill_blank", estimated_minutes: 10 }, { title: "Adverb MCQ", description: "Choose the most natural adverb for each sentence.", practice_type: "mcq", estimated_minutes: 8 }] },
          { code: "L3", title: "Common N3 Set Expressions", description: "Learn 20 set expressions used in real N3 conversation: それに、ところが、しかし、それでも、やはり. Understand discourse markers and connectors.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Phrase Completion", description: "Complete 10 natural N3 dialogues with the correct discourse phrase.", practice_type: "fill_blank", estimated_minutes: 10 }, { title: "Expression MCQ", description: "Choose the most natural connector for each sentence.", practice_type: "mcq", estimated_minutes: 8 }] },
        ],
      },
    ],
  },

  {
    code: "4",
    title: "Reading Real Japanese",
    submodules: [
      {
        code: "1", title: "Text Types",
        lessons: [
          { code: "L1", title: "Opinion and Explanation Texts", description: "Read structured N3-level passages (300–450 characters) expressing opinions or explaining topics. Practice identifying the main argument and supporting details.", content_type: "reading", access_type: "free", estimated_minutes: 20, practices: [{ title: "Main Idea Questions", description: "Find the argument and conclusion in 2 passages.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Opinion Mapping", description: "Map the author's main point and 2 supporting reasons.", practice_type: "fill_blank", estimated_minutes: 8 }] },
          { code: "L2", title: "Simple Narrative Reading", description: "Understand sequence and emotion in short narrative texts. Track story progression: who did what, when, and how characters felt.", content_type: "reading", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Story Comprehension", description: "Answer who/what/why questions about a narrative passage.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Story Sequence Fill-in", description: "Order 5 events from the story in the correct sequence.", practice_type: "fill_blank", estimated_minutes: 8 }] },
          { code: "L3", title: "Emails and Polite Messages", description: "Read formal and semi-formal written communication: emails, invitations, and notices. Understand the purpose and the required response.", content_type: "reading", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Email Response Practice", description: "Choose the appropriate reply for each email from 4 options.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Key Information Fill-in", description: "Extract who/what/when/where from an email.", practice_type: "fill_blank", estimated_minutes: 8 }] },
        ],
      },
      {
        code: "2", title: "Reading Strategies",
        lessons: [
          { code: "L1", title: "Information Search — Menus, Ads, Schedules", description: "Find specific details quickly in menus, advertisements, and schedule grids. Practice scanning rather than reading every word.", content_type: "reading", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Scanning Drill", description: "Locate 5 required pieces of information from a schedule or menu.", practice_type: "fill_blank", estimated_minutes: 8 }, { title: "Information Search MCQ", description: "Find and choose the correct information from an advertisement.", practice_type: "mcq", estimated_minutes: 5 }] },
          { code: "L2", title: "Skimming and Keyword Reading", description: "Learn efficient JLPT reading strategies: skim for the general topic, then keyword-search for specific answers. Improve speed without losing accuracy.", content_type: "reading", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Timed Reading Practice", description: "Answer 5 questions about a passage within 3 minutes.", practice_type: "mcq", estimated_minutes: 8 }] },
        ],
      },
    ],
  },

  {
    code: "5",
    title: "Listening and Real Conversations",
    submodules: [
      {
        code: "1", title: "Natural Speed Audio",
        lessons: [
          { code: "L1", title: "Natural Speed Daily Conversations", description: "Listen to N3-speed daily conversations between native speakers. Focus on identifying speaker intention, emotion, and factual information.", content_type: "listening", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Listening Detail Quiz", description: "Identify speaker intention in 5 dialogue segments.", practice_type: "listening", estimated_minutes: 10 }, { title: "N3 Shadowing", description: "Shadow a 60-second natural conversation to build listening speed.", practice_type: "shadowing", estimated_minutes: 8 }] },
          { code: "L2", title: "Workplace and School Requests", description: "Understand polite requests and responses in professional and academic contexts. Identify what someone is asking for and what the response means.", content_type: "listening", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Response Selection", description: "Pick the best response for 5 workplace request situations.", practice_type: "listening", estimated_minutes: 10 }, { title: "Request Shadowing", description: "Shadow formal request dialogues to improve comprehension.", practice_type: "shadowing", estimated_minutes: 8 }] },
          { code: "L3", title: "Public Announcements", description: "Understand station, shop, and school announcements at natural speed. Extract key details: time, location, and required action.", content_type: "listening", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Announcement Drill", description: "Extract key details from 5 public announcements.", practice_type: "listening", estimated_minutes: 8 }, { title: "Announcement Fill-in", description: "Fill in time/place/action details from 5 announcements.", practice_type: "fill_blank", estimated_minutes: 5 }] },
        ],
      },
      {
        code: "2", title: "Opinion Listening",
        lessons: [
          { code: "L1", title: "Agree/Disagree Conversations", description: "Understand conversations where speakers express and respond to opinions. Track who agrees, disagrees, or is uncertain.", content_type: "listening", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Opinion Mapping", description: "Identify each speaker's view in 4 conversation segments.", practice_type: "listening", estimated_minutes: 10 }, { title: "Opinion Shadowing", description: "Shadow an opinion exchange dialogue to improve natural intonation.", practice_type: "shadowing", estimated_minutes: 8 }] },
        ],
      },
    ],
  },

  {
    code: "6",
    title: "N3 Review and Mock Test",
    submodules: [
      {
        code: "1", title: "Full Review",
        lessons: [
          { code: "L1", title: "N3 Grammar Master Review", description: "Comprehensive review of all N3 grammar: conditionals, passive, causative, appearance expressions, connectors, and discourse markers.", content_type: "grammar", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Mixed Grammar Test", description: "50-question N3 grammar test covering all major patterns.", practice_type: "mcq", estimated_minutes: 30 }] },
          { code: "L2", title: "N3 Vocabulary Review", description: "Review 500 most important N3 vocabulary words: meanings, usage, and kanji forms.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Vocab Recall Test", description: "25-question vocabulary meaning and usage test.", practice_type: "mcq", estimated_minutes: 20 }] },
          { code: "L3", title: "N3 Reading and Listening Review", description: "Practice 3 timed reading passages and 2 listening segments in exam format.", content_type: "reading", access_type: "premium", estimated_minutes: 40, practices: [{ title: "Timed Reading Set", description: "Complete 3 passages with 15 questions under 12 minutes.", practice_type: "mcq", estimated_minutes: 20 }, { title: "Listening Mock Section", description: "Complete 2 listening segments with 8 questions.", practice_type: "listening", estimated_minutes: 15 }] },
          { code: "L4", title: "JLPT N3 Mock Exam", description: "Full N3 mock exam: vocabulary (35Q), grammar (35Q), reading (3 passages, 12Q), listening (3 segments, 12Q). Total 95 minutes.", content_type: "mock_test", access_type: "premium", estimated_minutes: 95, practices: [{ title: "Final N3 Assessment", description: "Complete the full N3 mock exam with score and N2 upgrade plan.", practice_type: "mcq", estimated_minutes: 95 }] },
        ],
      },
    ],
  },
];
