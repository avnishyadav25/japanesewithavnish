/**
 * The brand, in one place.
 *
 * This exists because the handle was a string literal in five files and two of them disagreed with
 * the database: `Footer.tsx` and `JsonLd.tsx` both fell back to `instagram.com/japanesewithavnish`
 * while `site_settings.instagram_url` said `.../learnjapanesewithavnish`. One of those was a dead
 * link, and nothing in the codebase could tell you which.
 *
 * Now there is exactly one `handle` constant. Change it here and the footer, the structured data,
 * the payment page and every rendered video follow.
 *
 * `site_settings` stays authoritative for the website wherever a row exists — an admin editing a URL
 * in /admin/settings must still win. These are the fallbacks, and they are what the video reads,
 * because a Remotion render has no database.
 *
 * No `next/*` imports: the Remotion tree and the portable worker both pull this in.
 */
import { SITE_URL } from "./seo";

export type SocialPlatform =
  | "youtube"
  | "instagram"
  | "x"
  | "facebook"
  | "threads"
  | "pinterest"
  | "linkedin"
  | "tiktok"
  | "reddit";

export interface SocialAccount {
  platform: SocialPlatform;
  /** Human label for `aria-label` and alt text. */
  label: string;
  /** Without the "@". Most platforms share the brand handle; a few do not. */
  handle: string;
  /** Fallback profile URL, used when `site_settings` has no row for `settingsKey`. */
  url: string;
  /** The `site_settings` row that overrides `url` on the website. */
  settingsKey: string;
  /**
   * The account has been verified to exist.
   *
   * Unconfirmed entries still let the social engine generate copy for the platform, but nothing
   * writes their URL to `site_settings` and nothing links to them — a fabricated profile URL is
   * a dead link waiting to be surfaced, and in `sameAs` it is a bad SEO signal as well.
   */
  confirmed: boolean;
  /** Shown in the site footer. */
  inFooter: boolean;
  /** Shown on the video outro's follow row. Deliberately a short list — four icons read at a
   * glance on a phone, nine become a texture. */
  inVideoOutro: boolean;
}

/**
 * The handle used on most platforms — and confirmed against the live accounts, not assumed.
 *
 * NOT universal. X is `learnjpnavnish` and Reddit is a personal account under a different name
 * entirely, so each entry in SOCIALS below carries its own `handle` and `url`. An earlier version
 * of this file derived every URL from one constant, which would have printed a dead handle on
 * the video outro for X.
 */
const HANDLE = "japanesewithavnish";

/** The real domain, for anywhere a dev host would be actively wrong. */
const PRODUCTION_DOMAIN = "japanesewithavnish.com";

/**
 * The domain to PRINT on something permanent.
 *
 * Deliberately not just `SITE_URL`: on a developer machine that is `http://localhost:3000`, and
 * a video generated there burns "localhost:3000" into a card that ends up on YouTube. This was
 * not hypothetical — the first rendered preview of the outro showed exactly that.
 *
 * `storyboard.ts` had a private guard for this; it lives here now so anything that displays the
 * domain gets it, not just the one call site that remembered.
 */
function displayDomain(): string {
  const raw = SITE_URL.trim();
  if (!raw || /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(?::|\/|$)|netlify\.app|vercel\.app/i.test(raw)) {
    return PRODUCTION_DOMAIN;
  }
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export const BRAND = {
  name: "Japanese with Avnish",
  /** No spaces: used for hashtags, @handles and the video outro subline. */
  shortName: "JapaneseWithAvnish",
  tagline: "Learn Japanese the Right Way",
  siteUrl: SITE_URL,
  productionDomain: PRODUCTION_DOMAIN,
  /**
   * Bare domain for display — a video can't be clicked, so "https://" is noise on screen, and a
   * dev or preview host would be a lie. Never `localhost`, never a `netlify.app` subdomain.
   */
  displayUrl: displayDomain(),
  handle: HANDLE,
  atHandle: `@${HANDLE}`,
  hashtag: "#JapaneseWithAvnish",
} as const;

export const SOCIALS: readonly SocialAccount[] = [
  // -- Accounts on the shared handle. These four carry the video outro, precisely because they
  //    agree: the outro prints ONE handle line, so a platform whose handle differs cannot appear
  //    beside it without sending viewers to a name that does not exist there.
  {
    platform: "instagram",
    confirmed: true,
    label: "Instagram",
    handle: HANDLE,
    url: `https://www.instagram.com/${HANDLE}/`,
    settingsKey: "instagram_url",
    inFooter: true,
    inVideoOutro: true,
  },
  {
    platform: "facebook",
    confirmed: true,
    label: "Facebook",
    handle: HANDLE,
    url: `https://www.facebook.com/${HANDLE}/`,
    settingsKey: "facebook_url",
    inFooter: true,
    inVideoOutro: true,
  },
  {
    platform: "threads",
    confirmed: true,
    label: "Threads",
    handle: HANDLE,
    // threads.com, not threads.net — the live account is on the .com domain.
    url: `https://www.threads.com/@${HANDLE}`,
    settingsKey: "threads_url",
    inFooter: true,
    inVideoOutro: true,
  },
  {
    platform: "pinterest",
    confirmed: true,
    label: "Pinterest",
    handle: HANDLE,
    // The regional in.pinterest.com host, which is where the account actually resolves.
    url: `https://in.pinterest.com/${HANDLE}/`,
    settingsKey: "pinterest_url",
    inFooter: true,
    inVideoOutro: true,
  },

  // -- Everything below is on the shared handle in spirit but not in the URL.
  {
    platform: "youtube",
    confirmed: true,
    label: "YouTube",
    // CamelCase as the channel is actually registered.
    handle: "JapaneseWithAvnish",
    url: "https://www.youtube.com/@JapaneseWithAvnish",
    settingsKey: "youtube_url",
    inFooter: true,
    // Kept off the outro: YouTube is where the long-form video already lives, so asking a
    // YouTube viewer to follow on YouTube is a wasted line.
    inVideoOutro: false,
  },
  {
    platform: "x",
    confirmed: true,
    label: "X",
    // NOT the brand handle. Kept off the video outro for that reason — see the note above.
    handle: "learnjpnavnish",
    url: "https://x.com/learnjpnavnish",
    settingsKey: "twitter_url",
    inFooter: true,
    inVideoOutro: false,
  },
  {
    platform: "reddit",
    confirmed: true,
    label: "Reddit",
    // A personal account, not a brand one — which is the right way to use Reddit, and another
    // reason auto-posting there stays off.
    handle: "Ok-Struggle1432",
    url: "https://www.reddit.com/user/Ok-Struggle1432/",
    settingsKey: "reddit_url",
    inFooter: false,
    inVideoOutro: false,
  },

  // -- No account confirmed yet. Present so the social engine can generate copy for them, but
  //    not linked anywhere on the site: a footer icon pointing at a profile that does not exist
  //    is worse than no icon.
  {
    platform: "linkedin",
    confirmed: false,
    label: "LinkedIn",
    handle: HANDLE,
    url: `https://www.linkedin.com/company/${HANDLE}/`,
    settingsKey: "linkedin_url",
    inFooter: false,
    inVideoOutro: false,
  },
  {
    platform: "tiktok",
    confirmed: false,
    label: "TikTok",
    handle: HANDLE,
    url: `https://www.tiktok.com/@${HANDLE}`,
    settingsKey: "tiktok_url",
    inFooter: false,
    inVideoOutro: false,
  },
] as const;

/** Every `site_settings` key the socials can be overridden by — for the one SELECT the footer runs. */
export const SOCIAL_SETTINGS_KEYS: readonly string[] = SOCIALS.map((s) => s.settingsKey);

/**
 * Merges `site_settings` overrides over the defaults.
 *
 * A blank string in the DB means "not set" rather than "hide this", because every one of those rows
 * is seeded as `''` — treating empty as an override would silently blank the whole footer.
 */
export function resolveSocials(
  settings: Record<string, string | undefined> = {},
  filter?: (account: SocialAccount) => boolean
): SocialAccount[] {
  return SOCIALS.filter((account) => (filter ? filter(account) : true)).map((account) => {
    const override = settings[account.settingsKey]?.trim();
    return override ? { ...account, url: override } : account;
  });
}

/** Profile URLs for schema.org `sameAs`. Order is stable so the emitted JSON-LD doesn't churn. */
export function sameAsUrls(settings: Record<string, string | undefined> = {}): string[] {
  // Confirmed AND linked from the site.
  //
  // Two separate reasons. Declaring a profile that does not exist is a negative signal, and
  // search engines do check. And `sameAs` is meant to corroborate the organisation's own
  // profiles — the Reddit account is a personal one used to answer questions like a person,
  // which is the correct way to use Reddit and the wrong thing to claim as a brand profile.
  return resolveSocials(settings, (a) => a.confirmed && a.inFooter).map((a) => a.url);
}

/**
 * Hashtag buckets from `docs/30-day-social-media-promotion-plan.md`.
 *
 * The doc's own rule: pick 3-6 per post and don't reuse the same stack every day. The social
 * generator enforces the count; the variety is the model's job.
 */
export const HASHTAGS = {
  brand: ["#JapaneseWithAvnish", "#LearnJapaneseTheRightWay"],
  jlpt: ["#JLPT", "#JLPTN5", "#JLPTN4", "#JLPTN3", "#JLPTN2", "#JLPTN1", "#JLPTPrep", "#JLPTStudy"],
  broad: ["#LearnJapanese", "#Japanese", "#JapaneseLanguage", "#StudyJapanese", "#Nihongo"],
  niche: ["#JapaneseVocabulary", "#KanjiStudy", "#JapaneseGrammar", "#Hiragana", "#Katakana"],
} as const;
