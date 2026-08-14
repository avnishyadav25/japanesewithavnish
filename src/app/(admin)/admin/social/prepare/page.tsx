import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SocialPrepareForm } from "../SocialPrepareForm";

export default function AdminSocialPreparePage() {
  return (
    <div className="[&_h1]:text-3xl">
      <AdminPageHeader
        title="Prepare for social"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Social packs", href: "/admin/social" },
        ]}
      />
      <p className="text-secondary text-base mb-6">
        Generate full social content packs for blogs, products, or newsletters. You can reuse and refine saved packs,
        regenerate images, and copy captions for each platform.
      </p>
      <Suspense fallback={<p className="text-secondary text-sm">Loading…</p>}>
        <SocialPrepareForm />
      </Suspense>
    </div>
  );
}

