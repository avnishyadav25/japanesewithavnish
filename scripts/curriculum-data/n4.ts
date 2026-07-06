import type { ModuleEntry } from "./types";

export const n4Modules: ModuleEntry[] = [
  {
    code: "1",
    title: "Sentence Expansion",
    submodules: [
      {
        code: "1", title: "Plain Form Basics",
        lessons: [
          { code: "L1", title: "Dictionary Form Basics", description: "Learn the plain/casual dictionary form for all verb groups. Contrast with ます form and understand when each is used — casual speech, subordinate clauses, and plain-style writing.", content_type: "grammar", access_type: "free", estimated_minutes: 20, practices: [{ title: "Dictionary Form Drill", description: "Convert 15 ます-form verbs into their dictionary form.", practice_type: "fill_blank", estimated_minutes: 10 }, { title: "Dictionary Form MCQ", description: "Identify the correct dictionary form for each verb given.", practice_type: "mcq", estimated_minutes: 8 }] },
          { code: "L2", title: "ない Form — Plain Negative", description: "Learn the ない form (plain negative) for all verb groups. Use it in casual speech and in grammar patterns like 〜ないでください and 〜なければなりません.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "ない Form Practice", description: "Convert 15 positive plain verbs into their ない negative forms.", practice_type: "fill_blank", estimated_minutes: 10 }, { title: "Casual Negative MCQ", description: "Choose the correct ない form for each given verb.", practice_type: "mcq", estimated_minutes: 8 }] },
          { code: "L3", title: "た Form — Plain Past", description: "Learn the plain past tense た form for all verb groups. Practice the alternation rules (く→いた, ぐ→いだ, etc.) and use it to form 〜たことがある and 〜たあとで.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "た Form Drill", description: "Convert 15 verbs into their plain past た form.", practice_type: "fill_blank", estimated_minutes: 10 }, { title: "Past Form MCQ", description: "Choose the correct た form for each verb.", practice_type: "mcq", estimated_minutes: 8 }] },
        ],
      },
      {
        code: "2", title: "Connecting Sentences",
        lessons: [
          { code: "L1", title: "て Form — Connecting Actions", description: "Learn the て form for connecting multiple actions sequentially. Master the て form alternation rules. Use 〜て to express doing A then B.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "て Form Chain Practice", description: "Connect 3–4 actions in sequence using the て form.", practice_type: "roleplay", estimated_minutes: 10 }, { title: "て Form Fill-in", description: "Complete 12 sentence chains by filling the correct て form.", practice_type: "fill_blank", estimated_minutes: 8 }] },
          { code: "L2", title: "てください — Polite Requests", description: "Use the て form + ください to make polite requests. Learn the difference between commands (てください) and suggestions (ましょう). Practice in classroom and daily situations.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Request Dialogue", description: "Create 5 everyday polite request conversations.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Request Fill-in", description: "Fill in 10 sentences with the correct てください form.", practice_type: "fill_blank", estimated_minutes: 5 }] },
        ],
      },
    ],
  },

  {
    code: "2",
    title: "Ability, Experience and Plans",
    submodules: [
      {
        code: "1", title: "Ability and Experience",
        lessons: [
          { code: "L1", title: "ことができます — Ability", description: "Express ability using [verb dictionary form] + ことができます. Compare with potential verb forms (食べられます). Build sentences about skills and abilities.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Ability Sentences", description: "Write 10 ability statements about yourself using ことができます.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Ability MCQ", description: "Choose ことができます or the potential form for each sentence.", practice_type: "mcq", estimated_minutes: 5 }] },
          { code: "L2", title: "たことがあります — Past Experience", description: "Express past life experience using [た form] + ことがあります. Distinguish from simple past tense. Practice interview-style conversation about experiences.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Experience Interview", description: "Ask and answer 8 experience questions using たことがあります.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Experience Fill-in", description: "Complete 8 sentences about experiences.", practice_type: "fill_blank", estimated_minutes: 5 }] },
        ],
      },
      {
        code: "2", title: "Plans and Sequence",
        lessons: [
          { code: "L1", title: "つもりです — Intentions and Plans", description: "Express intentions using [dictionary form] + つもりです and [ない form] + つもりです. Contrast with 〜と思っています for more uncertain plans.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Future Plan Practice", description: "Write 5 weekend and future plans using つもりです.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Plan Fill-in", description: "Complete 8 intention sentences.", practice_type: "fill_blank", estimated_minutes: 5 }] },
          { code: "L2", title: "前に / 後で — Action Order", description: "Express action sequence using [dictionary form] + 前に (before) and [た form] + 後で (after). Build complex time-ordered sentences.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Sequence Drill", description: "Arrange 10 actions in the correct order using 前に and 後で.", practice_type: "fill_blank", estimated_minutes: 8 }, { title: "Sequence Roleplay", description: "Describe a morning routine using 前に and 後で.", practice_type: "roleplay", estimated_minutes: 7 }] },
          { code: "L3", title: "なければなりません — Obligation", description: "Express must/have to using 〜なければなりません (plain form: なきゃ/なければ). Use in school, work, and daily life contexts.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Obligation Practice", description: "Write 8 school or work rules using なければなりません.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Obligation Fill-in", description: "Complete 8 obligation sentences.", practice_type: "fill_blank", estimated_minutes: 5 }] },
        ],
      },
    ],
  },

  {
    code: "3",
    title: "Giving, Receiving and Social Actions",
    submodules: [
      {
        code: "1", title: "Giving and Receiving Verbs",
        lessons: [
          { code: "L1", title: "あげる / くれる — Giving", description: "Learn the two giving verbs from the speaker's perspective: あげる (I/we give outward) and くれる (someone gives to me/in-group). Master the directional logic of Japanese giving verbs.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Gift Situation Practice", description: "Choose the correct giving verb for 10 gift scenarios.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Giving Roleplay", description: "Act out 3 gift exchange situations using the correct verb.", practice_type: "roleplay", estimated_minutes: 8 }] },
          { code: "L2", title: "もらう — Receiving", description: "Learn もらう (receive/get from someone). Practice [person] に/から もらいます patterns. Contrast with くれる from the receiver's perspective.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Receiving Sentence Drill", description: "Describe 8 scenarios of who received what from whom.", practice_type: "fill_blank", estimated_minutes: 8 }, { title: "Receiving MCQ", description: "Choose くれる or もらう for each receiving situation.", practice_type: "mcq", estimated_minutes: 5 }] },
        ],
      },
      {
        code: "2", title: "Favor and Permission Expressions",
        lessons: [
          { code: "L1", title: "てあげる / てくれる / てもらう", description: "Extend giving/receiving to actions: doing a favor for someone (てあげる), someone doing a favor for you (てくれる), having someone do something for you (てもらう). Build natural social conversation.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Favor Roleplay", description: "Create 5 favor conversation exchanges using all three patterns.", practice_type: "roleplay", estimated_minutes: 10 }, { title: "Favor MCQ", description: "Choose the correct favor verb for each situation.", practice_type: "mcq", estimated_minutes: 8 }] },
          { code: "L2", title: "てもいいです — Permission", description: "Learn to ask and grant permission using [て form] + もいいですか. Learn the negative 〜てはいけません. Practice in school, work, and public contexts.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Permission Drill", description: "Ask for permission in 8 daily contexts.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Permission Fill-in", description: "Complete 8 permission request sentences.", practice_type: "fill_blank", estimated_minutes: 5 }] },
          { code: "L3", title: "てはいけません — Prohibition", description: "Express rules and restrictions using [て form] + はいけません. Practice writing classroom rules, public signs, and workplace rules.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Rule Writing Practice", description: "Write 8 classroom or public space rules using てはいけません.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Prohibition MCQ", description: "Identify which actions are prohibited from signs and rules.", practice_type: "mcq", estimated_minutes: 5 }] },
        ],
      },
    ],
  },

  {
    code: "4",
    title: "Everyday Communication",
    submodules: [
      {
        code: "1", title: "Reasons and Explanation",
        lessons: [
          { code: "L1", title: "から / ので — Giving Reasons", description: "Express reasons using から (because, casual) and ので (because, polite/formal). Understand the register difference and when to use each in daily communication.", content_type: "grammar", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Reason Sentence Drill", description: "Explain 10 choices or actions using から and ので.", practice_type: "fill_blank", estimated_minutes: 8 }, { title: "Register Choice MCQ", description: "Choose から or ので based on the formality of each situation.", practice_type: "mcq", estimated_minutes: 5 }] },
        ],
      },
      {
        code: "2", title: "Daily Life Topics",
        lessons: [
          { code: "L1", title: "趣味 and Interests", description: "Talk about hobbies and preferences using 趣味は〜です and 〜が好きです/きらいです/得意です. Build natural conversations about leisure activities.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Hobby Conversation", description: "Build a short 8-line dialogue about hobbies.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Hobby MCQ", description: "Choose the correct expression for each hobby context.", practice_type: "mcq", estimated_minutes: 5 }] },
          { code: "L2", title: "Shopping — Price, Quantity, Comparison", description: "Handle shopping situations: asking prices (いくらですか), talking about quantity (〜つ/個), and comparing items (〜の方が/〜より). Practice in shop roleplay.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Shopping Roleplay", description: "Act out a shopping trip: ask prices, compare 2 items, and buy one.", practice_type: "roleplay", estimated_minutes: 10 }, { title: "Comparison Fill-in", description: "Complete 8 comparison sentences using より and の方が.", practice_type: "fill_blank", estimated_minutes: 8 }] },
          { code: "L3", title: "Directions and Transport", description: "Learn travel vocabulary and direction expressions: まっすぐ, 右, 左, 曲がる. Use 〜て行く/来る to describe routes. Practice explaining how to get somewhere.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Direction Listening", description: "Listen to route directions and identify the destination on a map.", practice_type: "listening", estimated_minutes: 10 }, { title: "Direction Roleplay", description: "Give directions from the station to a landmark.", practice_type: "roleplay", estimated_minutes: 8 }] },
          { code: "L4", title: "Body and Health Vocabulary", description: "Learn body parts and health vocabulary: 頭, 熱, 気分が悪い, 病院, 薬. Explain simple health problems politely to a doctor or pharmacist.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 15, practices: [{ title: "Clinic Roleplay", description: "Describe symptoms politely and ask for treatment at a clinic.", practice_type: "roleplay", estimated_minutes: 8 }, { title: "Health Vocabulary MCQ", description: "Match body parts and symptoms to their Japanese terms.", practice_type: "mcq", estimated_minutes: 5 }] },
        ],
      },
    ],
  },

  {
    code: "5",
    title: "N4 Kanji and Vocabulary",
    submodules: [
      {
        code: "1", title: "N4 Kanji Sets",
        lessons: [
          { code: "L1", title: "Daily Life Kanji", description: "Learn 8 high-frequency daily life kanji: 食飲買見聞読書話. Master both on-yomi and kun-yomi readings. Read each in example sentences.", content_type: "kanji", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Kanji Reading Practice", description: "Read the 8 daily life kanji in 16 short sentences.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Kanji Writing Drill", description: "Write each of the 8 kanji 5 times on the stroke canvas.", practice_type: "writing_canvas", estimated_minutes: 12 }] },
          { code: "L2", title: "Travel and Place Kanji", description: "Learn 7 travel and place kanji: 電車道駅店会社町. Connect to vocabulary from the directions and daily life lessons.", content_type: "kanji", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Kanji Writing Drill", description: "Write kanji + readings for all 7 characters.", practice_type: "writing_canvas", estimated_minutes: 12 }, { title: "Place Kanji MCQ", description: "Choose the correct kanji reading for each place-related sentence.", practice_type: "mcq", estimated_minutes: 10 }] },
          { code: "L3", title: "People and Feelings Kanji", description: "Learn 7 kanji about people and inner states: 体病友私彼思知. Use in sentences about health, relationships, and thoughts.", content_type: "kanji", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Kanji Meaning Quiz", description: "Match 7 kanji to their meanings and choose correct readings.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Kanji Writing Drill", description: "Write all 7 people/feelings kanji with stroke order.", practice_type: "writing_canvas", estimated_minutes: 12 }] },
        ],
      },
      {
        code: "2", title: "N4 Vocabulary and Expressions",
        lessons: [
          { code: "L1", title: "1200 Core N4 Words", description: "Study the 1200 most important N4 vocabulary words organized by theme: verbs, adjectives, nouns, and adverbs. Daily spaced repetition review with example sentences.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Flashcard SRS Review", description: "Daily 20-card spaced repetition session with example sentences.", practice_type: "mcq", estimated_minutes: 15 }] },
          { code: "L2", title: "Daily Conversation Phrases", description: "Learn 30 natural short expressions used in everyday Japanese: そうですね、なるほど、ちょっと待って、大丈夫ですか. Improve conversational flow.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Dialogue Completion", description: "Fill the correct natural expression in 10 short conversation exchanges.", practice_type: "fill_blank", estimated_minutes: 10 }, { title: "Expression MCQ", description: "Choose the most natural phrase for each social situation.", practice_type: "mcq", estimated_minutes: 8 }] },
        ],
      },
    ],
  },

  {
    code: "6",
    title: "N4 Reading, Listening and Mock Test",
    submodules: [
      {
        code: "1", title: "Reading Practice",
        lessons: [
          { code: "L1", title: "Notices and Short Messages", description: "Read N4-level signs, emails, and short notices (200–350 characters). Extract key information: who, what, when, where.", content_type: "reading", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Notice Comprehension", description: "Answer 5 information-finding questions about a notice.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Key Info Fill-in", description: "Extract and fill in who/what/when/where from a notice.", practice_type: "fill_blank", estimated_minutes: 8 }] },
          { code: "L2", title: "Short Articles", description: "Read 300–500 character passages on familiar topics. Practice finding the main idea and supporting details.", content_type: "reading", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Main Idea Practice", description: "Identify the topic and 2 key details from each passage.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Detail Extraction", description: "Answer 5 specific detail questions about the passage.", practice_type: "fill_blank", estimated_minutes: 8 }] },
        ],
      },
      {
        code: "2", title: "Listening Practice",
        lessons: [
          { code: "L1", title: "Daily Conversations Audio", description: "Understand natural N4-level conversations in school, shopping, and travel contexts. Focus on speaker intent and factual information.", content_type: "listening", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Listening MCQ", description: "Choose the correct response for 5 dialogue questions.", practice_type: "listening", estimated_minutes: 10 }, { title: "Dialogue Shadowing", description: "Shadow the N4 daily conversation audio to improve listening.", practice_type: "shadowing", estimated_minutes: 8 }] },
          { code: "L2", title: "Instructions and Requests Audio", description: "Listen to instructions given in workplace, school, and public contexts. Understand what action to take next.", content_type: "listening", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Action Selection Drill", description: "Pick the correct next action from 5 instruction sets.", practice_type: "listening", estimated_minutes: 10 }, { title: "Instruction Shadowing", description: "Shadow instruction-style audio to improve listening accuracy.", practice_type: "shadowing", estimated_minutes: 8 }] },
        ],
      },
      {
        code: "3", title: "Review and Mock Test",
        lessons: [
          { code: "L1", title: "N4 Grammar Review", description: "Comprehensive review of all N4 grammar: て form, plain forms, 〜たことがある, 〜つもり, giving/receiving, permission, obligation, reason expressions.", content_type: "grammar", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Mixed N4 Test", description: "40-question grammar, vocabulary, and reading mixed test.", practice_type: "mcq", estimated_minutes: 25 }] },
          { code: "L2", title: "JLPT N4 Mock Exam", description: "Full N4-style mock exam: vocabulary (30Q), grammar (30Q), reading (2 passages, 10Q), listening (3 dialogues, 10Q). Total 80 minutes.", content_type: "mock_test", access_type: "premium", estimated_minutes: 80, practices: [{ title: "Final N4 Assessment", description: "Complete the full 80-question N4 mock exam with score and N3 recommendation.", practice_type: "mcq", estimated_minutes: 80 }] },
        ],
      },
    ],
  },
];
