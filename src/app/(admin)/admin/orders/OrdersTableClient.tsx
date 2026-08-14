"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ResendOrderEmailButton } from "@/components/admin/ResendOrderEmailButton";

type OrderRow = {
  id: string;
  user_email: string;
  status: string;
  total_amount_paise: number;
  created_at: string;
  last_confirmation_email_at?: string | null;
};

function statusVariant(s: string): "paid" | "pending" | "failed" | "created" {
  return s === "paid" ? "paid" : s === "pending_payment" || s === "created" ? "pending" : s === "failed" ? "failed" : "created";
}

export function OrdersTableClient({ orders }: { orders: OrderRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  };

  async function bulkDelete() {
    if (selected.size === 0) return;
    setBulkLoading(true);
    setBulkError("");
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      window.location.reload();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Bulk delete failed");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={toggleAll}
          className="text-secondary text-sm hover:text-primary"
        >
          {selected.size === orders.length ? "Deselect all" : "Select all"}
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-secondary text-sm">{selected.size} selected</span>
            <button
            type="button"
            onClick={bulkDelete}
            disabled={bulkLoading}
            className="px-3 py-1.5 rounded-bento text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {bulkLoading ? "Deleting…" : "Bulk delete"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 rounded-bento text-sm font-medium border border-[var(--divider)] text-secondary hover:text-charcoal"
          >
            Clear selection
          </button>
          {bulkError && <span className="text-primary text-sm">{bulkError}</span>}
          </>
        )}
      </div>
      <AdminTable headers={["", "Order", "Email", "Status", "Amount", "Date", "Actions"]}>
        {orders.map((o) => (
          <tr key={o.id} className="border-b border-[var(--divider)]">
            <td className="py-2 px-2 w-8">
              <input
                type="checkbox"
                checked={selected.has(o.id)}
                onChange={() => toggle(o.id)}
                className="rounded border-[var(--divider)]"
              />
            </td>
            <td className="py-2 px-2 font-mono text-xs">
              <Link href={`/admin/orders/${o.id}`} className="text-primary hover:underline">
                {o.id.slice(0, 8)}
              </Link>
            </td>
            <td className="py-2 px-2">{o.user_email}</td>
            <td className="py-2 px-2">
              <StatusBadge status={o.status} variant={statusVariant(o.status)} />
            </td>
            <td className="py-2 px-2">₹{Number(o.total_amount_paise) / 100}</td>
            <td className="py-2 px-2 text-secondary text-xs">
              {new Date(o.created_at).toLocaleDateString()}
            </td>
            <td className="py-2 px-2">
              <ResendOrderEmailButton orderId={o.id} lastConfirmationEmailAt={o.last_confirmation_email_at} />
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
