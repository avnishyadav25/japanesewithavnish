/**
 * Labels that should be rendered in bold when they appear at the start of a line in lesson content.
 * Edit this array to add/remove labels; order longer phrases first so they match before shorter ones.
 */
export const CONTENT_LABELS_TO_BOLD = [
  "Meaning (simple English):",
  "When you use it:",
  "Correct answer:",
  "Question 2:",
  "Question 3:",
  "Japanese:",
  "Romaji:",
  "Structure:",
  "Example:",
  "English:",
  "Sakura 🌸:",
  "Kenji 🐼:",
  "❌ Incorrect:",
  "✔ Correct:",
  "Question:",
  "Options:",
  "Explanation:",
] as const;

/**
 * Wraps line-start labels from CONTENT_LABELS_TO_BOLD in markdown bold (**label**).
 * Apply to lesson content before rendering so labels are bold; keep CONTENT_LABELS_TO_BOLD updated for new labels.
 */
export function boldContentLabels(content: string): string {
  if (!content?.length) return content;
  const labels = [...CONTENT_LABELS_TO_BOLD].sort((a, b) => b.length - a.length);
  const lines = content.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const trimmedStart = line.trimStart();
    const leadingWs = line.slice(0, line.length - trimmedStart.length);
    let replaced = false;
    for (const label of labels) {
      if (trimmedStart.startsWith(label)) {
        out.push(leadingWs + "**" + label + "**" + trimmedStart.slice(label.length));
        replaced = true;
        break;
      }
    }
    if (!replaced) out.push(line);
  }
  return out.join("\n");
}

/**
 * Reorder markdown so sections with "Example" (or 例) in the heading come at the end.
 * Splits by ## heading, classifies each block, returns main blocks first then example blocks.
 */
export function reorderContentExamplesLast(markdown: string): string {
  if (!markdown?.trim()) return markdown;
  const sections = markdown.split(/\n(?=## )/);
  const main: string[] = [];
  const examples: string[] = [];
  const isExample = (h: string) => /example|例文|例\s*\d|例\s*$/i.test(h.trim());
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i].trim();
    if (!s) continue;
    if (!s.startsWith("## ")) {
      main.push(s);
      continue;
    }
    const firstLineEnd = s.indexOf("\n");
    const heading = firstLineEnd >= 0 ? s.slice(3, firstLineEnd).trim() : s.slice(3).trim();
    if (isExample(heading)) examples.push(s);
    else main.push(s);
  }
  return [...main, ...examples].join("\n\n");
}
