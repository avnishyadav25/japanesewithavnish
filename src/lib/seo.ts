export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

/** Truncate a title to fit search-result display (Google clips ~60 chars) without cutting mid-word. */
export function clampTitle(title: string, maxLen = 60): string {
  const t = title.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Truncate a meta description to the ~155-160 char window search engines display. */
export function clampDescription(description: string, maxLen = 158): string {
  const d = description.trim();
  if (d.length <= maxLen) return d;
  const cut = d.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Absolute canonical URL for a given site-relative path (must start with "/"). */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
