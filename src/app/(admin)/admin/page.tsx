import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: totalOrders },
    { data: revenueData },
    { count: totalSubscribers },
    { count: quizAttempts },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("total_amount_paise")
      .eq("status", "paid")
      .gte("created_at", monthStart),
    supabase.from("subscribers").select("id", { count: "exact", head: true }),
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id, user_email, status, total_amount_paise, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const revenueThisMonth =
    revenueData?.reduce((sum, o) => sum + (o.total_amount_paise || 0), 0) ?? 0;

  const quickLinks = [
    { href: "/admin/products", label: "Products", desc: "Manage bundles" },
    { href: "/admin/orders", label: "Orders", desc: "View payments" },
    { href: "/admin/quiz", label: "Quiz", desc: "Questions & thresholds" },
    { href: "/admin/newsletter/subscribers", label: "Newsletter", desc: "Subscribers" },
    { href: "/admin/blogs", label: "Blogs", desc: "Posts & content" },
    { href: "/admin/learn/grammar", label: "Learning", desc: "Grammar, vocab, kanji" },
    { href: "/admin/settings", label: "Settings", desc: "Company config" },
  ];

  return (
    <div>
      <AdminPageHeader title="Admin Dashboard" />

      <div className="bento-grid mb-8">
        <div className="bento-span-2 card-content">
          <p className="text-secondary text-sm uppercase tracking-wider">Total Orders</p>
          <p className="font-heading text-2xl font-bold text-charcoal mt-1">{totalOrders ?? 0}</p>
        </div>
        <div className="bento-span-2 card-content">
          <p className="text-secondary text-sm uppercase tracking-wider">Revenue (this month)</p>
          <p className="font-heading text-2xl font-bold text-charcoal mt-1">
            ₹{(revenueThisMonth / 100).toLocaleString()}
          </p>
        </div>
        <div className="bento-span-2 card-content">
          <p className="text-secondary text-sm uppercase tracking-wider">Subscribers</p>
          <p className="font-heading text-2xl font-bold text-charcoal mt-1">
            {totalSubscribers ?? 0}
          </p>
        </div>
        <div className="bento-span-2 card-content">
          <p className="text-secondary text-sm uppercase tracking-wider">Quiz Attempts</p>
          <p className="font-heading text-2xl font-bold text-charcoal mt-1">
            {quizAttempts ?? 0}
          </p>
        </div>
      </div>

      <div className="bento-grid mb-8">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bento-span-2 card block hover:no-underline group"
          >
            <h2 className="font-heading font-bold text-charcoal group-hover:text-primary transition">
              {link.label}
            </h2>
            <p className="text-secondary text-sm mt-1">{link.desc}</p>
          </Link>
        ))}
      </div>

      <h2 className="font-heading text-lg font-bold text-charcoal mb-4">Recent Orders</h2>
      <AdminCard>
        {recentOrders && recentOrders.length > 0 ? (
          <AdminTable
            headers={["Order", "Email", "Status", "Amount", "Date"]}
          >
            {recentOrders.map((o) => (
              <tr key={o.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="py-2 px-2">{o.user_email}</td>
                <td className="py-2 px-2">
                  <StatusBadge
                    status={o.status}
                    variant={
                      o.status === "paid"
                        ? "paid"
                        : o.status === "pending_payment" || o.status === "created"
                          ? "pending"
                          : o.status === "failed"
                            ? "failed"
                            : "created"
                    }
                  />
                </td>
                <td className="py-2 px-2">₹{o.total_amount_paise / 100}</td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {new Date(o.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <p className="text-secondary py-8 text-center">No orders yet.</p>
        )}
      </AdminCard>
    </div>
  );
}
