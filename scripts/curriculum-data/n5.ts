import type { ModuleEntry } from "./types";

// STALE: describes the pre-expansion 6-module/35-lesson N5 baseline only.
// The live DB was restructured to 11 modules/72 lessons directly via SQL + the
// AI-generation/review-gate pipeline (Curriculum V2 N5 pilot) and this file was
// never updated to match. Do NOT run seed-full-curriculum.ts against N5 against
// the live DB — its upsert (ON CONFLICT ... DO UPDATE) would revert module/lesson
// titles and structure back to this baseline. Safe for a fresh/empty database only.
export const n5Modules: ModuleEntry[] = [
  {
    code: "1",
    title: "Japanese Writing System",
    submodules: [
      {
        code: "1",
        title: "Hiragana Basics",
        lessons: [
          {
            code: "L1", title: "Hiragana A–N Rows",
            description: "Learn あいうえお to なにぬねの with correct stroke order and pronunciation. Each character is introduced with a mnemonic image and audio.",
            content_type: "kanji", access_type: "free", estimated_minutes: 15,
            practices: [
              { title: "Hiragana Writing Drill 1", description: "Trace and write each あ-row to な-row character 5 times using the stroke canvas.", practice_type: "writing_canvas", estimated_minutes: 10 },
              { title: "Hiragana Recognition Quiz", description: "Match 10 hiragana flashcards to their correct romaji readings.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
          {
            code: "L2", title: "Hiragana H–W Rows",
            description: "Learn は row through わ row and the standalone ん character. Understand how ん sounds before different consonants.",
            content_type: "kanji", access_type: "free", estimated_minutes: 15,
            practices: [
              { title: "Hiragana Writing Drill 2", description: "Trace and write each は-row to わ-row character 5 times.", practice_type: "writing_canvas", estimated_minutes: 10 },
              { title: "Full Hiragana Recognition Quiz", description: "Match all 46 hiragana to their romaji. Timed 2 minutes.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
        ],
      },
      {
        code: "2",
        title: "Hiragana Sound Changes",
        lessons: [
          {
            code: "L1", title: "Dakuten & Handakuten",
            description: "Learn voiced and semi-voiced sound changes: が、ざ、だ、ば and ぱ rows. Understand when and how to add the diacritic marks.",
            content_type: "kanji", access_type: "free", estimated_minutes: 12,
            practices: [
              { title: "Sound Change Practice", description: "Convert base kana into their dakuten and handakuten forms.", practice_type: "fill_blank", estimated_minutes: 8 },
              { title: "Voiced Sound MCQ", description: "Choose the correct dakuten character for each given sound.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
        ],
      },
      {
        code: "3",
        title: "Hiragana Combinations",
        lessons: [
          {
            code: "L1", title: "Small や・ゆ・よ Sounds",
            description: "Learn how small や, ゆ, よ combine with い-row kana to form blended sounds like きゃ, しゅ, ちょ. Practice reading and writing 33 combination sounds.",
            content_type: "kanji", access_type: "free", estimated_minutes: 15,
            practices: [
              { title: "Combination Reading Drill", description: "Read 20 short words made of combination kana sounds. Identify and select the correct reading.", practice_type: "mcq", estimated_minutes: 7 },
              { title: "Combination Writing", description: "Write 10 combination kana pairs on the stroke canvas.", practice_type: "writing_canvas", estimated_minutes: 8 },
            ],
          },
        ],
      },
      {
        code: "4",
        title: "Katakana Basics",
        lessons: [
          {
            code: "L1", title: "Katakana A–N Rows",
            description: "Learn ア to ノ with correct stroke order. Compare katakana to their hiragana counterparts. Practice reading foreign words.",
            content_type: "kanji", access_type: "free", estimated_minutes: 15,
            practices: [
              { title: "Katakana Writing Drill 1", description: "Trace and write each ア-row to ナ-row character 5 times.", practice_type: "writing_canvas", estimated_minutes: 10 },
              { title: "Katakana Recognition Quiz", description: "Match katakana to romaji in a timed 2-minute quiz.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
          {
            code: "L2", title: "Katakana H–W Rows",
            description: "Learn ハ to ワ and ン. Understand long vowels written with ー. Read common loanwords like コーヒー and テレビ.",
            content_type: "kanji", access_type: "free", estimated_minutes: 15,
            practices: [
              { title: "Katakana Writing Drill 2", description: "Trace and write ハ-row to ワ-row characters.", practice_type: "writing_canvas", estimated_minutes: 10 },
              { title: "Full Katakana Recognition", description: "Identify all 46 katakana characters. Timed quiz.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
        ],
      },
      {
        code: "5",
        title: "Katakana Words",
        lessons: [
          {
            code: "L1", title: "Foreign Words in Japanese",
            description: "Learn the most common loanwords (外来語) used in daily Japanese: コーヒー (coffee), テレビ (TV), ホテル (hotel), スマホ (smartphone). Understand the patterns of sound conversion from English to Japanese.",
            content_type: "vocabulary", access_type: "free", estimated_minutes: 15,
            practices: [
              { title: "Katakana Word Practice", description: "Read 15 katakana loanwords and match them to their English meanings.", practice_type: "mcq", estimated_minutes: 7 },
              { title: "Loanword Writing", description: "Write 10 common loanwords on the canvas from romaji prompts.", practice_type: "writing_canvas", estimated_minutes: 8 },
            ],
          },
        ],
      },
    ],
  },

  {
    code: "2",
    title: "Basic Sentence Foundation",
    submodules: [
      {
        code: "1",
        title: "Noun Sentences with Particles",
        lessons: [
          {
            code: "L1", title: "は / です — The Basic Pattern",
            description: "Learn the fundamental Japanese sentence structure: [Topic] は [Information] です. Understand は as a topic marker, not a subject marker. Build simple identity sentences like 私はアビです (I am Avi).",
            content_type: "grammar", access_type: "free", estimated_minutes: 15,
            practices: [
              { title: "Self Introduction Practice", description: "Write 5 simple self-introduction sentences using は and です.", practice_type: "roleplay", estimated_minutes: 8 },
              { title: "は/です Fill-in", description: "Complete 10 sentences by adding the correct particle or copula.", practice_type: "fill_blank", estimated_minutes: 7 },
            ],
          },
          {
            code: "L2", title: "も / じゃありません — Also and Negative",
            description: "Learn も (also/too) as an inclusive particle and じゃありません as the polite negative of です. Practice converting positive noun sentences to negative and 'also' forms.",
            content_type: "grammar", access_type: "free", estimated_minutes: 12,
            practices: [
              { title: "Positive/Negative Drill", description: "Convert 10 positive sentences into their じゃありません negative form.", practice_type: "fill_blank", estimated_minutes: 7 },
              { title: "も Sentence Building", description: "Build 5 sentences using も from the given prompts.", practice_type: "roleplay", estimated_minutes: 5 },
            ],
          },
        ],
      },
      {
        code: "2",
        title: "Questions",
        lessons: [
          {
            code: "L1", title: "か — The Question Marker",
            description: "Learn how to form yes/no questions in Japanese by adding か to the end of a statement. Also learn basic WH-question words: なに (what), だれ (who), どこ (where), いつ (when), どうして (why).",
            content_type: "grammar", access_type: "free", estimated_minutes: 15,
            practices: [
              { title: "Question Practice", description: "Create 10 simple yes/no and WH questions from given prompts.", practice_type: "fill_blank", estimated_minutes: 8 },
              { title: "Question MCQ", description: "Choose the correct WH-word for each situation.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
        ],
      },
      {
        code: "3",
        title: "Demonstratives",
        lessons: [
          {
            code: "L1", title: "これ・それ・あれ",
            description: "Learn the three Japanese demonstrative pronouns for objects: これ (this, near me), それ (that, near you), あれ (that over there, far from both). Practice using them in question-answer pairs.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 12,
            practices: [
              { title: "Object Identification Drill", description: "Choose the correct demonstrative pronoun based on the position described.", practice_type: "mcq", estimated_minutes: 7 },
              { title: "Demonstrative Roleplay", description: "Answer questions about objects using これ/それ/あれ in a short dialogue.", practice_type: "roleplay", estimated_minutes: 5 },
            ],
          },
          {
            code: "L2", title: "この・その・あの",
            description: "Learn how demonstrative adjectives この, その, あの attach directly to nouns to mean 'this/that + noun'. Distinguish between pronoun and adjective demonstratives.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 12,
            practices: [
              { title: "Noun Phrase Practice", description: "Build 10 phrases like この本 (this book) and その人 (that person).", practice_type: "fill_blank", estimated_minutes: 7 },
              { title: "Demonstrative Adjective MCQ", description: "Choose この/その/あの for each sentence based on context.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
        ],
      },
      {
        code: "4",
        title: "Location Words",
        lessons: [
          {
            code: "L1", title: "ここ・そこ・あそこ",
            description: "Learn place demonstratives: ここ (here, near me), そこ (there, near you), あそこ (over there). Use them with the particle に and verbs of existence like あります/います.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 12,
            practices: [
              { title: "Place Question Drill", description: "Ask and answer 8 location questions using ここ/そこ/あそこ.", practice_type: "roleplay", estimated_minutes: 7 },
              { title: "Location Fill-in", description: "Fill the correct location word in 10 sentences.", practice_type: "fill_blank", estimated_minutes: 5 },
            ],
          },
        ],
      },
    ],
  },

  {
    code: "3",
    title: "Verbs and Daily Actions",
    submodules: [
      {
        code: "1",
        title: "Polite Verb Forms",
        lessons: [
          {
            code: "L1", title: "ます Form — Polite Present/Future",
            description: "Learn to conjugate verbs into the polite ます form for present and future actions. Cover Group 1 (五段), Group 2 (一段), and irregular verbs (する, くる). Build sentences about daily routines.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 20,
            practices: [
              { title: "Verb Conjugation Drill", description: "Convert 15 dictionary form verbs into their polite ます form.", practice_type: "fill_blank", estimated_minutes: 10 },
              { title: "Daily Routine Writing", description: "Write a short paragraph about your morning routine using ます form.", practice_type: "roleplay", estimated_minutes: 10 },
            ],
          },
          {
            code: "L2", title: "ません Form — Polite Negative",
            description: "Learn ません, the polite negative form. Transform positive sentences into negatives. Practice with common verbs like 食べます→食べません, 行きます→行きません.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Negative Verb Practice", description: "Convert 12 positive ます sentences into their ません negative form.", practice_type: "fill_blank", estimated_minutes: 8 },
              { title: "Negative Sentence MCQ", description: "Choose the correct negative verb for each situation.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
          {
            code: "L3", title: "ました / ませんでした — Past Forms",
            description: "Learn the polite past tense (ました) and past negative (ませんでした). Practice describing what you did or didn't do yesterday.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Daily Routine Past Drill", description: "Write 8 sentences about what you did yesterday using ました.", practice_type: "roleplay", estimated_minutes: 8 },
              { title: "Past Tense Fill-in", description: "Complete sentences using the correct past tense form.", practice_type: "fill_blank", estimated_minutes: 7 },
            ],
          },
        ],
      },
      {
        code: "2",
        title: "Action Particles",
        lessons: [
          {
            code: "L1", title: "を / で / に / へ",
            description: "Learn the four key action particles: を (direct object), で (action location/means), に (time/destination/target), へ (direction). Understand when to use each with vivid example sentences.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 20,
            practices: [
              { title: "Particle Fill-in Practice", description: "Fill the correct particle (を/で/に/へ) in 15 sentences.", practice_type: "fill_blank", estimated_minutes: 10 },
              { title: "Particle MCQ", description: "Choose the correct particle for each sentence context.", practice_type: "mcq", estimated_minutes: 8 },
            ],
          },
        ],
      },
      {
        code: "3",
        title: "Social Verb Patterns",
        lessons: [
          {
            code: "L1", title: "ませんか / ましょう — Invitations",
            description: "Learn ませんか (Won't you...?) for invitations and ましょう (Let's...) for suggestions. Practice creating natural invitation dialogues for daily situations.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Invitation Roleplay", description: "Create 5 invitation dialogues using ませんか and ましょう.", practice_type: "roleplay", estimated_minutes: 8 },
              { title: "Invitation MCQ", description: "Choose ませんか or ましょう for each social situation.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
          {
            code: "L2", title: "いつも・よく・ときどき — Frequency",
            description: "Learn frequency adverbs: いつも (always), よく (often), ときどき (sometimes), あまり (not much), ぜんぜん (never). Place them correctly before verbs.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 12,
            practices: [
              { title: "Routine Frequency Drill", description: "Describe your weekly habits using 5 different frequency words.", practice_type: "roleplay", estimated_minutes: 7 },
              { title: "Frequency Word Fill-in", description: "Choose the correct frequency adverb for 10 sentences.", practice_type: "fill_blank", estimated_minutes: 5 },
            ],
          },
        ],
      },
    ],
  },

  {
    code: "4",
    title: "Adjectives and Descriptions",
    submodules: [
      {
        code: "1",
        title: "い-Adjectives",
        lessons: [
          {
            code: "L1", title: "Basic い-Adjectives",
            description: "Learn the most common い-adjectives: おいしい (delicious), あつい (hot), さむい (cold), たかい (expensive/tall), やすい (cheap), おおきい (big), ちいさい (small). Learn how they modify nouns and form predicates.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Description Practice", description: "Describe 5 foods, 3 weather situations, and 4 objects using い-adjectives.", practice_type: "roleplay", estimated_minutes: 8 },
              { title: "Adjective MCQ", description: "Choose the correct い-adjective for each description.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
          {
            code: "L2", title: "くない / Past い-Adjective Forms",
            description: "Learn how to negate い-adjectives (おいしい→おいしくない) and form the past tense (おいしかった). Build a complete 4-form table for each adjective.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Adjective Transformation", description: "Convert 12 positive present い-adjectives to all 4 forms.", practice_type: "fill_blank", estimated_minutes: 10 },
              { title: "Past Description Practice", description: "Describe yesterday's weather and food using past adjective forms.", practice_type: "roleplay", estimated_minutes: 7 },
            ],
          },
        ],
      },
      {
        code: "2",
        title: "な-Adjectives",
        lessons: [
          {
            code: "L1", title: "Basic な-Adjectives",
            description: "Learn な-adjectives: きれい (pretty), しずか (quiet), べんり (convenient), にぎやか (lively), すき (liked), きらい (disliked), じょうず (skilled). Understand the な connector when modifying nouns.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "な-Adjective Drill", description: "Build 10 noun description sentences using な-adjectives.", practice_type: "fill_blank", estimated_minutes: 8 },
              { title: "な-Adjective Roleplay", description: "Describe your town and hobbies using 5 な-adjectives.", practice_type: "roleplay", estimated_minutes: 7 },
            ],
          },
          {
            code: "L2", title: "とても / あまり — Degree Words",
            description: "Learn intensity modifiers: とても (very), まあまあ (so-so), あまり+negative (not much), ぜんぜん+negative (not at all). Use them naturally before adjectives.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 12,
            practices: [
              { title: "Degree Word Practice", description: "Complete 10 sentences using the correct degree modifier.", practice_type: "fill_blank", estimated_minutes: 7 },
              { title: "Intensity MCQ", description: "Choose the best degree word for each descriptive sentence.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
        ],
      },
    ],
  },

  {
    code: "5",
    title: "N5 Vocabulary and Kanji",
    submodules: [
      {
        code: "1",
        title: "Numbers and Time",
        lessons: [
          {
            code: "L1", title: "Numbers 1–10,000",
            description: "Learn Japanese counting: 一 to 十, then 百, 千, 万. Practice reading prices, ages, and quantities. Learn counter words: 〜人 (people), 〜冊 (books), 〜枚 (flat things).",
            content_type: "vocabulary", access_type: "premium", estimated_minutes: 20,
            practices: [
              { title: "Number Listening Drill", description: "Listen to 15 numbers read aloud and write them in kanji.", practice_type: "listening", estimated_minutes: 10 },
              { title: "Counter Word MCQ", description: "Choose the correct counter word for each category.", practice_type: "mcq", estimated_minutes: 8 },
            ],
          },
          {
            code: "L2", title: "Days, Months, and Clock Time",
            description: "Learn days of the week (〜曜日), months (〜月), dates (〜日), and telling time (〜時〜分). Practice reading schedules and asking the time.",
            content_type: "vocabulary", access_type: "premium", estimated_minutes: 20,
            practices: [
              { title: "Schedule Practice", description: "Write a simple weekly schedule using days and times.", practice_type: "roleplay", estimated_minutes: 10 },
              { title: "Time Fill-in", description: "Fill in times, days, and dates from clock images.", practice_type: "fill_blank", estimated_minutes: 8 },
            ],
          },
        ],
      },
      {
        code: "2",
        title: "Family and Food Vocabulary",
        lessons: [
          {
            code: "L1", title: "Family Words",
            description: "Learn family terms in two registers: plain form (ちち, はは) used when talking about your own family, and polite form (おとうさん, おかあさん) used for others' families.",
            content_type: "vocabulary", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Family Introduction", description: "Introduce your family (or a fictional family) using the correct terms.", practice_type: "roleplay", estimated_minutes: 8 },
              { title: "Family Vocabulary MCQ", description: "Choose the correct plain/polite family term for each situation.", practice_type: "mcq", estimated_minutes: 5 },
            ],
          },
          {
            code: "L2", title: "Food and Drink Vocabulary",
            description: "Learn 40+ common food, drink, and restaurant words: ごはん, パン, おちゃ, みず, たまご, さかな, にく. Learn restaurant phrases: 〜をください, おいくらですか.",
            content_type: "vocabulary", access_type: "premium", estimated_minutes: 20,
            practices: [
              { title: "Restaurant Roleplay", description: "Order a meal in a Japanese restaurant using food vocabulary and polite phrases.", practice_type: "roleplay", estimated_minutes: 10 },
              { title: "Food Vocabulary MCQ", description: "Match 20 food items to their Japanese names.", practice_type: "mcq", estimated_minutes: 8 },
            ],
          },
        ],
      },
      {
        code: "3",
        title: "N5 Kanji Sets",
        lessons: [
          {
            code: "L1", title: "Numbers + Time Kanji",
            description: "Learn 14 foundational kanji: 一二三四五六七八九十日月年時. Master on-yomi and kun-yomi readings and practice writing stroke order.",
            content_type: "kanji", access_type: "premium", estimated_minutes: 25,
            practices: [
              { title: "Kanji Writing Practice", description: "Write each of the 14 kanji 5 times with correct stroke order.", practice_type: "writing_canvas", estimated_minutes: 15 },
              { title: "Kanji Reading MCQ", description: "Choose the correct reading for each kanji in context.", practice_type: "mcq", estimated_minutes: 8 },
            ],
          },
          {
            code: "L2", title: "People + Places Kanji",
            description: "Learn 9 kanji related to people and places: 人子女男先生学校駅国. Connect readings to vocabulary already learned.",
            content_type: "kanji", access_type: "premium", estimated_minutes: 25,
            practices: [
              { title: "Kanji Writing Practice", description: "Write each of the 9 kanji 5 times on the stroke canvas.", practice_type: "writing_canvas", estimated_minutes: 15 },
              { title: "Kanji Reading Quiz", description: "Match each kanji to its meaning and reading.", practice_type: "mcq", estimated_minutes: 8 },
            ],
          },
        ],
      },
    ],
  },

  {
    code: "6",
    title: "Reading, Listening and Mock Test",
    submodules: [
      {
        code: "1",
        title: "Reading Practice",
        lessons: [
          {
            code: "L1", title: "Short Self-Introduction",
            description: "Read a beginner-level self-introduction passage (80–120 characters). Practice identifying name, age, nationality, and hobbies from simple text.",
            content_type: "reading", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Reading Questions", description: "Answer 5 comprehension questions about the passage.", practice_type: "mcq", estimated_minutes: 8 },
              { title: "Fill-in from Text", description: "Complete 5 sentences with information from the passage.", practice_type: "fill_blank", estimated_minutes: 5 },
            ],
          },
          {
            code: "L2", title: "Daily Schedule Passage",
            description: "Read a simple daily routine paragraph (100–150 characters). Identify times, actions, and places from the text.",
            content_type: "reading", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Schedule Reading Drill", description: "Answer 5 questions: what time, what action, where.", practice_type: "mcq", estimated_minutes: 8 },
              { title: "True/False Practice", description: "Mark 5 statements as true or false based on the passage.", practice_type: "fill_blank", estimated_minutes: 5 },
            ],
          },
        ],
      },
      {
        code: "2",
        title: "Listening Practice",
        lessons: [
          {
            code: "L1", title: "Greetings and Introductions Audio",
            description: "Listen to slow-paced beginner conversations about greetings and self-introductions. Focus on understanding names, countries, and occupations from spoken Japanese.",
            content_type: "listening", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Listening MCQ", description: "Answer 5 multiple-choice questions about the audio dialogue.", practice_type: "listening", estimated_minutes: 8 },
              { title: "Shadowing Practice", description: "Repeat the greeting dialogue line by line to improve pronunciation.", practice_type: "shadowing", estimated_minutes: 7 },
            ],
          },
          {
            code: "L2", title: "Shopping and Restaurant Audio",
            description: "Listen to basic daily-life interactions: ordering at a restaurant and buying items at a shop. Understand numbers, items, and polite request phrases.",
            content_type: "listening", access_type: "premium", estimated_minutes: 15,
            practices: [
              { title: "Listening Fill-in", description: "Fill missing words from the audio in 5 incomplete sentences.", practice_type: "listening", estimated_minutes: 8 },
              { title: "Dialogue Shadowing", description: "Repeat the shopping dialogue to practice natural intonation.", practice_type: "shadowing", estimated_minutes: 7 },
            ],
          },
        ],
      },
      {
        code: "3",
        title: "Review and Mock Test",
        lessons: [
          {
            code: "L1", title: "N5 Grammar Review",
            description: "Comprehensive review of all N5 core grammar: particles (は/が/を/で/に/へ), verb forms (ます/ません/ました/ませんでした), adjective forms, and sentence patterns.",
            content_type: "grammar", access_type: "premium", estimated_minutes: 30,
            practices: [
              { title: "Mixed Grammar Test", description: "30-question timed grammar review covering all N5 patterns.", practice_type: "mcq", estimated_minutes: 20 },
            ],
          },
          {
            code: "L2", title: "JLPT N5 Mock Test",
            description: "Full N5-style test simulation: vocabulary section (25 questions), grammar section (25 questions), and reading comprehension (2 short passages). Timed at 60 minutes.",
            content_type: "mock_test", access_type: "premium", estimated_minutes: 60,
            practices: [
              { title: "Final N5 Assessment", description: "Complete the 75-question N5 mock exam under timed conditions. Receive a score and level-up recommendation.", practice_type: "mcq", estimated_minutes: 60 },
            ],
          },
        ],
      },
    ],
  },
];
