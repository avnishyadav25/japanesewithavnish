import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required in environment variables.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface QuestionInput {
  question_text: string;
  options: string[];
  correct_index: number;
  jlpt_level: string;
  sort_order: number;
}

const QUESTIONS: QuestionInput[] = [
  // N5 Questions
  {
    question_text: "What does 'こんにちは' (konnichiwa) mean?",
    options: ["Good morning", "Hello", "Goodbye", "Thank you"],
    correct_index: 1,
    jlpt_level: "N5",
    sort_order: 1,
  },
  {
    question_text: "Which is the correct reading of the kanji '水'?",
    options: ["hi", "mizu", "ki", "tsuki"],
    correct_index: 1,
    jlpt_level: "N5",
    sort_order: 2,
  },
  {
    question_text: "Which particle is used to mark the grammatical subject of a sentence?",
    options: ["を (o)", "に (ni)", "が (ga)", "で (de)"],
    correct_index: 2,
    jlpt_level: "N5",
    sort_order: 3,
  },
  {
    question_text: "What is the polite (masu) form of the verb '食べる' (taberu - to eat)?",
    options: ["食べた (tabeta)", "食べます (tabemasu)", "食べない (tabenai)", "食べて (tabete)"],
    correct_index: 1,
    jlpt_level: "N5",
    sort_order: 4,
  },
  {
    question_text: "What does the word 'ありがとう' (arigatou) mean?",
    options: ["I am sorry", "Excuse me", "Thank you", "Good night"],
    correct_index: 2,
    jlpt_level: "N5",
    sort_order: 5,
  },
  {
    question_text: "Which is the correct reading of '日本'?",
    options: ["Nihon", "Honya", "Namae", "Neko"],
    correct_index: 0,
    jlpt_level: "N5",
    sort_order: 6,
  },
  {
    question_text: "What does 'ともだち' (tomodachi) mean?",
    options: ["Teacher", "Friend", "Student", "Family"],
    correct_index: 1,
    jlpt_level: "N5",
    sort_order: 7,
  },
  {
    question_text: "What is the past tense of the verb 'する' (suru - to do)?",
    options: ["する", "します", "した (shita)", "して"],
    correct_index: 2,
    jlpt_level: "N5",
    sort_order: 8,
  },
  {
    question_text: "Which particle is used to indicate direction or destination of movement?",
    options: ["を (o)", "に (ni)", "は (wa)", "と (to)"],
    correct_index: 1,
    jlpt_level: "N5",
    sort_order: 9,
  },
  {
    question_text: "What does 'くるま' (kuruma) mean?",
    options: ["Train", "Bicycle", "Airplane", "Car"],
    correct_index: 3,
    jlpt_level: "N5",
    sort_order: 10,
  },

  // N4 Questions
  {
    question_text: "What is the potential form of the verb '食べる' (to eat) meaning 'can eat'?",
    options: ["食べられる (taberareru)", "食べさせる (tabesaseru)", "食べたい (tabetai)", "食べそう (tabesou)"],
    correct_index: 0,
    jlpt_level: "N4",
    sort_order: 11,
  },
  {
    question_text: "Translate: 'Please read this book.'",
    options: ["この本を読んでください", "この本を読みます", "この本を読んだ", "この本を読みましょう"],
    correct_index: 0,
    jlpt_level: "N4",
    sort_order: 12,
  },
  {
    question_text: "What is the reading of the kanji '病院'?",
    options: ["kouen", "byouin", "gakkou", "eki"],
    correct_index: 1,
    jlpt_level: "N4",
    sort_order: 13,
  },
  {
    question_text: "Which particle is used for comparison, meaning 'than' (e.g. A is bigger than B)?",
    options: ["より (yori)", "ほど (hodo)", "から (kara)", "まで (made)"],
    correct_index: 0,
    jlpt_level: "N4",
    sort_order: 14,
  },
  {
    question_text: "How do you express: 'I think that...' in Japanese?",
    options: ["〜と思います (to omoimasu)", "〜と聞きました (to kikimashite)", "〜と言いました (to iimashita)", "〜と見えます (to miemasu)"],
    correct_index: 0,
    jlpt_level: "N4",
    sort_order: 15,
  },
  {
    question_text: "What is the volitional ('let's') form of the verb '行く' (iku - to go)?",
    options: ["行こう (ikou)", "行きます (ikimasu)", "行って (itte)", "行きましょう (ikimashou)"],
    correct_index: 0,
    jlpt_level: "N4",
    sort_order: 16,
  },
  {
    question_text: "What is the reading of the kanji '自転車'?",
    options: ["densha", "jitensha", "kuruma", "hikouki"],
    correct_index: 1,
    jlpt_level: "N4",
    sort_order: 17,
  },
  {
    question_text: "What grammar pattern is used to express that you have experienced doing something in the past?",
    options: ["〜たことがあります", "〜ています", "〜たばかりです", "〜てみます"],
    correct_index: 0,
    jlpt_level: "N4",
    sort_order: 18,
  },
  {
    question_text: "What does the pattern '〜ながら' (e.g. 音楽を聞きながら勉強する) mean?",
    options: ["After doing", "Before doing", "While doing", "Instead of doing"],
    correct_index: 2,
    jlpt_level: "N4",
    sort_order: 19,
  },
  {
    question_text: "What is the correct reading of the verb '働く'?",
    options: ["ugoku", "hataraku", "tsukuru", "yasumu"],
    correct_index: 1,
    jlpt_level: "N4",
    sort_order: 20,
  },

  // N3 Questions
  {
    question_text: "What does the grammar structure '〜はずだ' mean?",
    options: ["Must not do", "Expected to be/should be", "Might be", "In order to do"],
    correct_index: 1,
    jlpt_level: "N3",
    sort_order: 21,
  },
  {
    question_text: "What is the reading of the kanji '準備'?",
    options: ["jumbi", "shumi", "shunbi", "renshuu"],
    correct_index: 0,
    jlpt_level: "N3",
    sort_order: 22,
  },
  {
    question_text: "What does the verb suffix '〜切る' (e.g. 売り切る, 走りきる) express?",
    options: ["To start doing", "To try doing", "To do completely to the end", "To do reluctantly"],
    correct_index: 2,
    jlpt_level: "N3",
    sort_order: 23,
  },
  {
    question_text: "What does the pattern '〜うちに' mean?",
    options: ["After a long time", "While a state is continuing / before it changes", "Because of", "Whenever"],
    correct_index: 1,
    jlpt_level: "N3",
    sort_order: 24,
  },
  {
    question_text: "What is the reading of the kanji '複雑'?",
    options: ["kantant", "fukuzatsu", "fukusou", "zatsudan"],
    correct_index: 1,
    jlpt_level: "N3",
    sort_order: 25,
  },
  {
    question_text: "What does the grammar pattern '〜に代わって' (ni kawatte) mean?",
    options: ["On behalf of / instead of", "In addition to", "Compared to", "According to"],
    correct_index: 0,
    jlpt_level: "N3",
    sort_order: 26,
  },
  {
    question_text: "What is the reading of the kanji '経済'?",
    options: ["seiji", "shakai", "keizai", "rekishi"],
    correct_index: 2,
    jlpt_level: "N3",
    sort_order: 27,
  },
  {
    question_text: "What does '〜おかげで' mean?",
    options: ["Thanks to (positive cause)", "Due to (negative cause)", "In spite of", "Instead of"],
    correct_index: 0,
    jlpt_level: "N3",
    sort_order: 28,
  },
  {
    question_text: "What does the grammar structure '〜に対して' (ni taishite) mean?",
    options: ["Towards / regarding / in contrast to", "Because of", "For the sake of", "Along with"],
    correct_index: 0,
    jlpt_level: "N3",
    sort_order: 29,
  },
  {
    question_text: "What is the reading of the kanji '解決'?",
    options: ["keiyaku", "kaiketsu", "ketsudan", "kaigi"],
    correct_index: 1,
    jlpt_level: "N3",
    sort_order: 30,
  },

  // N2 Questions
  {
    question_text: "What does the auxiliary verb suffix '〜ぬく' (e.g. 走りぬく) express?",
    options: ["To fail to do", "To do until the end through difficulty", "To do accidentally", "To do half-heartedly"],
    correct_index: 1,
    jlpt_level: "N2",
    sort_order: 31,
  },
  {
    question_text: "What is the reading of the kanji '義務'?",
    options: ["gimu", "shakyu", "shokumu", "kenri"],
    correct_index: 0,
    jlpt_level: "N2",
    sort_order: 32,
  },
  {
    question_text: "What does the grammar pattern '〜つつある' mean?",
    options: ["Finished doing", "In the process of doing / continuing to...", "Want to do", "Should do"],
    correct_index: 1,
    jlpt_level: "N2",
    sort_order: 33,
  },
  {
    question_text: "What does the pattern '〜に違いない' (ni chigai nai) mean?",
    options: ["It is impossible that", "Without a doubt / must be", "Might be wrong", "I do not know if"],
    correct_index: 1,
    jlpt_level: "N2",
    sort_order: 34,
  },
  {
    question_text: "What is the reading of the kanji '影響'?",
    options: ["eikyou", "kankyou", "tsugou", "shinfou"],
    correct_index: 0,
    jlpt_level: "N2",
    sort_order: 35,
  },
  {
    question_text: "What does the structure '〜さえ〜ば' (e.g. あなたさえいれば) mean?",
    options: ["Even if you do", "If only / as long as", "Should not do", "Unless you do"],
    correct_index: 1,
    jlpt_level: "N2",
    sort_order: 36,
  },
  {
    question_text: "What is the reading of the kanji '徹底的'?",
    options: ["tetteiteki", "ketteiteki", "kakutiteki", "shinkouteki"],
    correct_index: 0,
    jlpt_level: "N2",
    sort_order: 37,
  },
  {
    question_text: "What does '〜からといって' mean?",
    options: ["Just because...", "Although...", "Therefore...", "Instead of..."],
    correct_index: 0,
    jlpt_level: "N2",
    sort_order: 38,
  },
  {
    question_text: "What does the grammar pattern '〜にかかわらず' mean?",
    options: ["In relation to", "Regardless of / irrespective of", "Because of", "On top of"],
    correct_index: 1,
    jlpt_level: "N2",
    sort_order: 39,
  },
  {
    question_text: "What is the reading of the kanji '貴重'?",
    options: ["kichou", "shinchou", "katsudou", "shichou"],
    correct_index: 0,
    jlpt_level: "N2",
    sort_order: 40,
  },

  // N1 Questions
  {
    question_text: "What does the grammar structure '〜極まりない' (kiwamaritai) mean?",
    options: ["Not very", "Extremely / limits of", "Impossible to", "Hardly any"],
    correct_index: 1,
    jlpt_level: "N1",
    sort_order: 41,
  },
  {
    question_text: "What is the reading of the kanji '妥協'?",
    options: ["dakyou", "dakkou", "shoukyo", "koukai"],
    correct_index: 0,
    jlpt_level: "N1",
    sort_order: 42,
  },
  {
    question_text: "What does the N1 grammar structure '〜ずにはおかない' mean?",
    options: ["Cannot do", "Will definitely do / won't stop until", "Must not do", "No need to do"],
    correct_index: 1,
    jlpt_level: "N1",
    sort_order: 43,
  },
  {
    question_text: "What does the grammar structure '〜にかたくない' (e.g. 想像にかたくない) mean?",
    options: ["It is difficult to...", "It is not difficult to / easy to do", "Must not do...", "No way to..."],
    correct_index: 1,
    jlpt_level: "N1",
    sort_order: 44,
  },
  {
    question_text: "What is the reading of the kanji '崩壊'?",
    options: ["houkai", "soukai", "bouhai", "kouhai"],
    correct_index: 0,
    jlpt_level: "N1",
    sort_order: 45,
  },
  {
    question_text: "What does the grammar structure '〜んがために' mean?",
    options: ["Because of...", "In order to...", "Although...", "Even if..."],
    correct_index: 1,
    jlpt_level: "N1",
    sort_order: 46,
  },
  {
    question_text: "What is the reading of the kanji '葛藤'?",
    options: ["kattou", "gattou", "soutou", "kaitou"],
    correct_index: 0,
    jlpt_level: "N1",
    sort_order: 47,
  },
  {
    question_text: "What does the N1 structure '〜をもって' mean?",
    options: ["By means of / with / at (a time)", "Despite...", "Instead of...", "In contrast to..."],
    correct_index: 0,
    jlpt_level: "N1",
    sort_order: 48,
  },
  {
    question_text: "What does '〜まじき' (e.g. 許すまじき行為) mean?",
    options: ["Should do", "Must not / should not", "Easy to do", "Must do"],
    correct_index: 1,
    jlpt_level: "N1",
    sort_order: 49,
  },
  {
    question_text: "What is the reading of the kanji '顕著'?",
    options: ["kencho", "gencho", "kenjyo", "shouchou"],
    correct_index: 0,
    jlpt_level: "N1",
    sort_order: 50,
  },
];

async function seed() {
  console.log("Seeding advanced quiz questions...");
  try {
    // Truncate existing quiz questions
    await sql`TRUNCATE TABLE quiz_questions CASCADE`;
    console.log("Truncated quiz_questions table.");

    for (const q of QUESTIONS) {
      await sql`
        INSERT INTO quiz_questions (question_text, options, correct_index, jlpt_level, sort_order)
        VALUES (${q.question_text}, ${JSON.stringify(q.options)}::jsonb, ${q.correct_index}, ${q.jlpt_level}, ${q.sort_order})
      `;
    }
    console.log(`Seeded ${QUESTIONS.length} questions successfully.`);
  } catch (err) {
    console.error("Error seeding questions:", err);
    process.exit(1);
  }
}

seed();
