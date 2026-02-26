import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminSubscribersPage() {
  const supabase = createAdminClient();
  const { data: subscribers } = await supabase
    .from("subscribers")
    .select("email, source, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const csv = subscribers
    ? "email,source,created_at\n" +
      subscribers.map((s) => `${s.email},${s.source || ""},${s.created_at}`).join("\n")
    : "email,source,created_at\n";

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Newsletter Subscribers</h1>
      <a
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
        download="subscribers.csv"
        className="btn-primary inline-block mb-6"
      >
        Export CSV
      </a>
      {subscribers && subscribers.length > 0 ? (
        <ul className="space-y-1">
          {subscribers.map((s, i) => (
            <li key={i} className="text-secondary text-sm">
              {s.email} — {s.source || "unknown"} — {new Date(s.created_at).toLocaleDateString()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-secondary">No subscribers yet.</p>
      )}
    </div>
  );
}
