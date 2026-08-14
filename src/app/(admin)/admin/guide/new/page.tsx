import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GuideSectionForm } from "@/components/admin/GuideSectionForm";

export default function AdminGuideNewPage() {
  return (
    <div>
      <AdminPageHeader
        title="Add guide section"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Site Guide", href: "/admin/guide" },
          { label: "New" },
        ]}
      />
      <GuideSectionForm />
    </div>
  );
}
