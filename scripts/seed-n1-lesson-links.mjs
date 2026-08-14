import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const n1Lessons = [
  {
    title: "〜んがために, 〜んばかりに, 〜を皮切りに",
    vocab: ["革新", "かくしん", "innovation", "noun"],
    grammar: [
      ["〜んがために", "Vない stem + んがために; する → せんがために", "新しい技術を完成させんがために、研究者たちは夜遅くまで実験を続けた。", "In order to complete the new technology, the researchers continued experiments late into the night."],
      ["〜を皮切りに", "N + を皮切りに", "東京での発表を皮切りに、その教材は全国に広まった。", "Starting with the presentation in Tokyo, the learning material spread nationwide."],
    ],
  },
  {
    title: "〜を余儀なくされる, 〜にかたくない",
    vocab: ["苦労", "くろう", "hardship; struggle", "noun"],
    grammar: [
      ["〜を余儀なくされる", "N + を余儀なくされる", "台風の影響で、試験の延期を余儀なくされた。", "Because of the typhoon, they were forced to postpone the exam."],
      ["〜にかたくない", "V dictionary/N + にかたくない", "初めて海外で働く不安は想像にかたくない。", "It is not hard to imagine the anxiety of working abroad for the first time."],
    ],
  },
  {
    title: "〜をおいて他にない, 〜に至るまで",
    vocab: ["唯一", "ゆいいつ", "only; sole", "noun"],
    grammar: [
      ["〜をおいて他にない", "N + をおいて他にない", "この問題を解決できる人は彼をおいて他にない。", "There is no one other than him who can solve this problem."],
      ["〜に至るまで", "N + に至るまで", "資料の表紙から脚注に至るまで、細かく確認した。", "I checked everything carefully, from the cover of the materials down to the footnotes."],
    ],
  },
  {
    title: "〜ないまでも, 〜て止まない",
    vocab: ["成功", "せいこう", "success", "noun"],
    grammar: [
      ["〜ないまでも", "Vない + までも", "完璧とは言えないまでも、今回の発表は十分に成功だった。", "Even if it cannot be called perfect, this presentation was successful enough."],
      ["〜て止まない", "Vて + 止まない", "皆さんの成功を願って止みません。", "I sincerely and constantly wish for everyone's success."],
    ],
  },
  {
    title: "〜いかんで, 〜をものともせずに",
    vocab: ["状況", "じょうきょう", "situation; circumstances", "noun"],
    grammar: [
      ["〜いかんで", "N + いかんで", "結果いかんで、次の計画を変更する必要がある。", "Depending on the result, we need to change the next plan."],
      ["〜をものともせずに", "N + をものともせずに", "彼女は厳しい批判をものともせずに研究を続けた。", "She continued her research in defiance of harsh criticism."],
    ],
  },
  {
    title: "〜たるもの, 〜なりに",
    vocab: ["専門家", "せんもんか", "specialist; expert", "noun"],
    grammar: [
      ["〜たるもの", "N + たるもの", "教師たるもの、学び続ける姿勢を忘れてはならない。", "As a teacher, one must not forget the attitude of continuing to learn."],
      ["〜なりに", "N + なりに", "初心者なりに、彼は丁寧に意見を述べた。", "In his own way as a beginner, he expressed his opinion carefully."],
    ],
  },
  {
    title: "〜ともなると, 〜ゆえに, 〜すら",
    vocab: ["責任", "せきにん", "responsibility", "noun"],
    grammar: [
      ["〜ともなると", "N + ともなると", "管理職ともなると、判断の責任はさらに重くなる。", "Once you become a manager, the responsibility for decisions becomes even heavier."],
      ["〜ゆえに", "Plain form/N + ゆえに", "経験が豊富であるゆえに、彼の助言には説得力がある。", "Because he has abundant experience, his advice is persuasive."],
    ],
  },
  {
    title: "〜が早いか, 〜そばから, 〜なり",
    vocab: ["瞬間", "しゅんかん", "moment; instant", "noun"],
    grammar: [
      ["〜が早いか", "V dictionary + が早いか", "ベルが鳴るが早いか、学生たちは教室を出た。", "No sooner had the bell rung than the students left the classroom."],
      ["〜そばから", "V dictionary/Vた + そばから", "新しい単語を覚えたそばから忘れてしまう。", "No sooner do I learn new words than I forget them."],
    ],
  },
  {
    title: "〜に足る, 〜に堪える, 〜べくもない",
    vocab: ["評価", "ひょうか", "evaluation; assessment", "noun"],
    grammar: [
      ["〜に足る", "V dictionary/N + に足る", "この報告書は信頼するに足る内容だ。", "This report contains content worthy of trust."],
      ["〜べくもない", "V dictionary + べくもない", "準備なしで合格を望むべくもない。", "Without preparation, there is no way to hope to pass."],
    ],
  },
  {
    title: "〜にたえない, 〜を禁じ得ない",
    vocab: ["感謝", "かんしゃ", "gratitude", "noun"],
    grammar: [
      ["〜にたえない", "N + にたえない", "皆様のご支援に感謝にたえません。", "I am overwhelmed with gratitude for everyone's support."],
      ["〜を禁じ得ない", "N + を禁じ得ない", "その知らせを聞いて、驚きを禁じ得なかった。", "Hearing the news, I could not suppress my surprise."],
    ],
  },
  {
    title: "〜をもって, 〜を限りに",
    vocab: ["基準", "きじゅん", "standard; criterion", "noun"],
    grammar: [
      ["〜をもって", "N + をもって", "本日の会議をもって、今年の活動を終了します。", "With today's meeting, we will conclude this year's activities."],
      ["〜を限りに", "N + を限りに", "今月を限りに、このサービスは終了します。", "This service will end as of this month."],
    ],
  },
  {
    title: "〜に即して, 〜をひかえて",
    vocab: ["事実", "じじつ", "fact", "noun"],
    grammar: [
      ["〜に即して", "N + に即して", "事実に即して、冷静に判断してください。", "Please judge calmly in accordance with the facts."],
      ["〜をひかえて", "N + をひかえて", "試験をひかえて、学生たちは復習に集中している。", "With the exam approaching, the students are focusing on review."],
    ],
  },
  {
    title: "〜べくして, 〜べからず / 〜べからざる",
    vocab: ["規則", "きそく", "rule; regulation", "noun"],
    grammar: [
      ["〜べくして", "V dictionary + べくして", "長年の努力が実り、彼は勝つべくして勝った。", "His years of effort bore fruit, and he won as was bound to happen."],
      ["〜べからず", "V dictionary + べからず", "関係者以外入るべからず。", "No entry except for authorized personnel."],
    ],
  },
  {
    title: "〜きらいがある, 〜めく, 〜ぶる",
    vocab: ["傾向", "けいこう", "tendency", "noun"],
    grammar: [
      ["〜きらいがある", "V dictionary/Nの + きらいがある", "彼は細かい確認を後回しにするきらいがある。", "He has a tendency to postpone detailed checks."],
      ["〜めく", "N + めく", "春めいた風が町に吹き始めた。", "A spring-like wind began to blow through the town."],
    ],
  },
  {
    title: "〜まみれ, 〜びる, 〜ずくめ",
    vocab: ["泥", "どろ", "mud", "noun"],
    grammar: [
      ["〜まみれ", "N + まみれ", "雨の中を走って、靴が泥まみれになった。", "After running in the rain, my shoes became covered in mud."],
      ["〜ずくめ", "N + ずくめ", "今日は朝から会議ずくめで、休む時間がなかった。", "Today was full of meetings from the morning, and I had no time to rest."],
    ],
  },
  {
    title: "〜をよそに, 〜いかんにかかわらず, 〜はおろか",
    vocab: ["世論", "よろん", "public opinion", "noun"],
    grammar: [
      ["〜をよそに", "N + をよそに", "周囲の心配をよそに、彼は一人で出発した。", "Ignoring the worries of those around him, he departed alone."],
      ["〜はおろか", "N + はおろか", "忙しくて、昼食はおろか水を飲む時間もなかった。", "I was so busy that I had no time even to drink water, let alone eat lunch."],
    ],
  },
  {
    title: "〜ならでは, 〜をおいてほかにない, 〜にとどまらず",
    vocab: ["職人", "しょくにん", "craftsperson; artisan", "noun"],
    grammar: [
      ["〜ならでは", "N + ならでは", "この細かい仕上げは職人ならではの技術だ。", "This fine finish is a skill unique to craftspeople."],
      ["〜にとどまらず", "N/V dictionary + にとどまらず", "彼の活動は国内にとどまらず、海外にも広がった。", "His activities were not limited to Japan but spread overseas as well."],
    ],
  },
  {
    title: "〜ならいざしらず, 〜ものを, 〜とあれば",
    vocab: ["後悔", "こうかい", "regret", "noun"],
    grammar: [
      ["〜ならいざしらず", "N + ならいざしらず", "子どもならいざしらず、大人がその態度では困る。", "It might be understandable for a child, but that attitude from an adult is a problem."],
      ["〜ものを", "Plain form + ものを", "早く相談してくれれば助けられたものを。", "If only you had consulted me earlier, I could have helped."],
    ],
  },
  {
    title: "〜ようがない, 〜どころではない, 〜に（は）あたらない",
    vocab: ["方法", "ほうほう", "method; way", "noun"],
    grammar: [
      ["〜ようがない", "Verb stem + ようがない", "住所がわからなければ、荷物を送りようがない。", "If we do not know the address, there is no way to send the package."],
      ["〜どころではない", "N/V dictionary + どころではない", "熱が高くて、勉強どころではなかった。", "I had a high fever, so studying was out of the question."],
    ],
  },
  {
    title: "〜にかこつけて, 〜ゆえに, 〜んがための",
    vocab: ["弁解", "べんかい", "excuse; explanation", "noun"],
    grammar: [
      ["〜にかこつけて", "N + にかこつけて", "彼は出張にかこつけて、観光も楽しんだ。", "Using the business trip as an excuse, he also enjoyed sightseeing."],
      ["〜んがための", "Vない stem + んがための; する → せんがための", "勝たんがための努力が、チームを大きく成長させた。", "The effort made in order to win greatly developed the team."],
    ],
  },
];

function slugPart(value) {
  return value
    .normalize("NFKD")
    .replace(/[〜～]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

const stats = {
  grammarPosts: 0,
  grammarRows: 0,
  grammarLinks: 0,
  vocabularyPosts: 0,
  vocabularyRows: 0,
  vocabularyLinks: 0,
  examples: 0,
  drillLinks: 0,
};

try {
  await client.query("BEGIN");

  for (const lessonSeed of n1Lessons) {
    const lessonResult = await client.query(
      "SELECT id FROM curriculum_lessons WHERE title = $1 LIMIT 1",
      [lessonSeed.title],
    );
    const lesson = lessonResult.rows[0];
    if (!lesson) continue;

    const [word, reading, meaning, partOfSpeech] = lessonSeed.vocab;
    const vocabSlug = `n1-vocab-${slugPart(word)}-${lesson.id.slice(0, 8)}`;
    const vocabPost = await client.query(
      `
        INSERT INTO posts (slug, title, summary, content, jlpt_level, tags, seo_title, seo_description, canonical_url, status, published_at, content_type, topic)
        VALUES ($1, $2, $3, $4, ARRAY['N1'], ARRAY['N1','vocabulary'], $5, $6, $7, 'published', NOW(), 'vocabulary', 'vocabulary')
        ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            jlpt_level = EXCLUDED.jlpt_level,
            tags = EXCLUDED.tags,
            seo_title = EXCLUDED.seo_title,
            seo_description = EXCLUDED.seo_description,
            canonical_url = EXCLUDED.canonical_url,
            status = EXCLUDED.status,
            published_at = COALESCE(posts.published_at, NOW()),
            content_type = EXCLUDED.content_type,
            topic = EXCLUDED.topic,
            updated_at = NOW()
        RETURNING id
      `,
      [
        vocabSlug,
        `${word} (${reading})`,
        `${word} means ${meaning}.`,
        `# ${word}\n\n- Reading: ${reading}\n- Meaning: ${meaning}\n- JLPT level: N1\n\nUse this word as an anchor for the related N1 grammar lesson.`,
        `${word} (${reading}) | N1 Japanese Vocabulary`,
        `${word} (${reading}) means ${meaning}. Learn it as part of N1 Japanese grammar practice.`,
        `https://japanesewithavnish.com/learn/vocabulary/${vocabSlug}`,
      ],
    );
    stats.vocabularyPosts += vocabPost.rowCount;

    const vocabRow = await client.query(
      `
        INSERT INTO vocabulary (post_id, word, reading, meaning, jlpt_level, part_of_speech, updated_at)
        VALUES ($1, $2, $3, $4, 'N1', $5, NOW())
        ON CONFLICT (post_id) DO UPDATE
        SET word = EXCLUDED.word,
            reading = EXCLUDED.reading,
            meaning = EXCLUDED.meaning,
            jlpt_level = EXCLUDED.jlpt_level,
            part_of_speech = EXCLUDED.part_of_speech,
            updated_at = NOW()
        RETURNING id
      `,
      [vocabPost.rows[0].id, word, reading, meaning, partOfSpeech],
    );
    stats.vocabularyRows += vocabRow.rowCount;

    const vocabLink = await client.query(
      `
        INSERT INTO curriculum_lesson_vocabulary (lesson_id, vocabulary_id, sort_order)
        VALUES ($1, $2, 900)
        ON CONFLICT (lesson_id, vocabulary_id) DO NOTHING
      `,
      [lesson.id, vocabRow.rows[0].id],
    );
    stats.vocabularyLinks += vocabLink.rowCount;

    for (let index = 0; index < lessonSeed.grammar.length; index += 1) {
      const [pattern, structure, sentenceJa, sentenceEn] = lessonSeed.grammar[index];
      const grammarSlug = `n1-grammar-${lesson.id.slice(0, 8)}-${index + 1}`;
      const grammarPost = await client.query(
        `
          INSERT INTO posts (slug, title, summary, content, jlpt_level, tags, seo_title, seo_description, canonical_url, status, published_at, content_type, topic)
          VALUES ($1, $2, $3, $4, ARRAY['N1'], ARRAY['N1','grammar'], $5, $6, $7, 'published', NOW(), 'grammar', 'grammar')
          ON CONFLICT (slug) DO UPDATE
          SET title = EXCLUDED.title,
              summary = EXCLUDED.summary,
              content = EXCLUDED.content,
              jlpt_level = EXCLUDED.jlpt_level,
              tags = EXCLUDED.tags,
              seo_title = EXCLUDED.seo_title,
              seo_description = EXCLUDED.seo_description,
              canonical_url = EXCLUDED.canonical_url,
              status = EXCLUDED.status,
              published_at = COALESCE(posts.published_at, NOW()),
              content_type = EXCLUDED.content_type,
              topic = EXCLUDED.topic,
              updated_at = NOW()
          RETURNING id
        `,
        [
          grammarSlug,
          `${pattern} | N1 Grammar`,
          `${pattern}: ${structure}`,
          `# ${pattern}\n\n- Structure: ${structure}\n- JLPT level: N1\n\n## Example\n${sentenceJa}\n\n${sentenceEn}\n\n## Study Note\nThis is formal/advanced Japanese. Pay attention to the connection form and use it mostly in writing, speeches, reports, or formal explanations.`,
          `${pattern} | N1 Japanese Grammar`,
          `Learn ${pattern}, an N1 Japanese grammar point, with structure and example sentence.`,
          `https://japanesewithavnish.com/learn/grammar/${grammarSlug}`,
        ],
      );
      stats.grammarPosts += grammarPost.rowCount;

      const grammarRow = await client.query(
        `
          INSERT INTO grammar (post_id, pattern, structure, level, notes, updated_at)
          VALUES ($1, $2, $3, 'N1', 'Advanced formal grammar. Review connection form and register before use.', NOW())
          ON CONFLICT (post_id) DO UPDATE
          SET pattern = EXCLUDED.pattern,
              structure = EXCLUDED.structure,
              level = EXCLUDED.level,
              notes = EXCLUDED.notes,
              updated_at = NOW()
          RETURNING id
        `,
        [grammarPost.rows[0].id, pattern, structure],
      );
      stats.grammarRows += grammarRow.rowCount;

      const grammarLink = await client.query(
        `
          INSERT INTO curriculum_lesson_grammar (lesson_id, grammar_id, sort_order)
          VALUES ($1, $2, $3)
          ON CONFLICT (lesson_id, grammar_id) DO NOTHING
        `,
        [lesson.id, grammarRow.rows[0].id, index * 10],
      );
      stats.grammarLinks += grammarLink.rowCount;

      const example = await client.query(
        `
          INSERT INTO examples (lesson_id, grammar_id, sentence_ja, sentence_en, notes, sort_order)
          SELECT $1, $2, $3, $4, $5, $6
          WHERE NOT EXISTS (
            SELECT 1 FROM examples WHERE lesson_id = $1 AND sentence_ja = $3
          )
        `,
        [lesson.id, grammarRow.rows[0].id, sentenceJa, sentenceEn, pattern, index * 10],
      );
      stats.examples += example.rowCount;
    }
  }

  const drillLinks = await client.query(`
    UPDATE grammar_drill_items d
    SET grammar_id = first_grammar.grammar_id,
        updated_at = NOW()
    FROM (
      SELECT DISTINCT ON (lesson_id) lesson_id, grammar_id
      FROM curriculum_lesson_grammar
      ORDER BY lesson_id, sort_order
    ) first_grammar
    WHERE d.lesson_id = first_grammar.lesson_id
      AND d.grammar_id IS NULL
  `);
  stats.drillLinks = drillLinks.rowCount;

  await client.query("COMMIT");
  console.log(JSON.stringify(stats, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
