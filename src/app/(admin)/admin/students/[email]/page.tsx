import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const email = decodeURIComponent((await params).email);
  if (!email) notFound();

  let row: Record<string, unknown> | null = null;
  if (sql) {
    const rows = await sql`
      SELECT
        p.email,
        p.recommended_level,
        p.display_name,
        p.first_name,
        p.last_name,
        p.is_active,
        p.last_login_at::text,
        p.avatar_url,
        p.address,
        p.phone,
        p.linkedin_url,
        p.instagram_url,
        p.facebook_url,
        p.twitter_url,
        p.website,
        p.current_streak,
        p.longest_streak,
        p.last_activity_date::text,
        p.created_at::text,
        p.updated_at::text,
        (SELECT COUNT(*)::int FROM user_learning_progress u WHERE u.user_email = p.email AND u.status = 'learned') AS learned_count,
        (SELECT COUNT(*)::int FROM review_schedule r WHERE r.user_email = p.email AND r.next_review_at <= NOW()) AS due_count,
        (SELECT COALESCE(SUM(e.points), 0)::int FROM reward_events e WHERE e.user_email = p.email) AS total_points
      FROM profiles p
      WHERE p.email = ${email}
      LIMIT 1
    ` as Record<string, unknown>[];
    row = rows?.[0] ?? null;
  }

  if (!row) notFound();

  const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || (row.display_name as string) || "—";
  const link = (url: unknown) => (url && typeof url === "string" ? url : null);

  return (
    <div>
      <AdminPageHeader
        title={name !== "—" ? name : email}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Students", href: "/admin/students" },
          { label: email },
        ]}
        action={{ label: "Edit", href: `/admin/students/${encodeURIComponent(email)}/edit` }}
      />
      <div className="grid gap-6 max-w-2xl">
        <AdminCard>
          <h2 className="font-heading font-semibold text-charcoal mb-3">Profile</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-secondary">Email</dt>
            <dd className="text-charcoal">{row.email as string}</dd>
            <dt className="text-secondary">First name</dt>
            <dd className="text-charcoal">{(row.first_name as string) || "—"}</dd>
            <dt className="text-secondary">Last name</dt>
            <dd className="text-charcoal">{(row.last_name as string) || "—"}</dd>
            <dt className="text-secondary">Display name</dt>
            <dd className="text-charcoal">{(row.display_name as string) || "—"}</dd>
            <dt className="text-secondary">Active</dt>
            <dd className="text-charcoal">{(row.is_active as boolean) !== false ? "Yes" : "No"}</dd>
            <dt className="text-secondary">Last login</dt>
            <dd className="text-charcoal">{row.last_login_at ? new Date(row.last_login_at as string).toLocaleString() : "—"}</dd>
            <dt className="text-secondary">Level</dt>
            <dd className="text-charcoal">{(row.recommended_level as string) || "—"}</dd>
            <dt className="text-secondary">Streak</dt>
            <dd className="text-charcoal">{Number(row.current_streak)} (best: {Number(row.longest_streak)})</dd>
            <dt className="text-secondary">Learned</dt>
            <dd className="text-charcoal">{Number(row.learned_count)}</dd>
            <dt className="text-secondary">Due</dt>
            <dd className="text-charcoal">{Number(row.due_count)}</dd>
            <dt className="text-secondary">Points</dt>
            <dd className="text-charcoal">{Number(row.total_points)}</dd>
          </dl>
        </AdminCard>
        <AdminCard>
          <h2 className="font-heading font-semibold text-charcoal mb-3">Contact & links</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-secondary">Address</dt>
            <dd className="text-charcoal">{(row.address as string) || "—"}</dd>
            <dt className="text-secondary">Phone</dt>
            <dd className="text-charcoal">{(row.phone as string) || "—"}</dd>
            <dt className="text-secondary">Website</dt>
            <dd className="text-charcoal">{link(row.website) ? <a href={link(row.website)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{row.website as string}</a> : "—"}</dd>
            <dt className="text-secondary">LinkedIn</dt>
            <dd className="text-charcoal">{link(row.linkedin_url) ? <a href={link(row.linkedin_url)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Link</a> : "—"}</dd>
            <dt className="text-secondary">Instagram</dt>
            <dd className="text-charcoal">{link(row.instagram_url) ? <a href={link(row.instagram_url)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Link</a> : "—"}</dd>
            <dt className="text-secondary">Facebook</dt>
            <dd className="text-charcoal">{link(row.facebook_url) ? <a href={link(row.facebook_url)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Link</a> : "—"}</dd>
            <dt className="text-secondary">Twitter</dt>
            <dd className="text-charcoal">{link(row.twitter_url) ? <a href={link(row.twitter_url)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Link</a> : "—"}</dd>
            <dt className="text-secondary">Avatar</dt>
            <dd className="text-charcoal">{link(row.avatar_url) ? <img src={row.avatar_url as string} alt="" className="w-12 h-12 rounded-full object-cover" /> : "—"}</dd>
          </dl>
        </AdminCard>
      </div>
    </div>
  );
}
