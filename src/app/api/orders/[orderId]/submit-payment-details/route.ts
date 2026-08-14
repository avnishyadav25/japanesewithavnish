import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const utrOrReference = typeof body.utrOrReference === "string" ? body.utrOrReference.trim() : undefined;
    const note = typeof body.note === "string" ? body.note.trim() : undefined;

    if (!sql) {
      return NextResponse.json({ error: "Unavailable" }, { status: 503 });
    }

    const rows = await sql`
      SELECT id, status, provider FROM orders WHERE id = ${orderId} LIMIT 1
    ` as { id: string; status: string; provider: string }[];
    const order = rows[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "pending_payment") {
      return NextResponse.json({ error: "Order not pending payment" }, { status: 400 });
    }

    await sql`
      UPDATE orders
      SET payment_reference = COALESCE(${utrOrReference ?? null}, payment_reference),
          payment_note = COALESCE(${note ?? null}, payment_note)
      WHERE id = ${orderId}
    `;

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Submit payment details:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
