import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CurriculumAdminClient } from "./CurriculumAdminClient";

export default function AdminCurriculumPage() {
  return (
    <div>
      <AdminPageHeader
        title="Curriculum"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Learning Content" }, { label: "Curriculum" }]}
      />
      <p className="text-sm text-secondary mb-4">
        Manage levels → modules → submodules → lessons. Run <code className="bg-[var(--divider)] px-1 rounded">npm run seed:curriculum</code> once to seed N5 and achievements.
      </p>
      <CurriculumAdminClient />
    </div>
  );
}
