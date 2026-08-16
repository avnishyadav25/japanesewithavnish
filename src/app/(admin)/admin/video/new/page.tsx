import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { NewVideoWizard } from "./NewVideoWizard";

export const dynamic = "force-dynamic";

/**
 * Read here rather than with useSearchParams in the client wizard: the deep links that produce
 * them come from the content plan's coverage table and its "what should I make next" popup, both
 * of which were silently ignored — the wizard always opened on vocabulary/N5/10 no matter which
 * gap you clicked. A server component already has the params, so the wizard just gets defaults.
 */
export default async function NewVideoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string): string | undefined => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  let themes: { key: string; label: string; description: string | null }[] = [];
  let bgm: { id: string; title: string; mood: string | null }[] = [];
  let levels: { id: string; code: string; name: string | null }[] = [];
  let lessons: { id: string; title: string; code: string; level_code: string }[] = [];

  if (sql) {
    [themes, bgm, levels, lessons] = await Promise.all([
      sql`SELECT key, label, description FROM video_themes WHERE is_enabled ORDER BY sort_order, label` as Promise<
        { key: string; label: string; description: string | null }[]
      >,
      sql`SELECT id, title, mood FROM video_bgm_tracks WHERE is_enabled ORDER BY title` as Promise<
        { id: string; title: string; mood: string | null }[]
      >,
      sql`SELECT id, code, name FROM curriculum_levels ORDER BY sort_order` as Promise<
        { id: string; code: string; name: string | null }[]
      >,
      sql`SELECT l.id, l.title, l.code, lv.code AS level_code
          FROM curriculum_lessons l
          JOIN curriculum_submodules sm ON sm.id = l.submodule_id
          JOIN curriculum_modules m ON m.id = sm.module_id
          JOIN curriculum_levels lv ON lv.id = m.level_id
          ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order
          LIMIT 500` as Promise<{ id: string; title: string; code: string; level_code: string }[]>,
    ]);
  }

  return (
    <div>
      <AdminPageHeader
        title="New video"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Video Studio", href: "/admin/video" },
          { label: "New" },
        ]}
      />
      <AdminCard>
        <NewVideoWizard
          themes={themes}
          bgmTracks={bgm}
          levels={levels}
          lessons={lessons}
          initial={{
            scopeKind: one("scopeKind"),
            contentType: one("contentType"),
            jlptLevel: one("jlptLevel"),
            topic: one("topic"),
          }}
        />
      </AdminCard>
    </div>
  );
}
