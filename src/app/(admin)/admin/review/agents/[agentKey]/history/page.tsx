import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type VersionRow = {
  id: string;
  model_name: string;
  temperature: number;
  scope: string[];
  is_enabled: boolean;
  prompt_content: string | null;
  changed_by: string | null;
  created_at: string;
};

/** Gap-fix phase 18. Read-only history of every recorded configuration snapshot for one
 * agent — each row is a full snapshot (model/temperature/scope/enabled/prompt text) taken
 * whenever an admin changed any of those via Agent Configuration or the Prompts editor. */
export default async function AgentVersionHistoryPage({ params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  if (!sql) notFound();

  const agentRows = (await sql`SELECT agent_key, name FROM content_review_agents WHERE agent_key = ${agentKey}`) as { agent_key: string; name: string }[];
  const agent = agentRows[0];
  if (!agent) notFound();

  const versions = (await sql`
    SELECT id, model_name, temperature, scope, is_enabled, prompt_content, changed_by, created_at::text AS created_at
    FROM review_agent_versions
    WHERE agent_key = ${agentKey}
    ORDER BY created_at DESC
    LIMIT 100
  `) as VersionRow[];

  return (
    <div>
      <AdminPageHeader
        title={`${agent.name} — version history`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Content Review", href: "/admin/review" },
          { label: "Agent Configuration", href: "/admin/review/agents" },
        ]}
      />
      {versions.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["When", "Changed by", "Model", "Temp", "Scope", "Enabled", "Prompt preview"]}>
            {versions.map((v) => (
              <tr key={v.id} className="border-b border-[var(--divider)] align-top">
                <td className="py-2 px-2 text-xs text-secondary whitespace-nowrap">{new Date(v.created_at).toLocaleString()}</td>
                <td className="py-2 px-2 text-xs text-secondary">{v.changed_by ?? "—"}</td>
                <td className="py-2 px-2 text-xs text-charcoal">{v.model_name}</td>
                <td className="py-2 px-2 text-xs text-charcoal">{v.temperature}</td>
                <td className="py-2 px-2 text-xs text-secondary">{v.scope.length === 0 ? "all types" : v.scope.join(", ")}</td>
                <td className="py-2 px-2 text-xs text-secondary">{v.is_enabled ? "Yes" : "No"}</td>
                <td className="py-2 px-2 text-xs text-secondary max-w-xs truncate" title={v.prompt_content ?? undefined}>
                  {v.prompt_content ? `${v.prompt_content.slice(0, 80)}…` : "—"}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No configuration changes recorded yet for this agent — history is captured going forward, not backfilled." />
      )}
    </div>
  );
}
