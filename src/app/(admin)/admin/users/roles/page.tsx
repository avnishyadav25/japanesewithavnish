import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StaffRolesTable } from "./StaffRolesTable";

export default async function AdminStaffRolesPage() {
  let rows: { email: string; display_name: string | null; role: string }[] = [];

  if (sql) {
    try {
      rows = (await sql`
        SELECT email, display_name, role
        FROM profiles
        WHERE role IN ('admin', 'editor', 'support')
        ORDER BY role, email
      `) as typeof rows;
    } catch (e) {
      console.error("Admin staff roles:", e);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Staff & Roles"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Users" }, { label: "Staff & Roles" }]}
      />
      <p className="text-secondary text-sm -mt-2">
        Internal staff roles on user profiles. Note: this does not gate admin panel access — that is controlled separately via the <code className="bg-[var(--base)] px-1 rounded">ADMIN_EMAILS</code> environment variable.
      </p>
      {rows.length > 0 ? (
        <StaffRolesTable initial={rows} />
      ) : (
        <AdminEmptyState message="No profiles currently have an admin, editor, or support role." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
