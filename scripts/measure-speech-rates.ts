/**
 * Measures characters-per-second of synthesised narration, per language.
 *
 * WHY THIS EXISTS. `SPEECH_RATES` in src/lib/video/pacing.ts drives every word budget the LLM is
 * given, and therefore how long every video runs. Two of its four numbers came from 49 real clips;
 * `hi` was a guess carrying the comment "no measurements yet" and was wrong by ~18%, which means
 * Hindi videos were asked for too few words and ran short with dead air behind the visuals.
 *
 * Nothing in the repo could reproduce those numbers. This can. Run it after changing a default
 * voice, adding a language, or when a video's measured length drifts from its estimate.
 *
 *   npm run video:measure-rates              every language
 *   npm run video:measure-rates -- --lang=hi one language
 *   npm run video:measure-rates -- --voice=en-IN-Neural2-A  a specific voice
 *
 * METHOD. Synthesises a corpus of sentences shaped like real narration — a teaching sentence or
 * two, no markup — through the same `synthesize()` the renderer uses, then divides total characters
 * by total audio seconds. Per-sentence rates vary by ±10% with phrasing; the total is what matters,
 * which is why the original measurement pooled 19 and 30 clips rather than timing one line.
 *
 * COST. ~60 short clips, a fraction of a cent. It uploads nothing and writes nothing.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * The corpus.
 *
 * Deliberately ordinary narration: explanations, not word lists. A corpus of single words would
 * measure the wrong thing, because per-clip overhead (lead-in silence, final decay) dominates a
 * two-second clip and vanishes in a ten-second one.
 */
const CORPUS: Record<string, string[]> = {
  en: [
    "Today we will learn five essential words that you will use every single day in Japan.",
    "This one is a noun, and it behaves exactly the way you would expect it to.",
    "Notice that the particle changes depending on whether the thing moves or stays still.",
    "A lot of learners get this wrong at first, so let us slow down and look at why.",
    "Try saying it out loud after me, and pay attention to where the pitch falls.",
    "The polite form is what you would use with someone you have just met.",
    "In casual speech among friends, you would drop that ending entirely.",
    "Here is the same idea in a sentence you might actually hear on a train platform.",
    "That is the whole pattern. Everything else is just swapping the verb.",
    "If you remember only one thing from this video, make it this one.",
    "The kanji looks complicated, but it is built from two parts you already know.",
    "This appears constantly in reading passages at this level, so it is worth memorising.",
    "Compare those two and you can hear the difference immediately.",
    "We will come back to this in a later lesson, once the basics are comfortable.",
    "Practise these five for a week and they will start to feel automatic.",
  ],
  hi: [
    "आज हम पाँच ज़रूरी शब्द सीखेंगे जो आप जापान में हर दिन इस्तेमाल करेंगे।",
    "यह एक संज्ञा है, और यह ठीक उसी तरह काम करती है जैसी आप उम्मीद करेंगे।",
    "ध्यान दें कि कारक बदल जाता है, यह इस पर निर्भर करता है कि चीज़ हिलती है या स्थिर रहती है।",
    "बहुत से सीखने वाले शुरू में यह गलती करते हैं, तो चलिए धीरे-धीरे समझते हैं।",
    "मेरे बाद इसे ज़ोर से बोलने की कोशिश करें और सुर पर ध्यान दें।",
    "विनम्र रूप वह है जो आप किसी नए व्यक्ति से बात करते समय इस्तेमाल करेंगे।",
    "दोस्तों के बीच आम बातचीत में आप वह अंत पूरी तरह छोड़ देंगे।",
    "यहाँ वही बात एक वाक्य में है जो आप ट्रेन प्लेटफ़ॉर्म पर सुन सकते हैं।",
    "यही पूरा पैटर्न है। बाकी सब सिर्फ़ क्रिया बदलना है।",
    "अगर आप इस वीडियो से एक ही चीज़ याद रखें, तो यही रखें।",
    "कांजी मुश्किल दिखती है, लेकिन यह दो हिस्सों से बनी है जो आप पहले से जानते हैं।",
    "यह इस स्तर के पठन में बार-बार आता है, इसलिए इसे याद रखना फ़ायदेमंद है।",
    "इन दोनों की तुलना करें और आपको फ़र्क़ तुरंत सुनाई देगा।",
    "हम बाद के पाठ में इस पर लौटेंगे, जब बुनियादी बातें आसान लगने लगें।",
    "एक हफ़्ते तक इन पाँचों का अभ्यास करें और ये अपने आप याद हो जाएँगे।",
  ],
  // Romanised, because that is what the audience reads and writes — the same decision the social
  // engine documents in platforms.ts. Devanagari on an Indian English voice reads as gibberish.
  hinglish: [
    "Aaj hum paanch zaroori shabd seekhenge jo aap Japan mein har din istemaal karenge.",
    "Yeh ek noun hai, aur yeh exactly waise behave karta hai jaise aap expect karenge.",
    "Dhyaan dein ki particle badal jaata hai, depending on ki cheez move karti hai ya nahi.",
    "Bohot se learners shuru mein yeh galti karte hain, to chaliye dheere dheere dekhte hain.",
    "Mere baad ise zor se bolne ki koshish karein, aur pitch par dhyaan dein.",
    "Polite form woh hai jo aap kisi naye vyakti se baat karte waqt use karenge.",
    "Doston ke beech casual baat mein aap woh ending poori tarah drop kar denge.",
    "Yahan wahi idea ek sentence mein hai jo aap train platform par sun sakte hain.",
    "Yeh poora pattern hai. Baaki sab sirf verb badalna hai.",
    "Agar aap is video se ek hi cheez yaad rakhein, to yahi rakhein.",
    "Kanji mushkil lagti hai, lekin yeh do parts se bani hai jo aap already jaante hain.",
    "Yeh is level ke reading passages mein constantly aata hai, to yaad rakhna worth it hai.",
    "In dono ko compare karein aur aapko farak turant sunai dega.",
    "Hum baad ke lesson mein is par wapas aayenge, jab basics comfortable ho jaayein.",
    "Ek hafte tak in paanchon ka practice karein aur ye automatic feel hone lagenge.",
  ],
  // Japanese narration is measured at 0.9x, the reference rate the pacing config uses, because a
  // teaching video slows it deliberately so each mora is catchable.
  ja: [
    "こんにちは。今日は五つの大切な言葉を勉強します。",
    "これは名詞です。使い方はとても簡単です。",
    "助詞が変わることに注意してください。",
    "最初は間違えやすいので、ゆっくり見ていきましょう。",
    "私のあとで、声に出して言ってみてください。",
    "丁寧な形は、初めて会う人に使います。",
    "友達との会話では、この形を使います。",
    "駅で聞くかもしれない文で見てみましょう。",
    "これで全部です。あとは動詞を変えるだけです。",
    "一つだけ覚えるなら、これを覚えてください。",
    "この漢字は、二つの部分からできています。",
    "この言葉は読み物によく出てきます。",
    "二つを比べると、違いがすぐに分かります。",
    "基本ができたら、また後の課で戻ります。",
    "一週間練習すれば、自然に使えるようになります。",
  ],
};

/** The voice each language is measured on, and the rate it is measured at. */
const SETUP: Record<string, { voice: string; rate: number }> = {
  en: { voice: "en-US-Neural2-F", rate: 1.0 },
  hi: { voice: "hi-IN-Neural2-A", rate: 1.0 },
  hinglish: { voice: "en-IN-Neural2-A", rate: 1.0 },
  ja: { voice: "ja-JP-Neural2-B", rate: 0.9 },
};

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function main() {
  const { synthesize } = await import("../src/lib/video/tts");
  const { SPEECH_RATES } = await import("../src/lib/video/pacing");

  const onlyLang = arg("lang");
  const voiceOverride = arg("voice");
  const langs = onlyLang ? [onlyLang] : Object.keys(CORPUS);

  console.log("Measuring characters per second of finished audio.\n");

  const results: { lang: string; voice: string; rate: number; clips: number; chars: number; secs: number; cps: number }[] = [];

  for (const lang of langs) {
    const corpus = CORPUS[lang];
    const setup = SETUP[lang];
    if (!corpus || !setup) {
      console.log(`  ${lang}: no corpus — add one to scripts/measure-speech-rates.ts`);
      continue;
    }
    const voice = voiceOverride ?? setup.voice;

    let chars = 0;
    let secs = 0;
    process.stdout.write(`  ${lang.padEnd(9)} ${voice.padEnd(22)} @${setup.rate}x  `);
    for (const sentence of corpus) {
      const out = await synthesize({
        ssml: `<speak>${sentence}</speak>`,
        voiceName: voice,
        speakingRate: setup.rate,
        pitch: 0,
      });
      chars += out.charCount;
      secs += out.durationSeconds;
      process.stdout.write(".");
    }
    const cps = chars / secs;
    console.log(`  ${corpus.length} clips, ${chars} chars, ${secs.toFixed(1)}s -> ${cps.toFixed(2)} c/s`);
    results.push({ lang, voice, rate: setup.rate, clips: corpus.length, chars, secs, cps });
  }

  // Printed in the exact shape pacing.ts's header comment already uses, so the file can be updated
  // by copying this block in.
  console.log("\n--- for src/lib/video/pacing.ts ---\n");
  for (const r of results) {
    console.log(` *   ${r.voice} @${r.rate}x : ${r.clips} clips, ${r.chars} chars, ${r.secs.toFixed(1)}s -> ${r.cps.toFixed(2)} c/s`);
  }
  console.log("");
  for (const r of results) {
    console.log(`  ${r.lang}: { charsPerSecond: ${r.cps.toFixed(2)}, referenceRate: ${r.rate} },`);
  }

  console.log("\n--- drift from what is stored ---\n");
  for (const r of results) {
    const stored = (SPEECH_RATES as Record<string, { charsPerSecond: number } | undefined>)[r.lang];
    if (!stored) {
      console.log(`  ${r.lang.padEnd(9)} not stored yet -> ${r.cps.toFixed(2)}`);
      continue;
    }
    const drift = ((r.cps - stored.charsPerSecond) / stored.charsPerSecond) * 100;
    const verdict = Math.abs(drift) < 5 ? "close enough, leave it" : "UPDATE — budgets are off by this much";
    console.log(
      `  ${r.lang.padEnd(9)} stored ${stored.charsPerSecond.toFixed(2).padStart(6)}  measured ${r.cps.toFixed(2).padStart(6)}  ` +
        `${drift >= 0 ? "+" : ""}${drift.toFixed(1)}%  ${verdict}`
    );
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
