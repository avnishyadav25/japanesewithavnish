/** Map product slug → BUNDLE_*_DRIVE_URL env var for email/order access link */
const SLUG_TO_DRIVE_ENV: Record<string, string> = {
  "complete-japanese-n5-n1-mega-bundle": "BUNDLE_MEGA_DRIVE_URL",
  "japanese-n5-mastery-bundle": "BUNDLE_N5_DRIVE_URL",
  "japanese-n4-upgrade-bundle": "BUNDLE_N4_DRIVE_URL",
  "japanese-n3-power-bundle": "BUNDLE_N3_DRIVE_URL",
  "japanese-n2-pro-bundle": "BUNDLE_N2_DRIVE_URL",
  "japanese-n1-elite-bundle": "BUNDLE_N1_DRIVE_URL",
  "free-n5-pack": "BUNDLE_FREE_STARTER_KIT_DRIVE_URL",
  "free-n5-starter-kit": "BUNDLE_FREE_STARTER_KIT_DRIVE_URL",
};

export function getDriveUrlForSlug(slug: string): string | null {
  const envKey = SLUG_TO_DRIVE_ENV[slug];
  if (!envKey) return null;
  return process.env[envKey] || null;
}
