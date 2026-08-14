import "dotenv/config";
import https from "node:https";
import pg from "pg";

const { Client } = pg;

const SOURCES = [
  {
    level: "N3",
    url: "https://japanesetest4you.com/jlpt-n3-vocabulary-list/",
  },
  {
    level: "N2",
    url: "https://japanesetest4you.com/jlpt-n2-vocabulary-list/",
  },
  {
    level: "N1",
    url: "https://japanesetest4you.com/jlpt-n1-vocabulary-list/",
  },
];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  })
);

const apply = args.get("apply") === "true";
const confirmed = args.get("confirm") === "IMPORT_N3_N2_N1_VOCAB";
const status = args.get("status") || "published";

if (!["draft", "published"].includes(status)) {
  console.error("Invalid --status. Use draft or published.");
  process.exit(1);
}

if (apply && !confirmed) {
  console.error("Refusing to import without --confirm=IMPORT_N3_N2_N1_VOCAB.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function readerUrl(url) {
  return `https://r.jina.ai/http://${url}`;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "user-agent": "JapaneseWithAvnishContentImporter/1.0",
            accept: "text/plain,text/markdown",
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            resolve(fetchText(new URL(res.headers.location, url).toString()));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Fetch failed ${res.statusCode} for ${url}`));
            res.resume();
            return;
          }
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => resolve(body));
        }
      )
      .on("error", reject);
  });
}

function normalizeSpaces(input) {
  return input
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function plainMarkdownLine(line) {
  return normalizeSpaces(
    line
      .replace(/^#+\s*/, "")
      .replace(/!\[[^\]]*]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/^-+\s*/, "")
  );
}

function hasJapanese(input) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(input);
}

function isKanaOnly(input) {
  return /^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(input);
}

const kanaMap = new Map(
  Object.entries({
    あ: "a",
    い: "i",
    う: "u",
    え: "e",
    お: "o",
    か: "ka",
    き: "ki",
    く: "ku",
    け: "ke",
    こ: "ko",
    さ: "sa",
    し: "shi",
    す: "su",
    せ: "se",
    そ: "so",
    た: "ta",
    ち: "chi",
    つ: "tsu",
    て: "te",
    と: "to",
    な: "na",
    に: "ni",
    ぬ: "nu",
    ね: "ne",
    の: "no",
    は: "ha",
    ひ: "hi",
    ふ: "fu",
    へ: "he",
    ほ: "ho",
    ま: "ma",
    み: "mi",
    む: "mu",
    め: "me",
    も: "mo",
    や: "ya",
    ゆ: "yu",
    よ: "yo",
    ら: "ra",
    り: "ri",
    る: "ru",
    れ: "re",
    ろ: "ro",
    わ: "wa",
    を: "wo",
    ん: "n",
    が: "ga",
    ぎ: "gi",
    ぐ: "gu",
    げ: "ge",
    ご: "go",
    ざ: "za",
    じ: "ji",
    ず: "zu",
    ぜ: "ze",
    ぞ: "zo",
    だ: "da",
    ぢ: "ji",
    づ: "zu",
    で: "de",
    ど: "do",
    ば: "ba",
    び: "bi",
    ぶ: "bu",
    べ: "be",
    ぼ: "bo",
    ぱ: "pa",
    ぴ: "pi",
    ぷ: "pu",
    ぺ: "pe",
    ぽ: "po",
    ぁ: "a",
    ぃ: "i",
    ぅ: "u",
    ぇ: "e",
    ぉ: "o",
    ゔ: "vu",
  })
);

const comboMap = new Map(
  Object.entries({
    きゃ: "kya",
    きゅ: "kyu",
    きょ: "kyo",
    しゃ: "sha",
    しゅ: "shu",
    しょ: "sho",
    ちゃ: "cha",
    ちゅ: "chu",
    ちょ: "cho",
    にゃ: "nya",
    にゅ: "nyu",
    にょ: "nyo",
    ひゃ: "hya",
    ひゅ: "hyu",
    ひょ: "hyo",
    みゃ: "mya",
    みゅ: "myu",
    みょ: "myo",
    りゃ: "rya",
    りゅ: "ryu",
    りょ: "ryo",
    ぎゃ: "gya",
    ぎゅ: "gyu",
    ぎょ: "gyo",
    じゃ: "ja",
    じゅ: "ju",
    じょ: "jo",
    びゃ: "bya",
    びゅ: "byu",
    びょ: "byo",
    ぴゃ: "pya",
    ぴゅ: "pyu",
    ぴょ: "pyo",
  })
);

function toHiragana(input) {
  return input.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function kanaToRomaji(input) {
  const kana = toHiragana(input);
  let output = "";
  let doubleNext = false;
  for (let i = 0; i < kana.length; i += 1) {
    const char = kana[i];
    if (char === " " || char === "・") {
      output += " ";
      continue;
    }
    if (char === "ー") {
      const lastVowel = output.match(/[aeiou](?!.*[aeiou])/);
      output += lastVowel ? lastVowel[0] : "";
      continue;
    }
    if (char === "っ") {
      doubleNext = true;
      continue;
    }
    const combo = comboMap.get(kana.slice(i, i + 2));
    let roman = combo || kanaMap.get(char) || char;
    if (combo) i += 1;
    if (doubleNext && /^[bcdfghjklmnpqrstvwxyz]/.test(roman)) {
      roman = roman[0] + roman;
    }
    doubleNext = false;
    output += roman;
  }
  return output.replace(/\s+/g, " ").trim();
}

function parseVocabularyRows(markdown, level, sourceUrl) {
  const rows = [];
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = plainMarkdownLine(rawLine);
    if (!line || !hasJapanese(line)) continue;
    if (/^JLPT\s+N\d/i.test(line) || /^Ebook:/i.test(line) || /^Image\s+\d/i.test(line)) continue;

    let word = "";
    let romaji = "";
    let meaning = "";
    const withRomaji = line.match(/^(.+?)\s*\(([a-zA-Zāīūēō'’\-\s]+)\):\s*(.+)$/);
    if (withRomaji) {
      word = normalizeSpaces(withRomaji[1]);
      romaji = normalizeSpaces(withRomaji[2].replace(/’/g, "'"));
      meaning = normalizeSpaces(withRomaji[3]);
    } else {
      const kanaOnly = line.match(/^([\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+):\s*(.+)$/u);
      if (!kanaOnly) continue;
      word = normalizeSpaces(kanaOnly[1]);
      romaji = kanaToRomaji(word);
      meaning = normalizeSpaces(kanaOnly[2]);
    }

    if (!word || !meaning || !romaji || !hasJapanese(word)) continue;
    if (/download|preview|lesson|ebook/i.test(word)) continue;

    rows.push({
      level,
      word,
      reading: isKanaOnly(word) ? word : "",
      romaji,
      meaning,
      sourceUrl,
    });
  }
  return rows;
}

function slugifyVocab(level, word, reading) {
  const base = `${word || reading}-${reading || word}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[〜~]/g, "prefix-")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `vocabulary-${level.toLowerCase()}-${base || Math.random().toString(36).slice(2)}`;
}

function contentFor(row) {
  const readingLine = row.reading ? `- Furigana: ${row.reading}` : "- Furigana: Add kana reading during review if this word uses kanji.";
  return [
    `# ${row.word}`,
    "",
    "## Quick Meaning",
    `${row.word} means "${row.meaning}".`,
    "",
    "## Reading",
    readingLine,
    `- Romaji: ${row.romaji}`,
    "",
    "## Study Flow",
    `First read ${row.word} aloud, then connect the sound "${row.romaji}" with the meaning "${row.meaning}".`,
    "",
    "## Recall Practice",
    `1. Cover the English and say the meaning of ${row.word}.`,
    `2. Cover the Japanese and write the word for "${row.meaning}".`,
    `3. Say the romaji aloud: ${row.romaji}.`,
    "",
    "## Mini Sentence Drill",
    `Write one short sentence using ${row.word}. Keep the sentence simple, then upgrade it with a time word or place word.`,
    "",
    "## Next Step",
    "Add this word to your review queue and revisit it inside a real sentence.",
  ].join("\n");
}

function dbRow(row) {
  const slug = slugifyVocab(row.level, row.word, row.reading);
  const meta = {
    japanese: row.word,
    reading: row.reading,
    romaji: row.romaji,
    meaning: row.meaning,
    source: "japanesetest4you",
    source_url: row.sourceUrl,
    imported_levels: [row.level],
  };

  return {
    ...row,
    slug,
    title: `${row.word} (${row.romaji})`,
    summary: `${row.level} vocabulary: ${row.word} means ${row.meaning}.`,
    content: contentFor(row),
    status,
    meta,
    notes: "Imported from N3/N2/N1 vocabulary coverage list.",
  };
}

async function upsertBatch(client, rows) {
  if (!rows.length) return { inserted: 0, updated: 0 };
  const result = await client.query(
    `
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS row_data(
          level text,
          word text,
          reading text,
          romaji text,
          meaning text,
          sourceUrl text,
          slug text,
          title text,
          summary text,
          content text,
          status text,
          meta jsonb,
          notes text
        )
      ),
      existing AS (
        SELECT DISTINCT ON (input.word, input.reading)
          input.*, v.id AS vocabulary_id, v.post_id, v.reading AS existing_reading
        FROM input
        JOIN vocabulary v
          ON lower(trim(v.word)) = lower(trim(input.word))
         AND (
           coalesce(lower(trim(v.reading)), '') = coalesce(lower(trim(input.reading)), '')
           OR coalesce(trim(input.reading), '') = ''
         )
        ORDER BY input.word, input.reading, CASE WHEN coalesce(trim(v.reading), '') <> '' THEN 0 ELSE 1 END, v.updated_at DESC NULLS LAST
      ),
      updated_vocab AS (
        UPDATE vocabulary v
        SET reading = coalesce(nullif(v.reading, ''), nullif(existing.reading, '')),
            romaji = coalesce(nullif(v.romaji, ''), existing.romaji),
            meaning = coalesce(nullif(v.meaning, ''), existing.meaning),
            jlpt_level = coalesce(v.jlpt_level, existing.level),
            notes = coalesce(nullif(v.notes, ''), existing.notes),
            updated_at = now()
        FROM existing
        WHERE v.id = existing.vocabulary_id
        RETURNING v.id
      ),
      updated_posts AS (
        UPDATE posts p
        SET meta = coalesce(p.meta, '{}'::jsonb) || existing.meta,
            content_type = 'vocabulary',
            updated_at = now()
        FROM existing
        WHERE p.id = existing.post_id
        RETURNING p.id
      ),
      new_input AS (
        SELECT input.*
        FROM input
        WHERE NOT EXISTS (
          SELECT 1
          FROM vocabulary v
          WHERE lower(trim(v.word)) = lower(trim(input.word))
            AND (
              coalesce(lower(trim(v.reading)), '') = coalesce(lower(trim(input.reading)), '')
              OR coalesce(trim(input.reading), '') = ''
            )
        )
      ),
      upserted_posts AS (
        INSERT INTO posts (
          slug, title, summary, content, jlpt_level, tags, status, published_at,
          content_type, sort_order, meta, created_at, updated_at
        )
        SELECT
          slug,
          title,
          summary,
          content,
          ARRAY[level]::text[],
          ARRAY['vocabulary', level]::text[],
          status,
          CASE WHEN status = 'published' THEN now() ELSE NULL END,
          'vocabulary',
          0,
          meta,
          now(),
          now()
        FROM new_input
        ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            jlpt_level = EXCLUDED.jlpt_level,
            tags = EXCLUDED.tags,
            status = EXCLUDED.status,
            content_type = 'vocabulary',
            meta = coalesce(posts.meta, '{}'::jsonb) || EXCLUDED.meta,
            updated_at = now()
        RETURNING id, slug
      ),
      inserted_vocab AS (
        INSERT INTO vocabulary (post_id, word, reading, romaji, meaning, notes, jlpt_level, created_at, updated_at)
        SELECT
          upserted_posts.id,
          new_input.word,
          nullif(new_input.reading, ''),
          new_input.romaji,
          new_input.meaning,
          new_input.notes,
          new_input.level,
          now(),
          now()
        FROM new_input
        JOIN upserted_posts ON upserted_posts.slug = new_input.slug
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT
        (SELECT COUNT(*)::int FROM inserted_vocab) AS inserted,
        (SELECT COUNT(*)::int FROM updated_vocab) AS updated
    `,
    [JSON.stringify(rows)]
  );

  return {
    inserted: Number(result.rows[0]?.inserted || 0),
    updated: Number(result.rows[0]?.updated || 0),
  };
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  const parsedRows = [];
  for (const source of SOURCES) {
    const markdown = await fetchText(readerUrl(source.url));
    const rows = parseVocabularyRows(markdown, source.level, source.url);
    console.log(`${source.level}: parsed ${rows.length} rows from ${source.url}`);
    parsedRows.push(...rows);
  }

  const uniqueRows = [];
  const seen = new Set();
  for (const row of parsedRows) {
    const key = `${row.word.trim().toLowerCase()}|${(row.reading || "").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  console.log(`Unique N3/N2/N1 rows to process: ${uniqueRows.length}`);
  if (!apply) {
    console.log("Dry run only. Add --apply --confirm=IMPORT_N3_N2_N1_VOCAB to write rows.");
    process.exit(0);
  }

  let inserted = 0;
  let updated = 0;

  await client.query("BEGIN");
  try {
    const rows = uniqueRows.map(dbRow);
    const batchSize = 250;
    for (let i = 0; i < rows.length; i += batchSize) {
      const result = await upsertBatch(client, rows.slice(i, i + batchSize));
      inserted += result.inserted;
      updated += result.updated;
      console.log(`Processed ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }

  console.log(`Import complete. Inserted ${inserted}, updated ${updated}.`);
} finally {
  await client.end();
}
