import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type UserRow = {
  email: string;
  recommended_level: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
  role: string | null;
  last_login_at: string | null;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  learned_count: number;
  xp: number;
  points: number;
  premium_until: string | null;
  is_lifetime: boolean;
  subscription_status: string | null;
  email_verified_at: string | null;
  verification_sent_at: string | null;
};

function isMissingVerificationColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42703"
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { plan?: string; status?: string; level?: string; q?: string; verified?: string };
}) {
  const planFilter = searchParams?.plan || "";
  const statusFilter = searchParams?.status || "";
  const levelFilter = searchParams?.level || "";
  const searchQuery = searchParams?.q || "";
  const verifiedFilter = searchParams?.verified || "";

  let users: UserRow[] = [];
  let total = 0;

  if (sql) {
    try {
      // Build conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (planFilter === "free") {
        conditions.push(`(p.is_lifetime = FALSE AND (p.premium_until IS NULL OR p.premium_until <= NOW()))`);
      } else if (planFilter === "premium") {
        conditions.push(`(p.is_lifetime = TRUE OR p.premium_until > NOW())`);
      } else if (planFilter === "trial") {
        conditions.push(`p.subscription_status = 'trialing'`);
      }

      if (statusFilter === "suspended") {
        conditions.push(`p.is_active = FALSE`);
      }

      if (levelFilter) {
        conditions.push(`p.recommended_level = $${paramIdx}`);
        params.push(levelFilter);
        paramIdx++;
      }

      if (verifiedFilter === "verified") {
        conditions.push(`ua.email_verified_at IS NOT NULL`);
      } else if (verifiedFilter === "unverified") {
        conditions.push(`ua.email IS NOT NULL AND ua.email_verified_at IS NULL`);
      }

      if (searchQuery) {
        conditions.push(`(p.email ILIKE $${paramIdx} OR p.display_name ILIKE $${paramIdx} OR p.first_name ILIKE $${paramIdx} OR p.last_name ILIKE $${paramIdx})`);
        params.push(`%${searchQuery}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countQuery = `SELECT COUNT(*)::int AS c FROM profiles p LEFT JOIN user_auth ua ON ua.email = p.email ${whereClause}`;
      const countResultArr = [countQuery, ...params];
      Object.defineProperty(countResultArr, "raw", { value: [countQuery] });
      const countRows = await sql(countResultArr as any) as { c: number }[];
      total = countRows[0]?.c ?? 0;

      const selectQuery = `
        SELECT
          p.email,
          p.recommended_level,
          p.display_name,
          p.first_name,
          p.last_name,
          p.is_active,
          p.role,
          p.last_login_at::text,
          COALESCE(p.current_streak, 0)::int AS current_streak,
          COALESCE(p.longest_streak, 0)::int AS longest_streak,
          p.last_activity_date::text,
          p.xp,
          p.points,
          p.premium_until::text,
          p.is_lifetime,
          p.subscription_status,
          ua.email_verified_at::text,
          ua.verification_sent_at::text,
          (SELECT COUNT(*)::int FROM user_learning_progress u WHERE u.user_email = p.email AND u.status = 'learned') AS learned_count
        FROM profiles p
        LEFT JOIN user_auth ua ON ua.email = p.email
        ${whereClause}
        ORDER BY p.last_activity_date DESC NULLS LAST, p.updated_at DESC
        LIMIT 100
      `;
      const selectResultArr = [selectQuery, ...params];
      Object.defineProperty(selectResultArr, "raw", { value: [selectQuery] });
      users = await sql(selectResultArr as any) as UserRow[];

    } catch (e) {
      if (isMissingVerificationColumnError(e)) {
        try {
          const conditions: string[] = [];
          const params: any[] = [];
          let paramIdx = 1;

          if (planFilter === "free") {
            conditions.push(`(p.is_lifetime = FALSE AND (p.premium_until IS NULL OR p.premium_until <= NOW()))`);
          } else if (planFilter === "premium") {
            conditions.push(`(p.is_lifetime = TRUE OR p.premium_until > NOW())`);
          } else if (planFilter === "trial") {
            conditions.push(`p.subscription_status = 'trialing'`);
          }

          if (statusFilter === "suspended") {
            conditions.push(`p.is_active = FALSE`);
          }

          if (levelFilter) {
            conditions.push(`p.recommended_level = $${paramIdx}`);
            params.push(levelFilter);
            paramIdx++;
          }

          if (searchQuery) {
            conditions.push(`(p.email ILIKE $${paramIdx} OR p.display_name ILIKE $${paramIdx} OR p.first_name ILIKE $${paramIdx} OR p.last_name ILIKE $${paramIdx})`);
            params.push(`%${searchQuery}%`);
            paramIdx++;
          }

          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
          const countQuery = `SELECT COUNT(*)::int AS c FROM profiles p ${whereClause}`;
          const countResultArr = [countQuery, ...params];
          Object.defineProperty(countResultArr, "raw", { value: [countQuery] });
          const countRows = await sql(countResultArr as any) as { c: number }[];
          total = countRows[0]?.c ?? 0;

          const selectQuery = `
            SELECT
              p.email,
              p.recommended_level,
              p.display_name,
              p.first_name,
              p.last_name,
              p.is_active,
              p.role,
              p.last_login_at::text,
              COALESCE(p.current_streak, 0)::int AS current_streak,
              COALESCE(p.longest_streak, 0)::int AS longest_streak,
              p.last_activity_date::text,
              p.xp,
              p.points,
              p.premium_until::text,
              p.is_lifetime,
              p.subscription_status,
              NULL::text AS email_verified_at,
              NULL::text AS verification_sent_at,
              (SELECT COUNT(*)::int FROM user_learning_progress u WHERE u.user_email = p.email AND u.status = 'learned') AS learned_count
            FROM profiles p
            ${whereClause}
            ORDER BY p.last_activity_date DESC NULLS LAST, p.updated_at DESC
            LIMIT 100
          `;
          const selectResultArr = [selectQuery, ...params];
          Object.defineProperty(selectResultArr, "raw", { value: [selectQuery] });
          users = await sql(selectResultArr as any) as UserRow[];
        } catch (fallbackError) {
          console.error("Admin users fallback query error:", fallbackError);
        }
      } else {
        console.error("Admin users query error:", e);
      }
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <AdminPageHeader
        title="User Management"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}
      />

      {/* Filter and Search Bar */}
      <AdminCard>
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Search User</label>
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Name or email..."
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Pass Plan</label>
            <select
              name="plan"
              defaultValue={planFilter}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white"
            >
              <option value="">All Tiers</option>
              <option value="free">Free Users</option>
              <option value="premium">Premium Users</option>
              <option value="trial">Trial Users</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Status</label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white"
            >
              <option value="">All Statuses</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Email</label>
            <select
              name="verified"
              defaultValue={verifiedFilter}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white"
            >
              <option value="">All Emails</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase text-secondary mb-1">JLPT Target</label>
              <select
                name="level"
                defaultValue={levelFilter}
                className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white"
              >
                <option value="">All Levels</option>
                <option value="N5">N5 (Beginner)</option>
                <option value="N4">N4 (Elementary)</option>
                <option value="N3">N3 (Intermediate)</option>
                <option value="N2">N2 (Upper)</option>
                <option value="N1">N1 (Advanced)</option>
              </select>
            </div>
            <button type="submit" className="btn-primary h-10 px-4 rounded-xl text-xs font-bold font-heading shrink-0">
              Apply Filters
            </button>
          </div>
        </form>
      </AdminCard>

      {users.length > 0 ? (
        <AdminCard>
          <AdminTable
            headers={[
              "User",
              "Plan",
              "Status",
              "Email",
              "Target Level",
              "Lessons",
              "Streak",
              "XP",
              "Last Active",
              "Action",
            ]}
          >
            {users.map((u) => {
              const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.display_name || "—";
              const isPremiumUser = u.is_lifetime || (u.premium_until && new Date(u.premium_until) > new Date());
              const isTrialUser = !isPremiumUser && u.subscription_status === "trialing";

              return (
                <tr key={u.email} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                  <td className="py-3 px-2">
                    <div className="font-semibold text-charcoal text-xs">{name}</div>
                    <div className="text-[10px] text-secondary">{u.email}</div>
                  </td>
                  <td className="py-3 px-2">
                    {isPremiumUser ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-[#C8A35F] text-[#C8A35F]">
                        {u.is_lifetime ? "Lifetime" : "Premium"}
                      </span>
                    ) : isTrialUser ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF8E8] text-[#C8A35F]">
                        Trial Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary">
                        Free Plan
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {u.is_active === false ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Suspended</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {u.email_verified_at ? (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Verified</span>
                        <p className="text-[9px] text-secondary">{new Date(u.email_verified_at).toLocaleDateString()}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Unverified</span>
                        <p className="text-[9px] text-secondary">
                          {u.verification_sent_at ? `Sent ${new Date(u.verification_sent_at).toLocaleDateString()}` : "No link sent"}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-xs font-semibold text-charcoal">{u.recommended_level || "—"}</td>
                  <td className="py-3 px-2 text-xs text-secondary">{u.learned_count} completed</td>
                  <td className="py-3 px-2 text-xs text-secondary">🔥 {u.current_streak} days</td>
                  <td className="py-3 px-2 text-xs font-bold text-primary">{u.xp} XP</td>
                  <td className="py-3 px-2 text-[10px] text-secondary">
                    {u.last_activity_date ? new Date(u.last_activity_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 px-2">
                    <Link
                      href={`/admin/users/${encodeURIComponent(u.email)}`}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      View Profile
                    </Link>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No matching users found." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
