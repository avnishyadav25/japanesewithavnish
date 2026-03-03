import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SocialPrepareForm } from "./SocialPrepareForm";

export default function AdminSocialPage() {
  return (
    <div>
      <AdminPageHeader
        title="Prepare for social"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <p className="text-secondary text-sm mb-6">
        Generate captions and hashtags for blog posts, products, or custom text. Copy and paste into Instagram, Twitter, LinkedIn, etc. Use the image generator on each blog/product edit page for the visual.
      </p>
      <SocialPrepareForm />
    </div>
  );
}
