import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AiLogsClient } from "./AiLogsClient";

export default function AdminAiLogsPage() {
  return (
    <div>
      <AdminPageHeader
        title="AI generation log"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <p className="text-secondary text-sm mb-4">
        Prompt and result history for content generation, images, and blog summaries. Filter by content type or view all.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/ai-logs" className="text-sm px-3 py-1.5 rounded-bento bg-primary/10 text-primary font-medium">All</Link>
        <Link href="/admin/ai-logs?entityType=post" className="text-sm px-3 py-1.5 rounded-bento border border-[var(--divider)] hover:bg-[var(--base)]">Blogs</Link>
        <Link href="/admin/ai-logs?entityType=product" className="text-sm px-3 py-1.5 rounded-bento border border-[var(--divider)] hover:bg-[var(--base)]">Products</Link>
        <Link href="/admin/ai-logs?entityType=newsletter" className="text-sm px-3 py-1.5 rounded-bento border border-[var(--divider)] hover:bg-[var(--base)]">Newsletters</Link>
      </div>
      <AiLogsClient />
    </div>
  );
}
