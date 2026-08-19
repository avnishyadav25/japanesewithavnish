/**
 * The reusable asset library: what gets generated once and reused across every video.
 *
 * WHY A LIBRARY AND NOT PER-VIDEO GENERATION. An image model call is ~8.6s measured and costs
 * money every time; a Short that wants a torii in the corner should not pay for one. These are
 * generated once, reviewed on a contact sheet, promoted to R2, and then referenced by slug — so
 * the marginal cost of decorating any number of videos is zero, and the look stays consistent
 * because it is literally the same file.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT IN THIS LIST
 *
 * No third-party characters and no brand marks. Goku, Pikachu, Hello Kitty, Totoro, Doraemon,
 * Rilakkuma and the rest are owned by Toei, Nintendo, Sanrio, Ghibli, Fujiko Pro and San-X;
 * generating them into monetised videos is infringement, and the practical cost lands on the
 * channel as a strike rather than on the render. The same goes for packaging — KitKat, Pocky,
 * Tokyo Banana, Muji, LOFT — so the FOOD is drawn generically instead: a matcha wafer bar, not a
 * branded one.
 *
 * What IS here in their place: an original cast in the same visual register, which the channel
 * owns outright and can reuse, and the real animals — Hachikō, Tama, the Nara deer and the Nagano
 * snow monkeys are actual animals and freely depictable.
 * ---------------------------------------------------------------------------
 */
export type AssetCategory = "food" | "object" | "animal" | "character" | "texture";

export interface AssetSpec {
  slug: string;
  category: AssetCategory;
  label: string;
  /** The subject clause. The rest of the prompt is shared, so the style cannot drift per asset. */
  subject: string;
  /** Matched against scene content to pick a relevant sticker rather than a random one. */
  tags: string[];
}

const food = (slug: string, label: string, subject: string, tags: string[]): AssetSpec =>
  ({ slug, category: "food", label, subject, tags });
const object = (slug: string, label: string, subject: string, tags: string[]): AssetSpec =>
  ({ slug, category: "object", label, subject, tags });
const animal = (slug: string, label: string, subject: string, tags: string[]): AssetSpec =>
  ({ slug, category: "animal", label, subject, tags });
const character = (slug: string, label: string, subject: string, tags: string[]): AssetSpec =>
  ({ slug, category: "character", label, subject, tags });
const texture = (slug: string, label: string, subject: string, tags: string[]): AssetSpec =>
  ({ slug, category: "texture", label, subject, tags });

export const ASSET_SPECS: AssetSpec[] = [
  // --- food & drink, all unbranded --------------------------------------------------------
  food("rice-bowl", "Bowl of rice", "a bowl of short-grain white rice with chopsticks resting across it", ["food", "meal", "rice"]),
  food("ramen-bowl", "Ramen", "a bowl of ramen with a soft egg, nori and spring onion", ["food", "noodles", "meal"]),
  food("udon-bowl", "Udon", "a bowl of thick udon noodles in clear broth", ["food", "noodles"]),
  food("soba-plate", "Soba", "cold soba noodles on a bamboo tray with a dipping cup", ["food", "noodles"]),
  food("soy-sauce", "Soy sauce", "a small ceramic soy sauce bottle and dish", ["food", "seasoning", "kitchen"]),
  food("mirin-sake", "Mirin and sake", "a sake bottle and two small cups", ["food", "drink", "seasoning"]),
  food("miso-paste", "Miso", "a small wooden tub of miso paste with a spoon", ["food", "seasoning"]),
  food("rice-vinegar", "Rice vinegar", "a glass bottle of rice vinegar beside a measuring spoon", ["food", "seasoning"]),
  food("dashi-nori", "Dashi and nori", "a folded sheet of nori seaweed beside a small pot of dashi stock", ["food", "seasoning"]),
  food("furikake", "Furikake", "a small jar of furikake rice seasoning, lid off", ["food", "seasoning"]),
  food("matcha-set", "Matcha", "a matcha bowl with a bamboo whisk and bright green tea", ["food", "drink", "tea"]),
  food("hojicha-cup", "Hojicha", "a warm cup of roasted hojicha tea with steam", ["food", "drink", "tea"]),
  food("mochi-plate", "Mochi", "three pastel mochi on a small plate", ["food", "sweet"]),
  food("matcha-wafer", "Matcha wafer bar", "a green matcha-flavoured chocolate wafer bar, snapped in half, NO packaging and NO branding", ["food", "sweet"]),
  food("biscuit-sticks", "Biscuit sticks", "a handful of chocolate-dipped biscuit sticks, loose, NO box and NO branding", ["food", "sweet"]),
  food("banana-sponge", "Banana sponge cake", "a small banana-shaped sponge cake, unwrapped, NO packaging and NO branding", ["food", "sweet"]),

  // --- objects ----------------------------------------------------------------------------
  object("torii-gate", "Torii gate", "a vermilion torii gate standing alone", ["place", "culture", "shrine"]),
  object("sakura-branch", "Sakura branch", "a branch of cherry blossom in bloom", ["nature", "season", "spring"]),
  object("paper-lantern", "Paper lantern", "a red paper lantern glowing softly", ["culture", "evening", "festival"]),
  object("folding-fan", "Folding fan", "an open folding fan with a simple wave pattern", ["culture", "object"]),
  object("wave-crest", "Wave", "a single stylised cresting wave in the woodblock tradition", ["nature", "sea"]),
  object("daruma", "Daruma", "a round red daruma doll with one eye filled in", ["culture", "luck", "goal"]),
  object("maneki-neko", "Maneki-neko", "a white beckoning-cat figurine with a raised paw", ["culture", "luck", "shop"]),
  object("ceramic-cups", "Ceramics", "two rustic hand-thrown ceramic cups, earthy glaze", ["craft", "object", "home"]),
  object("iron-kettle", "Iron kettle", "a cast-iron tetsubin kettle with a rounded handle", ["craft", "object", "tea"]),
  object("notebook-pen", "Notebook and pen", "an open notebook with a fine pen resting on it", ["study", "stationery", "write"]),
  object("study-desk", "Study corner", "a small desk with a lamp, a stacked textbook and a mug", ["study", "home"]),
  object("skincare-set", "Skincare", "a simple bottle and tube of skincare, unbranded, soft neutral packaging", ["home", "daily"]),
  object("bento-box", "Bento box", "a lacquered bento box, open, with neat compartments", ["food", "meal", "daily"]),
  object("train-ticket", "Train and ticket", "a commuter train ticket and a rail pass", ["travel", "city", "daily"]),

  // --- real animals -----------------------------------------------------------------------
  animal("akita-loyal", "Loyal Akita", "a sitting Akita dog waiting patiently, in the spirit of Hachikō the famously loyal dog", ["animal", "dog", "loyal"]),
  animal("station-cat", "Station cat", "a calico cat wearing a small stationmaster cap, in the spirit of Tama the station cat", ["animal", "cat", "work"]),
  animal("nara-deer", "Nara deer", "a sika deer bowing its head, as the free-roaming deer of Nara Park do", ["animal", "deer", "place"]),
  animal("snow-monkey", "Snow monkey", "a Japanese macaque sitting in a steaming hot spring in snow", ["animal", "monkey", "winter"]),
  animal("koi-fish", "Koi", "a single orange and white koi swimming", ["animal", "fish", "water"]),
  animal("crane-bird", "Crane", "a red-crowned crane standing tall", ["animal", "bird", "luck"]),

  // --- original cast, anime register, owned outright ---------------------------------------
  // No age word. The first version asked for a "teenage student" and was the only character the
  // model refused outright — image models routinely decline to depict minors, and the refusal was
  // invisible because the provider reported it as "model may not support image generation".
  character("student-hero", "Student hero", "an original spiky-haired young adult in a college jacket, grinning, one fist raised in triumph, anime style", ["character", "study", "energy"]),
  character("magical-learner", "Magical learner", "an original cheerful magical-girl style student holding a glowing pen like a wand, anime style", ["character", "study", "magic"]),
  character("calm-sensei", "Calm sensei", "an original patient teacher in a simple haori holding a book, warm expression, anime style", ["character", "teach", "calm"]),
  character("spark-creature", "Spark creature", "an original small round yellow creature with a lightning-bolt tail tuft, cheerful, anime style, NOT any existing franchise character", ["character", "mascot", "energy"]),
  character("study-buddy", "Study buddy", "an original small blue round robot-cat companion with a friendly face, anime style, NOT any existing franchise character", ["character", "mascot", "helper"]),
  character("ninja-learner", "Ninja learner", "an original young ninja in a headband mid-stride, determined, anime style", ["character", "energy", "practice"]),

  // --- textures ---------------------------------------------------------------------------
  texture("washi-paper", "Washi paper", "a flat washi paper texture with visible fibres, warm off-white, edge to edge", ["texture", "background"]),
  texture("indigo-gradient", "Indigo gradient", "a soft indigo-to-cream gradient mesh, edge to edge, no subject", ["texture", "background"]),
  texture("sakura-scatter", "Sakura scatter", "scattered cherry blossom petals on a plain warm background, edge to edge", ["texture", "background", "spring"]),
  texture("seigaiha", "Seigaiha waves", "a repeating seigaiha wave pattern in muted blue, edge to edge", ["texture", "background", "pattern"]),
];

export function assetsByCategory(category: AssetCategory): AssetSpec[] {
  return ASSET_SPECS.filter((a) => a.category === category);
}

/**
 * The prompt for one library asset.
 *
 * DELIBERATELY DIFFERENT FROM `backgroundPrompt()` in src/lib/social/imageSizes.ts, which still
 * ends with "No anime style, no human faces". That rule stays where it is: blog art, thumbnails
 * and og:images are static pictures competing on looking trustworthy, and the calm flat-vector
 * look serves them. Shorts compete on stopping a scroll. Two surfaces, two registers — the split
 * is the point, not an inconsistency.
 *
 * The no-text rule is carried over verbatim, because it was learned the hard way: asking for an
 * illustration of a lesson topic produced a teaching diagram with the vocabulary rendered into the
 * picture, despite five separate instructions not to draw text.
 */
export function assetPrompt(spec: AssetSpec): string {
  const isCharacter = spec.category === "character";
  const isTexture = spec.category === "texture";

  return [
    isCharacter
      ? "A single original character, clean modern anime illustration style, bold flat colours with"
      : isTexture
        ? "A flat seamless background texture,"
        : "A single object, clean flat vector illustration with soft shading,",
    isCharacter ? "crisp linework, expressive face, full body, dynamic pose." : "minimal Japanese aesthetic, warm muted palette.",
    "",
    `SUBJECT: ${spec.subject}.`,
    "",
    isTexture
      ? "Fill the entire canvas edge to edge. No subject, no focal point, no border."
      : [
          // Transparent PNG is what lets one asset sit over any theme. Without asking for it the
          // model returns a white card, which then shows as a rectangle over the video.
          "TRANSPARENT BACKGROUND — the subject only, cut out, with nothing behind it.",
          "No ground shadow, no backdrop, no frame, no card, no vignette, no colour fill.",
          "Centred, filling most of the canvas, generous margin so nothing is clipped.",
        ].join("\n"),
    "",
    "STRICTLY NO TEXT OF ANY KIND. No letters, words, kanji, kana, numbers, captions, labels,",
    "logos, watermarks, signage or packaging copy.",
    "NO existing franchise, brand or trademarked character — this must be an original design.",
    isCharacter ? "" : "No human faces.",
    "No neon colours, no clutter, no photorealism.",
  ]
    .filter(Boolean)
    .join("\n");
}
