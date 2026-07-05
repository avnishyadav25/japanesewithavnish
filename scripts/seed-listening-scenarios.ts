import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface Scenario {
  title: string;
  level: string;
  notes: string; // Transcript / English explanation
  audio_url: string;
}

const SCENARIOS: Scenario[] = [
  // N4
  {
    title: "Asking for Directions at the Station (駅で道を尋ねる)",
    level: "N4",
    notes: "A: すみません、新宿駅へはどう行けばいいですか？\nB: この角を右に曲がって、まっすぐ行くと駅が見えますよ。\nA: ありがとうございます！\n\nEnglish:\nA: Excuse me, how can I get to Shinjuku Station?\nB: Turn right at this corner, go straight, and you will see the station.\nA: Thank you very much!",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    title: "Making Plans for the Weekend (週末の予定を立てる)",
    level: "N4",
    notes: "A: 土曜日、一緒に映画を見に行きませんか？\nB: いいですね。何時に会いましょうか？\nA: 映画は2時から始まるので、1時半にロビーで会いましょう。\n\nEnglish:\nA: Would you like to go see a movie together on Saturday?\nB: Sounds good. What time shall we meet?\nA: The movie starts at 2:00, so let's meet in the lobby at 1:30.",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    title: "Ordering Food at a Restaurant (レストランで注文する)",
    level: "N4",
    notes: "A: ご注文はお決まりですか？\nB: はい、ラーメンと餃子を一つずつお願いします。\nA: かしこまりました。少々お待ちください。\n\nEnglish:\nA: Have you decided on your order?\nB: Yes, one ramen and one gyoza, please.\nA: Understood. Please wait a moment.",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },

  // N3
  {
    title: "Talking about Hobbies and Interests (趣味について話す)",
    level: "N3",
    notes: "A: 最近、何か新しい趣味を始めましたか？\nB: 実は、先月から写真撮影を始めました。カメラを持って山に登るのが楽しいんです。\nA: 素晴らしいですね！今度撮った写真を見せてください。\n\nEnglish:\nA: Have you started any new hobbies recently?\nB: Actually, I started photography last month. I enjoy climbing mountains with my camera.\nA: That is wonderful! Please show me the photos you took next time.",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    title: "Explaining a Delayed Train Schedule (電車の遅延について説明する)",
    level: "N3",
    notes: "A: 電車がなかなか来ないね。どうしたんだろう？\nB: 構内アナウンスによると、大雨の影響で15分ほど遅れているらしいよ。\nA: そうなんだ。授業の開始に間に合うといいけど。\n\nEnglish:\nA: The train is not coming at all. What is wrong?\nB: According to the station announcement, it seems to be delayed by about 15 minutes due to heavy rain.\nA: I see. I hope I can make it in time for the start of class.",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },

  // N2
  {
    title: "Discussing Environmental Protection (環境保護についてのディスカッション)",
    level: "N2",
    notes: "A: 二酸化炭素の排出量を削減するために、個人レベルでできる取り組みは何でしょうか？\nB: まずは、プラスチックの使用を避けることや、こまめに節電することが容易で効果的です。\nA: 確かに、日々の小さな意識改革が極めて重要ですね。\n\nEnglish:\nA: What initiatives can be taken at the individual level to reduce carbon dioxide emissions?\nB: First of all, avoiding plastic use and regularly saving electricity are easy and effective.\nA: True, minor daily shifts in consciousness are extremely crucial.",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  },
  {
    title: "Analyzing Market Sales Reports (売上報告の分析)",
    level: "N2",
    notes: "A: 今期の売上は前年同期比で約10%増加しています。特にオンラインチャネルの成長が顕著です。\nB: 素晴らしい分析です。しかし、顧客獲得単価も上昇しているので、効率性を見直す必要があります。\nA: 承知いたしました。来週までに販促費の最適化案をまとめます。\n\nEnglish:\nA: This term's sales increased by about 10% year-on-year. Growth in the online channel is particularly prominent.\nB: Great analysis. However, customer acquisition cost is also rising, so we need to review efficiency.\nA: Understood. I will compile a promotion cost optimization proposal by next week.",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  },

  // N1
  {
    title: "Academic Lecture on Japanese History (日本史に関する学術講義)",
    level: "N1",
    notes: "講師: 本日は江戸時代の鎖国政策における貿易統制について考察します。当時の対外貿易は単なる制限ではなく、幕府権力の維持を企図した政治的戦略であったという側面が、近年の研究で明らかになっています。\n\nEnglish:\nLecturer: Today we will analyze trade control under the Edo period isolation policy. Recent studies reveal that foreign trade at the time was not just a mere restriction, but a political strategy designed to maintain Shogunate power.",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  },
  {
    title: "Debating Match on AI Ethics (AI倫理に関するディベート)",
    level: "N1",
    notes: "討論者: 自律型AIが引き起こした事故に関して、開発企業とエンドユーザーのいずれが責任の帰属先となるべきかという葛藤が、法的な観点からも盛んに議論されています。一概に決定を下すのは極めて困難です。\n\nEnglish:\nDebater: Regarding accidents caused by autonomous AI, the conflict over whether the development enterprise or the end-user should be the point of attribution of responsibility is actively discussed from a legal viewpoint. It is extremely difficult to make a generalization.",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
  },
];

async function seed() {
  console.log("Seeding listening scenarios...");
  try {
    for (const sc of SCENARIOS) {
      // Check if already exists
      const existing = await sql`
        SELECT l.id FROM listening l
        JOIN posts p ON l.post_id = p.id
        WHERE l.title = ${sc.title} LIMIT 1
      `;
      if (existing.length > 0) {
        console.log(`Skipping already existing: ${sc.title}`);
        continue;
      }

      const slug = `listening-${sc.level.toLowerCase()}-${sc.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 40)}`;

      // Insert post
      const postRows = await sql`
        INSERT INTO posts (slug, title, content, content_type, jlpt_level, status)
        VALUES (${slug}, ${sc.title}, ${sc.notes}, 'listening', ARRAY[${sc.level}], 'published')
        RETURNING id
      ` as { id: string }[];
      const postId = postRows[0]?.id;

      // Insert listening
      await sql`
        INSERT INTO listening (post_id, title, level, audio_url, notes)
        VALUES (${postId}, ${sc.title}, ${sc.level}, ${sc.audio_url}, ${sc.notes})
      `;
      console.log(`Seeded listening scenario: ${sc.title} (${sc.level})`);
    }
    console.log("Finished seeding listening scenarios.");
  } catch (err) {
    console.error("Error seeding listening scenarios:", err);
    process.exit(1);
  }
}

seed();
