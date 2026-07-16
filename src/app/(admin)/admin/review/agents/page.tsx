import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AgentRow } from "./AgentRow";

type Agent = {
  agent_key: string;
  name: string;
  description: string | null;
  scope: string[];
  model_name: string;
  temperature: number;
  is_deterministic: boolean;
  is_enabled: boolean;
  prompt_key: string;
};

export default async function AgentConfigurationPage() {
  const agents = sql ? ((await sql`SELECT * FROM content_review_agents ORDER BY sort_order`) as Agent[]) : [];

  return (
    <div>
      <AdminPageHeader title="Agent Configuration" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]} />
      <p className="text-sm text-secondary mb-4">
        Toggle agents on/off, change model/temperature, and adjust which content types each one runs for. Prompt text itself is edited via{" "}
        <a href="/admin/prompts" className="text-primary hover:underline">
          AI Prompts
        </a>
        .
      </p>
      <AdminCard>
        <AdminTable headers={["Agent", "Status", "Model", "Temp", "Scope", "Prompt", ""]}>
          {agents.map((a) => (
            <AgentRow key={a.agent_key} agent={a} />
          ))}
        </AdminTable>
      </AdminCard>
    </div>
  );
}
