import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { REVIEW_ENTITY_TYPES } from "@/lib/contentReview/types";
import { PolicyRow } from "./PolicyRow";

export default async function ReviewPoliciesPage() {
  const rows = sql ? ((await sql`SELECT content_type, required_fields FROM content_review_policies`) as { content_type: string; required_fields: string[] }[]) : [];
  const byType = new Map(rows.map((r) => [r.content_type, r.required_fields]));

  return (
    <div>
      <AdminPageHeader title="Review Policies" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]} />
      <p className="text-sm text-secondary mb-4">
        Required fields per content type — a blank required field on any entry hard-fails its review before any AI agent runs (zero LLM cost).
        Field names must match the actual sidecar table columns (e.g. <code className="bg-base px-1 rounded">word</code>,{" "}
        <code className="bg-base px-1 rounded">reading</code>, <code className="bg-base px-1 rounded">meaning</code> for vocabulary).
      </p>
      <AdminCard>
        <AdminTable headers={["Content Type", "Required Fields", ""]}>
          {REVIEW_ENTITY_TYPES.map((t) => (
            <PolicyRow key={t} contentType={t} requiredFields={byType.get(t) ?? []} />
          ))}
        </AdminTable>
      </AdminCard>
    </div>
  );
}
