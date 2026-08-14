/**
 * Lightweight validation for JSON arrays/objects returned by AI curriculum-generation
 * prompts. Drops items missing required fields instead of silently coercing them to
 * empty strings, so malformed AI output doesn't end up stored as blank content.
 */

export function filterValidItems<T extends Record<string, string>>(
  arr: unknown[],
  requiredFields: (keyof T & string)[],
  allFields: (keyof T & string)[]
): { items: T[]; droppedCount: number } {
  const items: T[] = [];
  let droppedCount = 0;
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") {
      droppedCount++;
      continue;
    }
    const obj = raw as Record<string, unknown>;
    const missingRequired = requiredFields.some((f) => typeof obj[f] !== "string" || !(obj[f] as string).trim());
    if (missingRequired) {
      droppedCount++;
      continue;
    }
    const item = {} as T;
    for (const f of allFields) {
      item[f] = (typeof obj[f] === "string" ? (obj[f] as string).trim() : "") as T[typeof f];
    }
    items.push(item);
  }
  return { items, droppedCount };
}

/** Validates a single JSON object has all required non-empty string fields. */
export function validateRequiredFields(obj: unknown, requiredFields: string[]): string[] {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") return ["response is not a JSON object"];
  const rec = obj as Record<string, unknown>;
  for (const f of requiredFields) {
    if (typeof rec[f] !== "string" || !(rec[f] as string).trim()) {
      errors.push(`${f} is required`);
    }
  }
  return errors;
}
