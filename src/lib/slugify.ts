export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * A slug that is not already taken.
 *
 * `posts.slug` is UNIQUE, and `slugify()` has no collision handling — so two posts titled
 * "N5 vocabulary" produce the same slug and the second insert fails with a 23505 that surfaces
 * to the user as "Slug already exists". That is fine when a human is typing a title and can pick
 * another; it is not fine for generated content, where the caller has no better name to offer.
 *
 * Appends -2, -3, … and gives up after `maxAttempts` rather than looping forever against a
 * database that is refusing writes for some other reason.
 *
 * `exists` is injected so this stays free of a DB import and testable.
 */
export async function uniqueSlug(
  text: string,
  exists: (slug: string) => Promise<boolean>,
  maxAttempts = 25
): Promise<string> {
  const base = slugify(text) || "post";
  if (!(await exists(base))) return base;

  for (let n = 2; n <= maxAttempts; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error(
    `Could not find a free slug for "${text}" after ${maxAttempts} attempts — ` +
      `either there are genuinely that many, or the uniqueness check is not working.`
  );
}
