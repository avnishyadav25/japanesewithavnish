import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

// The settings form previously here only pretended to save (no backing API).
// Hidden until /api/admin/newsletter-settings exists.
export default function AdminNewsletterSettingsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Newsletter Settings"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Newsletter" }]}
      />
      <AdminCard className="max-w-xl">
        <p className="text-sm text-charcoal">
          Newsletter settings are managed via environment variables for now
          (`EMAIL_FROM`, SMTP settings). A dedicated settings API is planned.
        </p>
      </AdminCard>
    </div>
  );
}
