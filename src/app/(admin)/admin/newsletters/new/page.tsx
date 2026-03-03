import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NewsletterForm } from "../NewsletterForm";

export default function NewNewsletterPage() {
  return (
    <div>
      <AdminPageHeader
        title="New newsletter"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Newsletters", href: "/admin/newsletters" }]}
      />
      <NewsletterForm />
    </div>
  );
}
