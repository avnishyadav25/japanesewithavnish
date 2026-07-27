import { SignJWT, importPKCS8 } from "jose";
import { sql } from "@/lib/db";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ORDERS_BATCH_SIZE = 500;

export function sheetsExportConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SHEET_ID
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) throw new Error("Google Sheets service account not configured");

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token;

  // Service-account private keys stored in env vars typically have literal "\n" escapes.
  const privateKey = await importPKCS8(rawKey.replace(/\\n/g, "\n"), "RS256");
  const jwt = await new SignJWT({ scope: SHEETS_SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.token;
}

async function appendRows(tab: string, rows: unknown[][]): Promise<void> {
  if (rows.length === 0) return;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const token = await getAccessToken();
  const range = encodeURIComponent(`${tab}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) throw new Error(`Sheets append failed (${tab}): ${res.status} ${(await res.text()).slice(0, 300)}`);
}

async function getCursor(tab: string): Promise<string | null> {
  if (!sql) return null;
  await sql`INSERT INTO sheets_export_state (tab_name) VALUES (${tab}) ON CONFLICT (tab_name) DO NOTHING`;
  const rows = await sql`SELECT last_cursor_value FROM sheets_export_state WHERE tab_name = ${tab}`;
  return (rows[0]?.last_cursor_value as string) ?? null;
}

async function advanceCursor(tab: string, cursorValue: string, rowsExported: number): Promise<void> {
  if (!sql) return;
  await sql`
    UPDATE sheets_export_state
    SET last_cursor_value = ${cursorValue}, last_exported_at = NOW(),
        rows_exported_total = rows_exported_total + ${rowsExported}, last_error = NULL
    WHERE tab_name = ${tab}
  `;
}

async function recordError(tab: string, error: string): Promise<void> {
  if (!sql) return;
  await sql`UPDATE sheets_export_state SET last_error = ${error} WHERE tab_name = ${tab}`.catch(() => undefined);
}

/** Appends any orders created since the last export cursor. Header row is written once
 * the sheet is empty; subsequent calls only append new rows (incremental, not a
 * full re-export). */
async function exportOrders(): Promise<{ rowsExported: number }> {
  if (!sql) return { rowsExported: 0 };
  const tab = "Orders";
  try {
    const cursor = await getCursor(tab);
    const rows = cursor
      ? await sql`
          SELECT id, user_email, status, total_amount_paise, coupon_code, created_at
          FROM orders WHERE created_at > ${cursor} ORDER BY created_at LIMIT ${ORDERS_BATCH_SIZE}
        `
      : await sql`
          SELECT id, user_email, status, total_amount_paise, coupon_code, created_at
          FROM orders ORDER BY created_at LIMIT ${ORDERS_BATCH_SIZE}
        `;

    if (rows.length === 0) return { rowsExported: 0 };

    if (!cursor) {
      await appendRows(tab, [["Order ID", "Email", "Status", "Amount (paise)", "Coupon", "Created at"]]);
    }
    await appendRows(
      tab,
      rows.map((r) => [r.id, r.user_email, r.status, r.total_amount_paise, r.coupon_code ?? "", new Date(r.created_at).toISOString()])
    );

    const last = rows[rows.length - 1];
    await advanceCursor(tab, new Date(last.created_at).toISOString(), rows.length);
    return { rowsExported: rows.length };
  } catch (e) {
    await recordError(tab, e instanceof Error ? e.message : "Unknown Sheets export error");
    throw e;
  }
}

/** Appends a fresh, timestamped leaderboard snapshot (rank is derived, not stored — this
 * exports a computed ranking each run, not raw transaction rows). */
async function exportLeaderboardSnapshot(): Promise<{ rowsExported: number }> {
  if (!sql) return { rowsExported: 0 };
  const tab = "Leaderboard";
  try {
    const rows = await sql`
      SELECT user_email, SUM(xp_amount) AS total_xp
      FROM xp_transactions
      GROUP BY user_email
      ORDER BY total_xp DESC
      LIMIT 50
    `;
    if (rows.length === 0) return { rowsExported: 0 };

    const snapshotAt = new Date().toISOString();
    await appendRows(tab, [[`Snapshot: ${snapshotAt}`, "", ""], ["Rank", "Email", "Total XP"]]);
    await appendRows(
      tab,
      rows.map((r, i) => [i + 1, r.user_email, r.total_xp])
    );
    await advanceCursor(tab, snapshotAt, rows.length);
    return { rowsExported: rows.length };
  } catch (e) {
    await recordError(tab, e instanceof Error ? e.message : "Unknown Sheets export error");
    throw e;
  }
}

export async function runSheetsExport(): Promise<{ orders: { rowsExported: number }; leaderboard: { rowsExported: number } }> {
  if (!sheetsExportConfigured()) throw new Error("Google Sheets export not configured");
  const [orders, leaderboard] = await Promise.all([exportOrders(), exportLeaderboardSnapshot()]);
  return { orders, leaderboard };
}
