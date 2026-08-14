import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ids } = body as { action?: string; ids?: string[] };
    if (action !== "delete" && action !== "update") {
      return NextResponse.json({ error: "Action must be delete or update" }, { status: 400 });
    }
    const orderIds = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
    if (orderIds.length === 0) {
      return NextResponse.json({ error: "No order IDs provided" }, { status: 400 });
    }

    if (action === "delete") {
      for (const id of orderIds) {
        await sql`DELETE FROM order_items WHERE order_id = ${id}`;
        await sql`DELETE FROM payments WHERE order_id = ${id}`;
        await sql`DELETE FROM orders WHERE id = ${id}`;
      }
      return NextResponse.json({ success: true, deleted: orderIds.length });
    }

    // action === "update" — optional status update
    const { status: newStatus } = body as { status?: string };
    if (typeof newStatus === "string" && ["created", "pending_payment", "paid", "failed"].includes(newStatus)) {
      await sql`UPDATE orders SET status = ${newStatus}, updated_at = NOW() WHERE id = ANY(${orderIds})`;
      return NextResponse.json({ success: true, updated: orderIds.length });
    }
    return NextResponse.json({ error: "Valid status required for update" }, { status: 400 });
  } catch (e) {
    console.error("Bulk orders:", e);
    return NextResponse.json({ error: "Bulk action failed" }, { status: 500 });
  }
}
