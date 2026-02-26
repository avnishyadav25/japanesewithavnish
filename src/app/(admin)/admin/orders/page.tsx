import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminOrdersPage() {
  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, user_email, status, total_amount_paise, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Orders</h1>
      {orders && orders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Order</th>
                <th className="text-left py-2">Email</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Amount</th>
                <th className="text-left py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b">
                  <td className="py-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="py-2">{o.user_email}</td>
                  <td className="py-2">{o.status}</td>
                  <td className="py-2">₹{o.total_amount_paise / 100}</td>
                  <td className="py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-secondary">No orders yet.</p>
      )}
    </div>
  );
}
