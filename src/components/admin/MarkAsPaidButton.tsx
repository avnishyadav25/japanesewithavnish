"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAsPaidButton({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const router = useRouter();

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/mark-paid`, {
        method: "POST",
      });
      if (res.ok) {
        setStatus("done");
        router.refresh();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return <span className="text-xs text-green-600">Marked paid</span>;
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
      >
        {status === "loading" ? "..." : "Mark as paid"}
      </button>
      {status === "error" && <span className="text-xs text-primary ml-2">Failed</span>}
    </span>
  );
}
