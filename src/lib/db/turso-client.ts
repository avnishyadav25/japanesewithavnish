/** Minimal libsql HTTP (Hrana v2 pipeline) client — shared by the failover flag
 * reader/writer and db-backup.ts's existing Turso mirror writes. */

type TursoArgValue = string | number | boolean | null;

interface TursoCol {
  name: string;
}

interface TursoRowCell {
  type: string;
  value?: string | null;
}

interface TursoPipelineResult {
  type: string;
  response?: { result?: { cols: TursoCol[]; rows: TursoRowCell[][] } };
  error?: { message?: string };
}

export function tursoConfigured(): boolean {
  return Boolean(process.env.TURSO_DB_URL && process.env.TURSO_DB_AUTH_TOKEN);
}

function toArg(value: TursoArgValue): { type: "text" | "integer" | "null"; value?: string } {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
  if (typeof value === "number" && Number.isInteger(value)) return { type: "integer", value: String(value) };
  return { type: "text", value: String(value) };
}

/** Runs one statement (SELECT or write) against Turso and returns rows as plain objects. */
export async function tursoExecute(sql: string, args: TursoArgValue[] = []): Promise<Record<string, string | null>[]> {
  const dbUrl = process.env.TURSO_DB_URL;
  const token = process.env.TURSO_DB_AUTH_TOKEN;
  if (!dbUrl || !token) throw new Error("Turso not configured");
  const httpUrl = dbUrl.replace(/^libsql:\/\//, "https://");

  const res = await fetch(`${httpUrl}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql, args: args.map(toArg) } }, { type: "close" }],
    }),
  });
  if (!res.ok) throw new Error(`Turso execute ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as { results: TursoPipelineResult[] };
  const result = data.results?.[0];
  if (!result || result.type === "error") {
    throw new Error(result?.error?.message ?? "Unknown Turso error");
  }

  const resultSet = result.response?.result;
  const cols = (resultSet?.cols ?? []).map((c) => c.name);
  const rows = resultSet?.rows ?? [];
  return rows.map((row) => Object.fromEntries(cols.map((col, i) => [col, row[i]?.value ?? null])));
}
