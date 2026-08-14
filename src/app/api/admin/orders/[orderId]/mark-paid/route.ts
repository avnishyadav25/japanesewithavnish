import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { fulfillOrder } from "@/lib/order-fulfillment";
import { sql } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  if (!orderId) return NextResponse.json({ error: "Order ID required" }, { status: 400 });

  if (!sql) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const rows = await sql`
    SELECT id, status, provider FROM orders WHERE id = ${orderId} LIMIT 1
  ` as { id: string; status: string; provider: string }[];
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "pending_payment") {
    return NextResponse.json({ error: "Order is not pending payment" }, { status: 400 });
  }
  if (order.provider !== "manual") {
    return NextResponse.json({ error: "Only manual UPI orders can be marked paid here" }, { status: 400 });
  }

  try {
    await fulfillOrder(orderId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Mark as paid:", e);
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }
}
