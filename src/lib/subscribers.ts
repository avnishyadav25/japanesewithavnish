import { sql } from "@/lib/db";

/** Add or update a subscriber (e.g. after purchase). Uses Neon subscribers table. */
export async function addToSubscribers(
  email: string,
  options?: { name?: string | null; source?: string }
) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;
  if (!sql) return;
  const nameVal = options?.name && typeof options.name === "string" ? options.name.trim() : null;
  const sourceVal = options?.source ?? "purchase";
  await sql`
    INSERT INTO subscribers (email, name, source)
    VALUES (${trimmed}, ${nameVal}, ${sourceVal})
    ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, subscribers.name), source = EXCLUDED.source
  `;
}
