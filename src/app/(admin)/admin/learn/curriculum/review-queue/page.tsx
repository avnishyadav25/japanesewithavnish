import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReviewQueueClient } from "./ReviewQueueClient";

export default function AdminReviewQueuePage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI Review Queue"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Curriculum" }, { label: "Review Queue" }]}
      />
      <p className="text-secondary text-sm -mt-2">
        AI-generated lesson content blocks awaiting review. Approve to publish on the student page, or reject to discard.
      </p>
      <ReviewQueueClient />
    </div>
  );
}
export const dynamic = "force-dynamic";
