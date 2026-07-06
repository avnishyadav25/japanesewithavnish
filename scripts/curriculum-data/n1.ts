import type { ModuleEntry } from "./types";

export const n1Modules: ModuleEntry[] = [
  {
    code: "1",
    title: "Advanced Grammar Nuance",
    submodules: [
      {
        code: "1", title: "Highly Formal Patterns",
        lessons: [
          { code: "L1", title: "〜をもって / 〜に至る — Formal Markers", description: "Learn highly formal expressions: をもって (by means of / as of a date) and に至る (to reach / to result in). Study in the context of official announcements, contracts, and formal written Japanese.", content_type: "grammar", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Formal Pattern Drill", description: "Interpret and complete 8 formal sentences using をもって and に至る.", practice_type: "fill_blank", estimated_minutes: 12 }, { title: "Formal Context MCQ", description: "Identify the correct usage of each pattern from 4 formal contexts.", practice_type: "mcq", estimated_minutes: 10 }] },
          { code: "L2", title: "書き言葉 Grammar — Written/Literary Style", description: "Understand grammar unique to written Japanese: である (formal copula), に他ならない (none other than), のみ (only). Learn to distinguish spoken vs written registers.", content_type: "grammar", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Written Style Practice", description: "Rewrite 6 casual sentences into formal written Japanese style.", practice_type: "fill_blank", estimated_minutes: 12 }, { title: "Register Identification MCQ", description: "Identify whether each sentence is written or spoken register.", practice_type: "mcq", estimated_minutes: 10 }] },
          { code: "L3", title: "Subtle Difference Patterns", description: "Master the fine differences between near-synonym N1 grammar patterns: につけ vs たびに, をめぐって vs について, に際して vs にあたって. Context determines the correct choice.", content_type: "grammar", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Nuance Choice Test", description: "Pick the best grammar pattern for 12 nuanced contexts.", practice_type: "mcq", estimated_minutes: 15 }, { title: "Nuance Fill-in", description: "Complete 8 sentences with the most appropriate N1 grammar expression.", practice_type: "fill_blank", estimated_minutes: 12 }] },
          { code: "L4", title: "まして / いわんや / すら — Advanced Emphasis", description: "Understand advanced emphasis and escalation: まして (even more so), いわんや (let alone, much less), すら (even). Used in formal speeches, editorials, and academic writing.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Advanced Emphasis Drill", description: "Interpret 8 strong statements using まして, いわんや, or すら.", practice_type: "mcq", estimated_minutes: 10 }, { title: "Emphasis Fill-in", description: "Complete 6 formal sentences with the correct emphasis expression.", practice_type: "fill_blank", estimated_minutes: 8 }] },
          { code: "L5", title: "Advanced Sentence Inversion and Structure", description: "Understand long, complex N1 sentences with inverted structures, multiple embedded clauses, and parenthetical information. Practice breaking sentences into understandable components.", content_type: "grammar", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Sentence Breakdown", description: "Break 6 complex sentences into their core subject-verb-object components.", practice_type: "fill_blank", estimated_minutes: 12 }, { title: "Sentence Structure MCQ", description: "Identify the main clause in 8 long complex sentences.", practice_type: "mcq", estimated_minutes: 10 }] },
        ],
      },
    ],
  },

  {
    code: "2",
    title: "Academic and Editorial Reading",
    submodules: [
      {
        code: "1", title: "Editorial and Academic Text",
        lessons: [
          { code: "L1", title: "Newspaper Editorial Reading", description: "Read newspaper editorials (社説) and understand the writer's argument, tone, and bias. Learn to identify claim, evidence, counterargument, and conclusion in dense text.", content_type: "reading", access_type: "free", estimated_minutes: 30, practices: [{ title: "Editorial Analysis", description: "Identify the claim, tone, and 2 pieces of evidence from an editorial.", practice_type: "fill_blank", estimated_minutes: 15 }, { title: "Editorial Stance MCQ", description: "Determine the writer's position from 4 options based on the text.", practice_type: "mcq", estimated_minutes: 12 }] },
          { code: "L2", title: "Research-Style Academic Japanese", description: "Read abstract academic passages covering social science, education, or science topics. Understand technical vocabulary in context without translation.", content_type: "reading", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Academic Reading Drill", description: "Summarize the central idea of a 600-character academic passage.", practice_type: "fill_blank", estimated_minutes: 15 }, { title: "Academic Detail MCQ", description: "Answer 5 detailed questions about the academic text.", practice_type: "mcq", estimated_minutes: 12 }] },
          { code: "L3", title: "Literary and Opinion Essays", description: "Read abstract reflections and literary essays. Understand metaphor, implied meaning, and the author's perspective beyond the literal text.", content_type: "reading", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Essay Comprehension", description: "Answer 5 inference questions about an opinion essay.", practice_type: "mcq", estimated_minutes: 15 }, { title: "Inference Analysis", description: "Explain what the author implies in 3 key passages.", practice_type: "fill_blank", estimated_minutes: 12 }] },
        ],
      },
      {
        code: "2", title: "Advanced Reading Strategies",
        lessons: [
          { code: "L1", title: "Dense Long-Form Passage Reading", description: "Build sustained reading stamina for 800–1000 character passages with complex argument structures. Complete within exam time constraints.", content_type: "reading", access_type: "premium", estimated_minutes: 35, practices: [{ title: "Timed Long Reading", description: "Complete an 850-character passage with 6 questions under strict timing.", practice_type: "mcq", estimated_minutes: 20 }] },
          { code: "L2", title: "Hidden Meaning and Inference", description: "Understand implied meaning, euphemism, and indirect expression in N1 text. Learn to read between the lines in formal and literary Japanese.", content_type: "reading", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Inference Practice", description: "Choose the best implied meaning for 8 ambiguous passages.", practice_type: "mcq", estimated_minutes: 12 }, { title: "Inference Fill-in", description: "Explain the implied meaning of 5 literary sentences.", practice_type: "fill_blank", estimated_minutes: 10 }] },
        ],
      },
    ],
  },

  {
    code: "3",
    title: "Advanced Vocabulary and Kanji",
    submodules: [
      {
        code: "1", title: "N1 Kanji Sets",
        lessons: [
          { code: "L1", title: "Rare and Formal Kanji", description: "Learn advanced kanji that appear in formal and literary contexts. Study them in complete sentences and understand their compound forms.", content_type: "kanji", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Advanced Kanji Reading", description: "Read 10 formal sentences containing rare N1 kanji.", practice_type: "mcq", estimated_minutes: 12 }, { title: "Formal Kanji Writing", description: "Write 8 rare kanji with correct stroke order on the canvas.", practice_type: "writing_canvas", estimated_minutes: 15 }] },
          { code: "L2", title: "Academic and Abstract Kanji", description: "Learn kanji used in research, society commentary, and abstract analysis. Build vocabulary compounds for academic reading.", content_type: "kanji", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Kanji Meaning Drill", description: "Match 10 academic kanji to their meanings and choose correct readings.", practice_type: "mcq", estimated_minutes: 12 }, { title: "Academic Kanji Writing", description: "Write 8 academic kanji with stroke order.", practice_type: "writing_canvas", estimated_minutes: 15 }] },
        ],
      },
      {
        code: "2", title: "N1 Vocabulary and Expressions",
        lessons: [
          { code: "L1", title: "N1 Abstract Vocabulary", description: "Learn advanced abstract vocabulary for N1: 概念 (concept), 矛盾 (contradiction), 妥当 (appropriate), 偏見 (bias). Use in academic and formal sentence contexts.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Usage Sentence Practice", description: "Use 12 abstract N1 vocabulary words in formal sentences.", practice_type: "fill_blank", estimated_minutes: 15 }] },
          { code: "L2", title: "慣用句 — Idiomatic Expressions", description: "Learn 25 common Japanese idiomatic expressions: 頭が固い (stubborn), 腹を割る (to be frank), 馬が合う (to get along well). Understand their figurative meanings.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Idiom Meaning Quiz", description: "Choose the correct interpretation for 10 idioms from context.", practice_type: "mcq", estimated_minutes: 12 }, { title: "Idiom Fill-in", description: "Complete 8 sentences with the most appropriate idiom.", practice_type: "fill_blank", estimated_minutes: 10 }] },
          { code: "L3", title: "Fine Meaning Differences — Advanced Synonyms", description: "Master nuanced word choice at the N1 level: 見る/眺める/見つめる, 考える/検討する/熟考する. Understand connotation, register, and collocation differences.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Word Nuance Test", description: "Pick the best word for 12 nuanced formal contexts.", practice_type: "mcq", estimated_minutes: 12 }, { title: "Synonym Comparison", description: "Explain the difference between 5 word pairs in your own words.", practice_type: "fill_blank", estimated_minutes: 10 }] },
        ],
      },
    ],
  },

  {
    code: "4",
    title: "Debate, Opinion and Interpretation",
    submodules: [
      {
        code: "1", title: "Formal Argument and Opinion",
        lessons: [
          { code: "L1", title: "Building Formal Arguments", description: "Learn how Japanese formal arguments are structured: 主張 (thesis), 根拠 (grounds), 反論 (counterargument), 結論 (conclusion). Practice writing logically structured opinion outlines.", content_type: "grammar", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Argument Outline", description: "Write a 5-part argument outline on a given social topic.", practice_type: "roleplay", estimated_minutes: 15 }, { title: "Argument Structure MCQ", description: "Identify the argument component of each paragraph.", practice_type: "mcq", estimated_minutes: 8 }] },
          { code: "L2", title: "Paraphrasing Complex Japanese", description: "Restate complex N1 sentences in simpler Japanese. Key JLPT skill for both reading comprehension and writing tasks.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Paraphrase Practice", description: "Rewrite 8 complex N1 sentences in simpler Japanese.", practice_type: "fill_blank", estimated_minutes: 12 }, { title: "Paraphrase MCQ", description: "Choose the best paraphrase for 5 difficult sentences.", practice_type: "mcq", estimated_minutes: 8 }] },
          { code: "L3", title: "Agree/Disagree Formally", description: "Express formal agreement and disagreement: 〜に賛成/反対する, 〜は一理ある, 〜には疑問を感じる. Build structured response to a given opinion.", content_type: "grammar", access_type: "premium", estimated_minutes: 20, practices: [{ title: "Opinion Writing", description: "Write a 100-character structured agreement or disagreement response.", practice_type: "roleplay", estimated_minutes: 12 }, { title: "Formal Opinion MCQ", description: "Choose the most appropriate formal opinion expression.", practice_type: "mcq", estimated_minutes: 6 }] },
        ],
      },
      {
        code: "2", title: "Debate Audio and Summarizing",
        lessons: [
          { code: "L1", title: "Debate and Discussion Audio", description: "Listen to multiple speakers discussing a topic with different viewpoints. Track each speaker's position and the flow of the debate.", content_type: "listening", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Viewpoint Mapping", description: "Track each speaker's position in a 4-person debate audio.", practice_type: "listening", estimated_minutes: 15 }] },
          { code: "L2", title: "Summarizing Long Japanese Texts", description: "Summarize dense 800–1000 character formal texts in 100–150 characters. Capture only the most essential information without copying phrases.", content_type: "reading", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Summary Practice", description: "Write a 120-character summary of a formal passage.", practice_type: "roleplay", estimated_minutes: 15 }] },
        ],
      },
    ],
  },

  {
    code: "5",
    title: "Native-Level Listening",
    submodules: [
      {
        code: "1", title: "News and Documentary Listening",
        lessons: [
          { code: "L1", title: "News and Formal Reports", description: "Understand formal news broadcasts and report-style Japanese at native speed. Extract key facts from short news segments.", content_type: "listening", access_type: "premium", estimated_minutes: 25, practices: [{ title: "News Listening Quiz", description: "Extract who/what/where/when from 4 news audio segments.", practice_type: "listening", estimated_minutes: 12 }, { title: "News Shadowing", description: "Shadow 90 seconds of news audio to match broadcaster rhythm.", practice_type: "shadowing", estimated_minutes: 10 }] },
          { code: "L2", title: "Documentary-Style Japanese", description: "Listen to long explanatory monologues about science, society, or culture. Track the topic, supporting points, and final conclusion.", content_type: "listening", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Detail Tracking", description: "Track the topic, 3 supporting points, and conclusion from a documentary segment.", practice_type: "listening", estimated_minutes: 12 }, { title: "Documentary Shadowing", description: "Shadow formal explanation Japanese to improve prosody.", practice_type: "shadowing", estimated_minutes: 10 }] },
          { code: "L3", title: "Academic Lectures and Seminars", description: "Understand formal lecture-style Japanese with technical vocabulary, extended monologue structure, and academic register.", content_type: "listening", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Lecture Note Practice", description: "Take structured notes while listening to a 3-minute academic lecture.", practice_type: "fill_blank", estimated_minutes: 12 }, { title: "Lecture MCQ", description: "Answer 5 comprehension questions about the lecture content.", practice_type: "mcq", estimated_minutes: 10 }] },
        ],
      },
      {
        code: "2", title: "Debate and Speaker Intention Audio",
        lessons: [
          { code: "L1", title: "Fast Opinion Exchanges", description: "Understand rapid-fire opinion exchanges and disagreements in native-speed Japanese. Identify attitude, intent, and implication from intonation and word choice.", content_type: "listening", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Speaker Intention Quiz", description: "Identify each speaker's intention and attitude in 5 exchange segments.", practice_type: "listening", estimated_minutes: 12 }, { title: "Opinion Shadowing", description: "Shadow fast opinion exchange audio to improve reaction speed.", practice_type: "shadowing", estimated_minutes: 10 }] },
          { code: "L2", title: "N1 Native Shadowing Training", description: "Train near-native rhythm, intonation, and speed through sustained shadowing of authentic native audio. Focus on complex sentence prosody.", content_type: "listening", access_type: "premium", estimated_minutes: 25, practices: [{ title: "Advanced Shadowing", description: "Shadow 2 minutes of complex native audio and compare your recording.", practice_type: "shadowing", estimated_minutes: 20 }] },
        ],
      },
    ],
  },

  {
    code: "6",
    title: "N1 Final Review and Mock Test",
    submodules: [
      {
        code: "1", title: "Complete N1 Review",
        lessons: [
          { code: "L1", title: "N1 Grammar Master Review", description: "Systematic review of all advanced N1 grammar by function: formal patterns, literary style, nuance differences, emphasis, and complex sentence structure.", content_type: "grammar", access_type: "premium", estimated_minutes: 40, practices: [{ title: "Advanced Grammar Test", description: "Complete an 80-question N1 grammar review covering all major patterns.", practice_type: "mcq", estimated_minutes: 40 }] },
          { code: "L2", title: "N1 Vocabulary Master Review", description: "Review rare, formal, and academic vocabulary. Test knowledge of abstract words, idioms, and synonym differences.", content_type: "vocabulary", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Vocab Master Test", description: "Complete a 50-question timed vocabulary mastery test.", practice_type: "mcq", estimated_minutes: 25 }] },
          { code: "L3", title: "N1 Reading Strategy and Review", description: "Practice N1 reading strategies on editorials, academic texts, and long passages. Timed with strict exam constraints.", content_type: "reading", access_type: "premium", estimated_minutes: 40, practices: [{ title: "Long Reading Mock", description: "Complete a timed N1 reading section: 3 passages, 18 questions, 25 minutes.", practice_type: "mcq", estimated_minutes: 25 }] },
          { code: "L4", title: "N1 Listening Strategy Review", description: "Practice all N1 listening formats: news, lectures, debates, and rapid exchanges. Build speed and accuracy under exam timing.", content_type: "listening", access_type: "premium", estimated_minutes: 30, practices: [{ title: "Listening Mock Section", description: "Complete the full N1 listening section: 5 segments, 15 questions.", practice_type: "listening", estimated_minutes: 25 }] },
          { code: "L5", title: "JLPT N1 Full Mock Exam", description: "Complete full-length N1 mock: vocabulary (40Q), grammar (40Q), reading (4 passages, 18Q), listening (5 segments, 15Q). Total 110 minutes.", content_type: "mock_test", access_type: "premium", estimated_minutes: 110, practices: [{ title: "Final N1 Assessment", description: "Complete the full N1 mock exam. Receive score, weak area analysis, and final mastery plan.", practice_type: "mcq", estimated_minutes: 110 }] },
        ],
      },
    ],
  },
];
