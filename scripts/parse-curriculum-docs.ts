/**
 * Parse curriculum markdown docs (N5–N1) into JSON per level.
 * Output: { levelCode, modules: [ { code, title, submodules: [ { code, title, lessons: [ { code, title, goal, introduction } ] } ] } ] }
 * Run: npx tsx scripts/parse-curriculum-docs.ts
 */
import * as fs from "fs";
import * as path from "path";

const DOCS_DIR = path.join(process.cwd(), "docs");
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

export interface LessonParsed {
  code: string;
  title: string;
  goal: string | null;
  introduction: string | null;
}

export interface SubmoduleParsed {
  code: string;
  title: string;
  lessons: LessonParsed[];
}

export interface ModuleParsed {
  code: string;
  title: string;
  submodules: SubmoduleParsed[];
}

export interface LevelParsed {
  levelCode: string;
  modules: ModuleParsed[];
}

// ## Module N: Title  -> code = N (string), title
const MODULE_RE = /^## Module (\d+):\s*(.+)$/;
// ### Submodule N.M: Title
const SUBMODULE_RE = /^### Submodule ([\d.]+):\s*(.+)$/;
// #### Lesson N.M.P: Title
const LESSON_RE = /^#### Lesson ([\d.]+):\s*(.+)$/;
// **Goal:** ... (until next ** or end of block)
// Note: avoid `/s` (dotAll) for older TS targets; use [\s\S] instead.
const GOAL_RE = /\*\*Goal:\*\*\s*([\s\S]+?)(?=\n\*\*|\n\n\n|$)/;
// **Student-facing introduction:** optional newline then quoted or plain text
const INTRO_RE = /\*\*Student-facing introduction:\*\*\s*(?:\n\s*)?(?:"([^"]*)"|([^\n*]+(?:\n(?!\*\*)[^\n*]*)*))/;

function extractGoal(block: string): string | null {
  const m = block.match(GOAL_RE);
  if (!m) return null;
  return m[1].replace(/\n+/g, " ").trim() || null;
}

function extractIntroduction(block: string): string | null {
  const m = block.match(INTRO_RE);
  if (!m) return null;
  const quoted = m[1];
  if (quoted !== undefined) return quoted.trim() || null;
  const plain = m[2];
  return (plain && plain.replace(/\n+/g, " ").trim()) || null;
}

function parseLessonBlock(block: string, code: string, title: string): LessonParsed {
  const goal = extractGoal(block);
  const introduction = extractIntroduction(block);
  return { code, title, goal, introduction };
}

export function parseLevelDoc(content: string): LevelParsed["modules"] {
  const modules: ModuleParsed[] = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const modMatch = lines[i].match(MODULE_RE);
    if (modMatch) {
      const modCode = modMatch[1];
      const modTitle = modMatch[2].trim();
      const submodules: SubmoduleParsed[] = [];
      i++;
      while (i < lines.length && !lines[i].match(MODULE_RE)) {
        const subMatch = lines[i].match(SUBMODULE_RE);
        if (subMatch) {
          const subCode = subMatch[1];
          const subTitle = subMatch[2].trim();
          const lessons: LessonParsed[] = [];
          i++;
          let lessonBlock = "";
          let lessonCode = "";
          let lessonTitle = "";
          while (i < lines.length && !lines[i].match(SUBMODULE_RE) && !lines[i].match(MODULE_RE)) {
            const lessMatch = lines[i].match(LESSON_RE);
            if (lessMatch) {
              if (lessonCode) {
                lessons.push(parseLessonBlock(lessonBlock, lessonCode, lessonTitle));
              }
              lessonCode = lessMatch[1];
              lessonTitle = lessMatch[2].trim();
              lessonBlock = "";
              i++;
              continue;
            }
            lessonBlock += (lessonBlock ? "\n" : "") + lines[i];
            i++;
          }
          if (lessonCode) {
            lessons.push(parseLessonBlock(lessonBlock, lessonCode, lessonTitle));
          }
          submodules.push({ code: subCode, title: subTitle, lessons });
          continue;
        }
        i++;
      }
      modules.push({ code: modCode, title: modTitle, submodules });
      continue;
    }
    i++;
  }
  return modules;
}

function parseFile(filePath: string): LevelParsed | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  const levelCode = path.basename(filePath).replace(/^curriculum-(n)(\d)-lessons\.md$/i, (_, n, d) => (n + d).toUpperCase());
  const modules = parseLevelDoc(content);
  if (modules.length === 0) return null;
  return { levelCode, modules };
}

function main() {
  const out: LevelParsed[] = [];
  for (const level of LEVELS) {
    const file = path.join(DOCS_DIR, `curriculum-${level.toLowerCase()}-lessons.md`);
    const parsed = parseFile(file);
    if (parsed) {
      out.push(parsed);
      console.error(`Parsed ${level}: ${parsed.modules.length} modules`);
    } else {
      console.error(`Skip ${level}: file missing or empty`);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
