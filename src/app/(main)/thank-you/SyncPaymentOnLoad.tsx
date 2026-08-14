"use client";

import { useEffect, useRef } from "react";

/**
 * When thank-you page loads with ?order=id, call sync-payment so missed webhooks
 * still update order status and send the confirmation email.
 */
export function SyncPaymentOnLoad({ orderId }: { orderId: string | undefined }) {
  const done = useRef(false);

  useEffect(() => {
    if (!orderId || done.current) return;
    done.current = true;
    fetch(`/api/orders/${encodeURIComponent(orderId)}/sync-payment`, { method: "GET" }).catch(() => {});
  }, [orderId]);

  return null;
}
