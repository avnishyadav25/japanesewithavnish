import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { clampTitle, clampDescription, canonicalUrl } from "@/lib/seo";
import { BreadcrumbListSchema, CourseSchema } from "@/components/JsonLd";

const LEVEL_CODES = ["n5", "n4", "n3", "n2", "n1"] as const;

export function generateStaticParams() {
  return LEVEL_CODES.map((level) => ({ level }));
}

type LevelRow = { id: string; code: string; name: string; description: string | null };
type ModuleRow = { id: string; code: string; title: string; description: string | null };
type SubmoduleRow = { id: string; module_id: string; code: string; title: string; description: string | null };
type LessonRow = { id: string; submodule_id: string; title: string; goal: string | null; estimated_minutes: number | null };

async function getLevelOutline(levelCode: string) {
  if (!sql) return null;
  const levels = (await sql`SELECT id, code, name, description FROM curriculum_levels WHERE LOWER(code) = ${levelCode}`) as LevelRow[];
  const level = levels[0];
  if (!level) return null;

  const modules = (await sql`
    SELECT id, code, title, description FROM curriculum_modules WHERE level_id = ${level.id} ORDER BY sort_order, code
  `) as ModuleRow[];
  const moduleIds = modules.map((m) => m.id);
  if (moduleIds.length === 0) return { level, modules: [] as (ModuleRow & { submodules: (SubmoduleRow & { lessons: LessonRow[] })[] })[] };

  const submodules = (await sql`
    SELECT id, module_id, code, title, description FROM curriculum_submodules WHERE module_id = ANY(${moduleIds}) ORDER BY sort_order, code
  `) as SubmoduleRow[];
  const submoduleIds = submodules.map((s) => s.id);

  const lessons = submoduleIds.length
    ? ((await sql`
        SELECT id, submodule_id, title, goal, estimated_minutes FROM curriculum_lessons WHERE submodule_id = ANY(${submoduleIds}) ORDER BY sort_order, code
      `) as LessonRow[])
    : [];

  const lessonsBySubmodule = new Map<string, LessonRow[]>();
  for (const l of lessons) {
    const list = lessonsBySubmodule.get(l.submodule_id) ?? [];
    list.push(l);
    lessonsBySubmodule.set(l.submodule_id, list);
  }
  const submodulesByModule = new Map<string, (SubmoduleRow & { lessons: LessonRow[] })[]>();
  for (const s of submodules) {
    const list = submodulesByModule.get(s.module_id) ?? [];
    list.push({ ...s, lessons: lessonsBySubmodule.get(s.id) ?? [] });
    submodulesByModule.set(s.module_id, list);
  }

  return {
    level,
    modules: modules.map((m) => ({ ...m, submodules: submodulesByModule.get(m.id) ?? [] })),
    totalLessons: lessons.length,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }) {
  const { level: levelParam } = await params;
  const levelCode = levelParam.toLowerCase();
  if (!LEVEL_CODES.includes(levelCode as (typeof LEVEL_CODES)[number])) return {};
  const data = await getLevelOutline(levelCode);
  if (!data) return {};

  const title = clampTitle(`JLPT ${data.level.code} Curriculum Outline | Japanese with Avnish`);
  const description = clampDescription(
    data.level.description ||
      `Browse the full JLPT ${data.level.code} curriculum: every module, submodule, and lesson in the structured learning path.`
  );
  const path = `/learn/curriculum/${levelCode}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: canonicalUrl(path), type: "website", images: ["/og-default.png"] },
  };
}

export default async function CurriculumLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level: levelParam } = await params;
  const levelCode = levelParam.toLowerCase();
  if (!LEVEL_CODES.includes(levelCode as (typeof LEVEL_CODES)[number])) notFound();

  const data = await getLevelOutline(levelCode);
  if (!data) notFound();

  const path = `/learn/curriculum/${levelCode}`;
  const pageUrl = canonicalUrl(path);
  const courseDescription =
    data.level.description || `The structured JLPT ${data.level.code} curriculum from Japanese with Avnish.`;

  return (
    <div className="min-h-screen bg-[var(--base)] py-12 px-4">
      <CourseSchema
        name={`JLPT ${data.level.code} Curriculum`}
        description={courseDescription}
        url={pageUrl}
        numberOfLessons={data.totalLessons}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: canonicalUrl("/") },
          { name: "Curriculum", url: canonicalUrl("/learn/curriculum") },
          { name: data.level.code, url: pageUrl },
        ]}
      />
      <div className="max-w-[900px] mx-auto">
        <nav className="text-sm text-secondary mb-6">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/learn/curriculum" className="hover:text-primary">Curriculum</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{data.level.code}</span>
        </nav>

        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">
          JLPT {data.level.code} Curriculum Outline
        </h1>
        <p className="text-secondary mb-8 max-w-2xl">{courseDescription}</p>

        <div className="space-y-6">
          {data.modules.map((mod) => (
            <section key={mod.id} className="rounded-2xl border border-[var(--divider)] bg-white p-6">
              <h2 className="font-heading text-xl font-bold text-charcoal mb-1">{mod.title}</h2>
              {mod.description && <p className="text-secondary text-sm mb-4">{mod.description}</p>}
              <div className="space-y-4">
                {mod.submodules.map((sub) => (
                  <div key={sub.id}>
                    <h3 className="font-heading font-semibold text-charcoal text-sm mb-2">{sub.title}</h3>
                    <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 list-disc list-inside">
                      {sub.lessons.map((lesson) => (
                        <li key={lesson.id} className="text-secondary text-sm">
                          {lesson.title}
                          {lesson.estimated_minutes ? ` (${lesson.estimated_minutes} min)` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <p className="text-secondary mb-4">
            This is the full lesson outline for JLPT {data.level.code}. Sign up free to start the structured path
            with practice questions, audio, and progress tracking.
          </p>
          <Link href="/start-here" className="btn-primary inline-block">
            Start Learning →
          </Link>
        </div>
      </div>
    </div>
  );
}
