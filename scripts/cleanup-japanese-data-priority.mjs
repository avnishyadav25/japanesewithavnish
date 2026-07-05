import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new Client({ connectionString: DATABASE_URL });

const kanaRows = [
  ["あ", "hiragana", "a", "a", 10, 3], ["い", "hiragana", "i", "a", 11, 2], ["う", "hiragana", "u", "a", 12, 2], ["え", "hiragana", "e", "a", 13, 2], ["お", "hiragana", "o", "a", 14, 3],
  ["か", "hiragana", "ka", "ka", 20, 3], ["き", "hiragana", "ki", "ka", 21, 4], ["く", "hiragana", "ku", "ka", 22, 1], ["け", "hiragana", "ke", "ka", 23, 3], ["こ", "hiragana", "ko", "ka", 24, 2],
  ["さ", "hiragana", "sa", "sa", 30, 3], ["し", "hiragana", "shi", "sa", 31, 1], ["す", "hiragana", "su", "sa", 32, 2], ["せ", "hiragana", "se", "sa", 33, 3], ["そ", "hiragana", "so", "sa", 34, 1],
  ["た", "hiragana", "ta", "ta", 40, 4], ["ち", "hiragana", "chi", "ta", 41, 2], ["つ", "hiragana", "tsu", "ta", 42, 1], ["て", "hiragana", "te", "ta", 43, 1], ["と", "hiragana", "to", "ta", 44, 2],
  ["な", "hiragana", "na", "na", 50, 4], ["に", "hiragana", "ni", "na", 51, 3], ["ぬ", "hiragana", "nu", "na", 52, 2], ["ね", "hiragana", "ne", "na", 53, 2], ["の", "hiragana", "no", "na", 54, 1],
  ["は", "hiragana", "ha", "ha", 60, 3], ["ひ", "hiragana", "hi", "ha", 61, 1], ["ふ", "hiragana", "fu", "ha", 62, 4], ["へ", "hiragana", "he", "ha", 63, 1], ["ほ", "hiragana", "ho", "ha", 64, 4],
  ["ま", "hiragana", "ma", "ma", 70, 3], ["み", "hiragana", "mi", "ma", 71, 2], ["む", "hiragana", "mu", "ma", 72, 3], ["め", "hiragana", "me", "ma", 73, 2], ["も", "hiragana", "mo", "ma", 74, 3],
  ["や", "hiragana", "ya", "ya", 80, 3], ["ゆ", "hiragana", "yu", "ya", 82, 2], ["よ", "hiragana", "yo", "ya", 84, 2],
  ["ら", "hiragana", "ra", "ra", 90, 2], ["り", "hiragana", "ri", "ra", 91, 2], ["る", "hiragana", "ru", "ra", 92, 1], ["れ", "hiragana", "re", "ra", 93, 2], ["ろ", "hiragana", "ro", "ra", 94, 1],
  ["わ", "hiragana", "wa", "wa", 100, 2], ["を", "hiragana", "wo", "wa", 103, 3], ["ん", "hiragana", "n", "n", 110, 1],
  ["ア", "katakana", "a", "a", 1010, 2], ["イ", "katakana", "i", "a", 1011, 2], ["ウ", "katakana", "u", "a", 1012, 3], ["エ", "katakana", "e", "a", 1013, 3], ["オ", "katakana", "o", "a", 1014, 3],
  ["カ", "katakana", "ka", "ka", 1020, 2], ["キ", "katakana", "ki", "ka", 1021, 3], ["ク", "katakana", "ku", "ka", 1022, 2], ["ケ", "katakana", "ke", "ka", 1023, 3], ["コ", "katakana", "ko", "ka", 1024, 2],
  ["サ", "katakana", "sa", "sa", 1030, 3], ["シ", "katakana", "shi", "sa", 1031, 3], ["ス", "katakana", "su", "sa", 1032, 2], ["セ", "katakana", "se", "sa", 1033, 2], ["ソ", "katakana", "so", "sa", 1034, 2],
  ["タ", "katakana", "ta", "ta", 1040, 3], ["チ", "katakana", "chi", "ta", 1041, 3], ["ツ", "katakana", "tsu", "ta", 1042, 3], ["テ", "katakana", "te", "ta", 1043, 3], ["ト", "katakana", "to", "ta", 1044, 2],
  ["ナ", "katakana", "na", "na", 1050, 2], ["ニ", "katakana", "ni", "na", 1051, 2], ["ヌ", "katakana", "nu", "na", 1052, 2], ["ネ", "katakana", "ne", "na", 1053, 4], ["ノ", "katakana", "no", "na", 1054, 1],
  ["ハ", "katakana", "ha", "ha", 1060, 2], ["ヒ", "katakana", "hi", "ha", 1061, 2], ["フ", "katakana", "fu", "ha", 1062, 1], ["ヘ", "katakana", "he", "ha", 1063, 1], ["ホ", "katakana", "ho", "ha", 1064, 4],
  ["マ", "katakana", "ma", "ma", 1070, 2], ["ミ", "katakana", "mi", "ma", 1071, 3], ["ム", "katakana", "mu", "ma", 1072, 2], ["メ", "katakana", "me", "ma", 1073, 2], ["モ", "katakana", "mo", "ma", 1074, 3],
  ["ヤ", "katakana", "ya", "ya", 1080, 2], ["ユ", "katakana", "yu", "ya", 1082, 2], ["ヨ", "katakana", "yo", "ya", 1084, 3],
  ["ラ", "katakana", "ra", "ra", 1090, 2], ["リ", "katakana", "ri", "ra", 1091, 2], ["ル", "katakana", "ru", "ra", 1092, 2], ["レ", "katakana", "re", "ra", 1093, 1], ["ロ", "katakana", "ro", "ra", 1094, 3],
  ["ワ", "katakana", "wa", "wa", 1100, 2], ["ヲ", "katakana", "wo", "wa", 1103, 3], ["ン", "katakana", "n", "n", 1110, 2],
];

const vocabularyRepairs = [
  { id: "81bd2485-71ce-4929-a975-426fee434aeb", word: "大きい", reading: "おおきい", romaji: "ookii", partOfSpeech: "i-adjective" },
  { id: "b0f9b37b-ba99-47f7-8710-67dd26c0480f", word: "私", reading: "わたし", romaji: "watashi", partOfSpeech: "pronoun" },
  { id: "82d883f5-ae79-4882-9488-0cb1ac7b602e", word: "行きます", reading: "いきます", romaji: "ikimasu", partOfSpeech: "verb" },
  { id: "d13c2b3f-7b93-4b00-8206-27f40bdec497", word: "こんにちは", reading: "こんにちは", romaji: "konnichiwa", partOfSpeech: "expression" },
  { id: "5e05cae1-e0da-409d-bfb5-fcd91e13ca79", word: "水", reading: "みず", romaji: "mizu", partOfSpeech: "noun" },
];

const listeningTranscripts = [
  {
    match: "Arimasu vs Imasu",
    transcript: "A: つくえの上に本がありますか。\nB: はい、あります。いすの下にねこもいます。\nA: かばんはどこにありますか。\nB: ドアのとなりにあります。",
    questions: [
      ["つくえの上に何がありますか。", ["本", "ねこ", "かばん", "ドア"], 0],
      ["いすの下に何がいますか。", ["学生", "ねこ", "先生", "犬"], 1],
      ["かばんはどこにありますか。", ["つくえの上", "いすの下", "ドアのとなり", "学校の前"], 2],
      ["生き物に使う動詞はどれですか。", ["あります", "です", "います", "します"], 2],
    ],
  },
  {
    match: "Building your first sentences",
    transcript: "わたしは学生です。これは日本語の本です。朝ごはんを食べます。水を飲みます。毎日、少し日本語を勉強します。",
    questions: [
      ["話している人は何ですか。", ["先生", "学生", "会社員", "医者"], 1],
      ["これは何の本ですか。", ["英語", "日本語", "数学", "歴史"], 1],
      ["何を飲みますか。", ["お茶", "水", "コーヒー", "牛乳"], 1],
      ["毎日何を勉強しますか。", ["日本語", "英語", "漢字だけ", "料理"], 0],
    ],
  },
  {
    match: "I-adjectives vs Na-adjectives",
    transcript: "この町は静かです。駅は大きいです。新しいカフェはきれいです。でも、コーヒーは少し高いです。",
    questions: [
      ["町はどうですか。", ["にぎやかです", "静かです", "古いです", "小さいです"], 1],
      ["駅はどうですか。", ["大きいです", "安いです", "きれいです", "静かです"], 0],
      ["カフェはどうですか。", ["きれいです", "高いです", "古いです", "小さいです"], 0],
      ["コーヒーはどうですか。", ["安いです", "少し高いです", "静かです", "新しいです"], 1],
    ],
  },
  {
    match: "Telling time and daily actions",
    transcript: "わたしは七時に起きます。八時半に学校へ行きます。十二時に昼ごはんを食べます。六時に家へ帰ります。",
    questions: [
      ["何時に起きますか。", ["六時", "七時", "八時半", "十二時"], 1],
      ["何時に学校へ行きますか。", ["七時", "八時", "八時半", "六時"], 2],
      ["十二時に何をしますか。", ["起きます", "帰ります", "勉強します", "昼ごはんを食べます"], 3],
      ["六時にどこへ帰りますか。", ["学校", "会社", "家", "駅"], 2],
    ],
  },
  {
    match: "First 15 Sounds",
    transcript: "あ、い、う、え、お。か、き、く、け、こ。さ、し、す、せ、そ。あさ、すし、かさを読みましょう。",
    questions: [
      ["最初の音はどれですか。", ["あ", "か", "さ", "し"], 0],
      ["「すし」はどの文字を使いますか。", ["す・し", "さ・し", "く・し", "せ・そ"], 0],
      ["聞いた物の言葉はどれですか。", ["かさ", "ねこ", "ほん", "みず"], 0],
      ["この練習の中心は何ですか。", ["漢字", "ひらがな", "文法", "作文"], 1],
    ],
  },
  {
    match: "Asking questions",
    transcript: "A: これは何ですか。\nB: それは本です。\nA: あの人はだれですか。\nB: 田中先生です。\nA: トイレはどこですか。\nB: あそこです。",
    questions: [
      ["「これは何ですか」の答えは何ですか。", ["本です", "先生です", "あそこです", "学生です"], 0],
      ["あの人はだれですか。", ["学生", "田中先生", "友だち", "山田さん"], 1],
      ["トイレはどこですか。", ["ここ", "そこ", "あそこ", "学校"], 2],
      ["質問を作る助詞はどれですか。", ["は", "を", "に", "か"], 3],
    ],
  },
  {
    match: "Conjugating adjectives",
    transcript: "きのうは暑かったです。今日は暑くないです。このレストランはよかったです。でも、少し高くなかったです。",
    questions: [
      ["きのうはどうでしたか。", ["暑かったです", "寒かったです", "暑くないです", "よくないです"], 0],
      ["今日はどうですか。", ["暑いです", "暑くないです", "高いです", "よかったです"], 1],
      ["レストランはどうでしたか。", ["よかったです", "悪かったです", "新しかったです", "静かでした"], 0],
      ["「いい」の過去形はどれですか。", ["いいかった", "よかった", "よくない", "いくない"], 1],
    ],
  },
  {
    match: "Days of the week",
    transcript: "今日は月曜日です。あしたは火曜日です。土曜日に友だちと映画を見ます。日曜日は家で休みます。",
    questions: [
      ["今日は何曜日ですか。", ["月曜日", "火曜日", "土曜日", "日曜日"], 0],
      ["あしたは何曜日ですか。", ["月曜日", "火曜日", "水曜日", "日曜日"], 1],
      ["土曜日に何をしますか。", ["勉強します", "映画を見ます", "休みます", "仕事します"], 1],
      ["日曜日はどこで休みますか。", ["学校", "駅", "家", "映画館"], 2],
    ],
  },
  {
    match: "Hello and goodbye",
    transcript: "A: こんにちは。\nB: こんにちは。お元気ですか。\nA: はい、元気です。では、また明日。\nB: さようなら。",
    questions: [
      ["最初のあいさつは何ですか。", ["おはよう", "こんにちは", "こんばんは", "さようなら"], 1],
      ["Aさんは元気ですか。", ["はい、元気です", "いいえ", "少しです", "わかりません"], 0],
      ["またいつ会いますか。", ["今日", "明日", "来週", "日曜日"], 1],
      ["最後のあいさつは何ですか。", ["ありがとう", "すみません", "さようなら", "お願いします"], 2],
    ],
  },
  {
    match: "Hiragana あ-row",
    transcript: "あ、い、う、え、お。あめ、いえ、うえ、えき、おかし。声に出して読みましょう。",
    questions: [
      ["あ行にない文字はどれですか。", ["あ", "い", "か", "お"], 2],
      ["「いえ」の意味は何ですか。", ["house", "station", "rain", "snack"], 0],
      ["「えき」の意味は何ですか。", ["station", "above", "house", "rain"], 0],
      ["この練習は何の練習ですか。", ["あ行", "か行", "さ行", "漢字"], 0],
    ],
  },
  {
    match: "Spatial locations",
    transcript: "本はつくえの上にあります。かばんはつくえの下にあります。ねこは箱の中にいます。犬は家の外にいます。",
    questions: [
      ["本はどこにありますか。", ["つくえの上", "つくえの下", "箱の中", "家の外"], 0],
      ["かばんはどこにありますか。", ["つくえの上", "つくえの下", "箱の中", "家の外"], 1],
      ["ねこはどこにいますか。", ["箱の中", "家の外", "つくえの上", "学校"], 0],
      ["犬はどこにいますか。", ["箱の中", "家の外", "つくえの下", "駅"], 1],
    ],
  },
  {
    match: "T, N, and H rows",
    transcript: "た、ち、つ、て、と。な、に、ぬ、ね、の。は、ひ、ふ、へ、ほ。ち、つ、ふの音に気をつけましょう。",
    questions: [
      ["た行の例外的な音はどれですか。", ["た", "ち", "て", "と"], 1],
      ["もう一つのた行の例外はどれですか。", ["つ", "な", "へ", "ほ"], 0],
      ["は行で注意する音はどれですか。", ["は", "ひ", "ふ", "ほ"], 2],
      ["この練習は何に注意しますか。", ["意味", "発音", "漢字", "長文"], 1],
    ],
  },
  {
    match: "Hiragana か-row",
    transcript: "か、き、く、け、こ。が、ぎ、ぐ、げ、ご。かさ、かき、くつ、けさ、ここを読みます。",
    questions: [
      ["か行の最初の文字はどれですか。", ["あ", "か", "さ", "た"], 1],
      ["「か」に点をつけると何ですか。", ["が", "ぎ", "ぐ", "げ"], 0],
      ["聞いた言葉はどれですか。", ["くつ", "ねこ", "みず", "ほん"], 0],
      ["この練習では何も学びますか。", ["濁点", "曜日", "敬語", "受身"], 0],
    ],
  },
  {
    match: "Self-introduction",
    transcript: "はじめまして。わたしはアビです。インドから来ました。日本語を勉強しています。どうぞよろしくお願いします。",
    questions: [
      ["名前は何ですか。", ["アビ", "田中", "山田", "先生"], 0],
      ["どこから来ましたか。", ["日本", "インド", "アメリカ", "中国"], 1],
      ["何を勉強していますか。", ["英語", "日本語", "数学", "音楽"], 1],
      ["自己紹介で使う最後の表現はどれですか。", ["いただきます", "どうぞよろしくお願いします", "おかえり", "ただいま"], 1],
    ],
  },
  {
    match: "M, Y, R, W, and N rows",
    transcript: "ま、み、む、め、も。や、ゆ、よ。ら、り、る、れ、ろ。わ、を、ん。これで基本のひらがなは全部です。",
    questions: [
      ["や行にある音はどれですか。", ["や", "り", "わ", "ん"], 0],
      ["最後の文字はどれですか。", ["を", "わ", "ん", "ろ"], 2],
      ["基本のひらがなはいくつですか。", ["15", "30", "46", "100"], 2],
      ["このレッスンで何が終わりますか。", ["基本のひらがな", "漢字", "N2文法", "作文"], 0],
    ],
  },
];

function fallbackListening(title) {
  return {
    transcript: "こんにちは。わたしは学生です。毎日、日本語を勉強します。今日は新しい言葉を三つ覚えました。明日も練習します。",
    questions: [
      ["話している人は何ですか。", ["学生", "先生", "医者", "会社員"], 0],
      ["毎日何を勉強しますか。", ["日本語", "英語", "料理", "音楽"], 0],
      ["今日は言葉をいくつ覚えましたか。", ["一つ", "二つ", "三つ", "四つ"], 2],
      ["明日も何をしますか。", ["休みます", "練習します", "旅行します", "買い物します"], 1],
    ],
  };
}

function introForLesson(title, goal) {
  return `このレッスンでは「${title}」を学びます。${goal || "重要な表現を確認し、例文で使い方を練習しましょう。"} 形だけを覚えるのではなく、どんな場面で自然に使うかまで意識して練習しましょう。`;
}

function summaryForLesson(title, goal) {
  const cleanGoal = (goal || "").replace(/\s+/g, " ").trim();
  return cleanGoal ? `${title}: ${cleanGoal}` : `${title} の重要表現を例文と練習で確認します。`;
}

function descriptionForPost(row) {
  if (row.content_type === "vocabulary") {
    return `${row.title} の意味、読み方、使い方を確認する日本語語彙ページです。`;
  }
  if (row.content_type === "grammar") {
    return `${row.title} の形、意味、自然な使い方を例文で学ぶ日本語文法ページです。`;
  }
  if (row.content_type === "kanji") {
    return `${row.title} の読み方、意味、書き方を確認する漢字学習ページです。`;
  }
  return `${row.title} を日本語学習者向けにわかりやすく整理したレッスンです。`;
}

function romanToHiragana(input) {
  if (!input) return input;
  const lower = input.toLowerCase().trim();
  const parts = lower.split(/(\s+)/);
  return parts
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      let text = part;
      text = text.replace(/cch/g, "tch");
      let out = "";
      const map = {
        kya: "きゃ", kyu: "きゅ", kyo: "きょ", gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
        sha: "しゃ", shu: "しゅ", sho: "しょ", sya: "しゃ", syu: "しゅ", syo: "しょ",
        ja: "じゃ", ju: "じゅ", jo: "じょ", jya: "じゃ", jyu: "じゅ", jyo: "じょ",
        cha: "ちゃ", chu: "ちゅ", cho: "ちょ", cya: "ちゃ", cyu: "ちゅ", cyo: "ちょ",
        nya: "にゃ", nyu: "にゅ", nyo: "にょ", hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
        bya: "びゃ", byu: "びゅ", byo: "びょ", pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
        mya: "みゃ", myu: "みゅ", myo: "みょ", rya: "りゃ", ryu: "りゅ", ryo: "りょ",
        fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
        a: "あ", i: "い", u: "う", e: "え", o: "お",
        ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
        ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
        sa: "さ", shi: "し", si: "し", su: "す", se: "せ", so: "そ",
        za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
        ta: "た", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", te: "て", to: "と",
        da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
        na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
        ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ",
        ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
        pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
        ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
        ya: "や", yu: "ゆ", yo: "よ",
        ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
        wa: "わ", wo: "を", n: "ん",
      };
      while (text.length) {
        if (/^[bcdfghjklmpqrstvwxyz]{2}/.test(text) && text[0] === text[1] && text[0] !== "n") {
          out += "っ";
          text = text.slice(1);
          continue;
        }
        if (text.startsWith("n") && !text.startsWith("na") && !text.startsWith("ni") && !text.startsWith("nu") && !text.startsWith("ne") && !text.startsWith("no") && !text.startsWith("nya") && !text.startsWith("nyu") && !text.startsWith("nyo")) {
          out += "ん";
          text = text.slice(1);
          continue;
        }
        const key = [3, 2, 1].map((len) => text.slice(0, len)).find((candidate) => map[candidate]);
        if (key) {
          out += map[key];
          text = text.slice(key.length);
        } else {
          out += text[0];
          text = text.slice(1);
        }
      }
      return out;
    })
    .join("");
}

function canonicalPath(contentType, slug) {
  if (contentType === "blog") return `/blog/${slug}`;
  if (contentType) return `/learn/${contentType}/${slug}`;
  return `/blog/${slug}`;
}

await client.connect();

const stats = {};
async function countStep(name, query, params = []) {
  const result = await client.query(query, params);
  stats[name] = result.rowCount;
}

try {
  await client.query("BEGIN");

  await client.query(`
    ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS jlpt_level TEXT;
    ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS part_of_speech TEXT;
    ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS romaji TEXT;
    ALTER TABLE kanji ADD COLUMN IF NOT EXISTS jlpt_level TEXT;
    CREATE INDEX IF NOT EXISTS idx_vocabulary_jlpt_level ON vocabulary(jlpt_level);
    CREATE INDEX IF NOT EXISTS idx_vocabulary_part_of_speech ON vocabulary(part_of_speech);
    CREATE INDEX IF NOT EXISTS idx_kanji_jlpt_level ON kanji(jlpt_level);
  `);

  for (const row of kanaRows) {
    await countStep(
      "kana_upserts",
      `
        INSERT INTO kana (character, type, romaji, row_label, sort_order, stroke_count, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (character, type)
        DO UPDATE SET romaji = EXCLUDED.romaji,
                      row_label = EXCLUDED.row_label,
                      sort_order = EXCLUDED.sort_order,
                      stroke_count = EXCLUDED.stroke_count,
                      updated_at = NOW()
      `,
      row,
    );
  }
  stats.kana_total_processed = kanaRows.length;

  await countStep(
    "vocabulary_level_backfill",
    `
      UPDATE vocabulary v
      SET jlpt_level = p.jlpt_level[1],
          updated_at = NOW()
      FROM posts p
      WHERE v.post_id = p.id
        AND v.jlpt_level IS NULL
        AND array_length(p.jlpt_level, 1) > 0
    `,
  );

  await countStep(
    "kanji_level_backfill",
    `
      UPDATE kanji k
      SET jlpt_level = p.jlpt_level[1],
          updated_at = NOW()
      FROM posts p
      WHERE k.post_id = p.id
        AND k.jlpt_level IS NULL
        AND array_length(p.jlpt_level, 1) > 0
    `,
  );

  await countStep(
    "vocabulary_romaji_preserved",
    `
      UPDATE vocabulary
      SET romaji = reading,
          updated_at = NOW()
      WHERE romaji IS NULL
        AND reading ~ '^[A-Za-z][A-Za-z0-9[:space:]''.,!?/-]*$'
    `,
  );

  await countStep(
    "kana_word_reading_normalized",
    `
      UPDATE vocabulary
      SET reading = word,
          updated_at = NOW()
      WHERE word ~ '^[ぁ-ゖー]+$'
        AND reading ~ '^[A-Za-z][A-Za-z0-9[:space:]''.,!?/-]*$'
    `,
  );

  for (const repair of vocabularyRepairs) {
    await countStep(
      "vocabulary_direct_repairs",
      `
        UPDATE vocabulary
        SET word = $2,
            reading = $3,
            romaji = $4,
            part_of_speech = $5,
            jlpt_level = COALESCE(jlpt_level, 'N5'),
            updated_at = NOW()
        WHERE id = $1
      `,
      [repair.id, repair.word, repair.reading, repair.romaji, repair.partOfSpeech],
    );
  }

  await countStep(
    "vocabulary_part_of_speech_inferred",
    `
      UPDATE vocabulary
      SET part_of_speech = CASE
            WHEN part_of_speech IS NOT NULL THEN part_of_speech
            WHEN lower(meaning) LIKE 'to %' THEN 'verb'
            WHEN word ~ 'い$' AND lower(meaning) NOT LIKE '%not%' THEN 'i-adjective'
            WHEN word IN ('これ', 'それ', 'あれ', 'どれ', 'ここ', 'そこ', 'あそこ', 'どこ') THEN 'pronoun'
            WHEN word IN ('こんにちは', 'さようなら', 'ありがとう', 'すみません') THEN 'expression'
            ELSE 'noun'
          END,
          updated_at = NOW()
      WHERE part_of_speech IS NULL
    `,
  );

  const romanReadingRows = await client.query(`
    SELECT id, reading
    FROM vocabulary
    WHERE reading ~ '^[A-Za-z][A-Za-z0-9[:space:]''.,!?/-]*$'
  `);
  let romanReadingConverted = 0;
  for (const row of romanReadingRows.rows) {
    const kanaReading = romanToHiragana(row.reading);
    if (kanaReading && kanaReading !== row.reading) {
      const result = await client.query(
        `
          UPDATE vocabulary
          SET romaji = COALESCE(romaji, $2),
              reading = $3,
              updated_at = NOW()
          WHERE id = $1
        `,
        [row.id, row.reading, kanaReading],
      );
      romanReadingConverted += result.rowCount;
    }
  }
  stats.vocabulary_roman_readings_converted = romanReadingConverted;

  const lessons = await client.query("SELECT id, title, goal FROM curriculum_lessons WHERE summary IS NULL OR introduction IS NULL");
  for (const lesson of lessons.rows) {
    await countStep(
      "lesson_summary_intro_updates",
      `
        UPDATE curriculum_lessons
        SET summary = COALESCE(summary, $2),
            introduction = COALESCE(introduction, $3),
            updated_at = NOW()
        WHERE id = $1
      `,
      [lesson.id, summaryForLesson(lesson.title, lesson.goal), introForLesson(lesson.title, lesson.goal)],
    );
  }

  await countStep(
    "curriculum_level_summaries",
    `
      UPDATE curriculum_levels
      SET summary = COALESCE(summary, code || ' structured Japanese curriculum'),
          description = COALESCE(description, name || ' lessons organized by kana, vocabulary, grammar, kanji, reading, listening, and review.'),
          updated_at = NOW()
      WHERE summary IS NULL OR description IS NULL
    `,
  );

  await countStep(
    "curriculum_module_summaries",
    `
      UPDATE curriculum_modules
      SET summary = COALESCE(summary, title || ' module with ordered lessons and practice.'),
          updated_at = NOW()
      WHERE summary IS NULL
    `,
  );

  await countStep(
    "curriculum_submodule_summaries",
    `
      UPDATE curriculum_submodules
      SET summary = COALESCE(summary, title || ' focused practice set.'),
          description = COALESCE(description, 'Practice the core language points in ' || title || ' with examples and review.'),
          updated_at = NOW()
      WHERE summary IS NULL OR description IS NULL
    `,
  );

  await countStep(
    "vocabulary_post_content",
    `
      UPDATE posts p
      SET content = CONCAT(
            '# ', p.title, E'\\n\\n',
            '- Japanese: ', COALESCE(v.word, p.title), E'\\n',
            '- Reading: ', COALESCE(v.reading, 'Add kana reading'), E'\\n',
            '- Romaji: ', COALESCE(v.romaji, 'Add romaji'), E'\\n',
            '- Meaning: ', COALESCE(v.meaning, p.summary, 'Add meaning'), E'\\n',
            '- JLPT level: ', COALESCE(v.jlpt_level, p.jlpt_level[1], 'Unassigned'), E'\\n\\n',
            '## Study Note', E'\\n',
            'Read the Japanese form first, then check the reading and meaning. Create your own short sentence before moving on.'
          ),
          updated_at = NOW()
      FROM vocabulary v
      WHERE p.id = v.post_id
        AND p.status = 'published'
        AND p.content_type = 'vocabulary'
        AND NULLIF(BTRIM(COALESCE(p.content, '')), '') IS NULL
    `,
  );

  await countStep(
    "grammar_post_content",
    `
      UPDATE posts p
      SET content = CONCAT(
            '# ', p.title, E'\\n\\n',
            '- Pattern: ', COALESCE(g.pattern, p.title), E'\\n',
            '- Structure: ', COALESCE(g.structure, 'Add structure'), E'\\n',
            '- JLPT level: ', COALESCE(g.level, p.jlpt_level[1], 'Unassigned'), E'\\n\\n',
            '## How To Use It', E'\\n',
            'Focus on the connection pattern first, then make one sentence about your own life. Check particles carefully before memorizing.'
          ),
          updated_at = NOW()
      FROM grammar g
      WHERE p.id = g.post_id
        AND p.status = 'published'
        AND p.content_type = 'grammar'
        AND NULLIF(BTRIM(COALESCE(p.content, '')), '') IS NULL
    `,
  );

  await countStep(
    "kanji_post_content",
    `
      UPDATE posts p
      SET content = CONCAT(
            '# ', p.title, E'\\n\\n',
            '- Kanji: ', COALESCE(k.character, p.title), E'\\n',
            '- Meaning: ', COALESCE(k.meaning, p.summary, 'Add meaning'), E'\\n',
            '- Onyomi: ', COALESCE(array_to_string(k.onyomi, ', '), 'Add onyomi'), E'\\n',
            '- Kunyomi: ', COALESCE(array_to_string(k.kunyomi, ', '), 'Add kunyomi'), E'\\n',
            '- Stroke count: ', COALESCE(k.stroke_count::TEXT, 'Add stroke count'), E'\\n',
            '- JLPT level: ', COALESCE(k.jlpt_level, p.jlpt_level[1], 'Unassigned'), E'\\n\\n',
            '## Study Note', E'\\n',
            'Learn the meaning, then practice the most common reading in vocabulary. Write the character slowly while counting strokes.'
          ),
          updated_at = NOW()
      FROM kanji k
      WHERE p.id = k.post_id
        AND p.status = 'published'
        AND p.content_type = 'kanji'
        AND NULLIF(BTRIM(COALESCE(p.content, '')), '') IS NULL
    `,
  );

  await countStep(
    "listening_post_content",
    `
      UPDATE posts p
      SET content = CONCAT(
            '# ', p.title, E'\\n\\n',
            COALESCE(p.summary, 'Listening practice for Japanese learners.'), E'\\n\\n',
            '## Transcript', E'\\n',
            COALESCE(s.transcript, 'Transcript coming soon.'), E'\\n\\n',
            '## How To Practice', E'\\n',
            'Listen once without reading. Listen a second time while checking the transcript. Then answer the questions and repeat the key sentences aloud.'
          ),
          updated_at = NOW()
      FROM listening l
      LEFT JOIN LATERAL (
        SELECT transcript
        FROM listening_scenarios ls
        WHERE ls.listening_id = l.id
        ORDER BY ls.sort_order, ls.created_at
        LIMIT 1
      ) s ON TRUE
      WHERE p.id = l.post_id
        AND p.status = 'published'
        AND p.content_type = 'listening'
        AND NULLIF(BTRIM(COALESCE(p.content, '')), '') IS NULL
    `,
  );

  const posts = await client.query("SELECT id, title, summary, content_type FROM posts WHERE status = 'published' AND (seo_title IS NULL OR seo_description IS NULL)");
  for (const post of posts.rows) {
    await countStep(
      "post_seo_updates",
      `
        UPDATE posts
        SET seo_title = COALESCE(seo_title, LEFT($2 || ' | Japanese With Avnish', 70)),
            seo_description = COALESCE(seo_description, LEFT($3, 155)),
            updated_at = NOW()
        WHERE id = $1
      `,
      [post.id, post.title, post.summary || descriptionForPost(post)],
    );
  }

  await countStep(
    "post_topic_backfill",
    `
      UPDATE posts
      SET topic = COALESCE(topic, content_type),
          updated_at = NOW()
      WHERE topic IS NULL
        AND content_type IS NOT NULL
    `,
  );

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
  const siteUrl = configuredSiteUrl.includes("localhost") ? "https://japanesewithavnish.com" : configuredSiteUrl.replace(/\/$/, "");
  const canonicalRows = await client.query("SELECT id, slug, content_type FROM posts WHERE canonical_url IS NULL");
  let canonicalUpdates = 0;
  for (const post of canonicalRows.rows) {
    const result = await client.query(
      `
        UPDATE posts
        SET canonical_url = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [post.id, `${siteUrl}${canonicalPath(post.content_type, post.slug)}`],
    );
    canonicalUpdates += result.rowCount;
  }
  stats.post_canonical_updates = canonicalUpdates;

  const scenarios = await client.query("SELECT id, title FROM listening_scenarios ORDER BY sort_order, created_at");
  for (const scenario of scenarios.rows) {
    const data = listeningTranscripts.find((item) => scenario.title.includes(item.match)) || fallbackListening(scenario.title);
    await countStep(
      "listening_transcript_updates",
      `
        UPDATE listening_scenarios
        SET transcript = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [scenario.id, data.transcript],
    );

    const existing = await client.query(
      "SELECT id FROM listening_questions WHERE scenario_id = $1 ORDER BY sort_order, created_at",
      [scenario.id],
    );

    for (let i = 0; i < data.questions.length; i += 1) {
      const [questionText, options, correctIndex] = data.questions[i];
      const existingId = existing.rows[i]?.id;
      if (existingId) {
        await countStep(
          "listening_question_updates",
          `
            UPDATE listening_questions
            SET question_text = $2,
                options = $3::jsonb,
                correct_index = $4,
                sort_order = $5,
                updated_at = NOW()
            WHERE id = $1
          `,
          [existingId, questionText, JSON.stringify(options), correctIndex, i * 10],
        );
      } else {
        await countStep(
          "listening_question_inserts",
          `
            INSERT INTO listening_questions (scenario_id, question_text, options, correct_index, sort_order)
            VALUES ($1, $2, $3::jsonb, $4, $5)
          `,
          [scenario.id, questionText, JSON.stringify(options), correctIndex, i * 10],
        );
      }
    }
  }

  await countStep(
    "listening_notes",
    `
      UPDATE listening
      SET notes = COALESCE(notes, 'Transcript and questions cleaned. Replace placeholder audio_url with native or high-quality TTS audio before launch.'),
          updated_at = NOW()
      WHERE notes IS NULL
    `,
  );

  await client.query("COMMIT");
  console.log(JSON.stringify(stats, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
