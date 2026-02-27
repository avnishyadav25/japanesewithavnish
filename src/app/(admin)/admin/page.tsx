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
    { count: publishedPosts },
    { count: learningItems },
    { count: quizQuestions },
    { data: recentOrders },
    { data: last7Days },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("total_amount_paise").eq("status", "paid").gte("created_at", monthStart),
    supabase.from("subscribers").select("id", { count: "exact", head: true }),
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("learning_content").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("quiz_questions").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id, user_email, status, total_amount_paise, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("orders").select("created_at, total_amount_paise, status").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).eq("status", "paid"),
  ]);

  const revenueThisMonth = revenueData?.reduce((sum, o) => sum + (o.total_amount_paise || 0), 0) ?? 0;

  // Build last 7 days bar chart data
  const dayBars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const dayOrders = (last7Days || []).filter((o) => o.created_at.slice(0, 10) === key);
    const revenue = dayOrders.reduce((s, o) => s + (o.total_amount_paise || 0), 0);
    return {
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      revenue,
      count: dayOrders.length,
    };
  });

  const maxRevenue = Math.max(...dayBars.map((d) => d.revenue), 1);

  const quickLinks = [
    { href: "/admin/products", label: "Products", desc: "Manage bundles & prices", emoji: "🛍️" },
    { href: "/admin/orders", label: "Orders", desc: "View & track payments", emoji: "📦" },
    { href: "/admin/quiz", label: "Quiz", desc: "Questions & thresholds", emoji: "📝" },
    { href: "/admin/newsletter/subscribers", label: "Newsletter", desc: "Subscriber list", emoji: "✉️" },
    { href: "/admin/blogs", label: "Blogs", desc: "Posts & content", emoji: "📰" },
    { href: "/admin/learn/grammar", label: "Learning", desc: "Grammar, vocab, kanji…", emoji: "🎌" },
    { href: "/admin/settings", label: "Settings", desc: "Site configuration", emoji: "⚙️" },
  ];

  const stats = [
    { label: "Total Orders", value: totalOrders ?? 0, color: "text-charcoal", sub: "all time" },
    { label: "Revenue (this month)", value: `₹${(revenueThisMonth / 100).toLocaleString("en-IN")}`, color: "text-primary", sub: new Date().toLocaleString("en-IN", { month: "long" }) },
    { label: "Subscribers", value: totalSubscribers ?? 0, color: "text-charcoal", sub: "newsletter" },
    { label: "Quiz Attempts", value: quizAttempts ?? 0, color: "text-charcoal", sub: "total" },
    { label: "Published Posts", value: publishedPosts ?? 0, color: "text-green-700", sub: "blog" },
    { label: "Learning Content", value: learningItems ?? 0, color: "text-green-700", sub: "published" },
  ];

  return (
    <div className="page-enter">
      <AdminPageHeader title="Dashboard" />

      {/* Stats grid */}
      <div className="bento-grid mb-8">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`bento-span-2 card-content animate-fade-in-${i + 1}`}
          >
            <p className="text-secondary text-xs uppercase tracking-wider">{s.label}</p>
            <p className={`font-heading text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-secondary text-xs mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart (last 7 days) + Quick actions */}
      <div className="bento-grid mb-8">
        {/* Mini bar chart */}
        <div className="bento-span-4 card">
          <h2 className="font-heading font-bold text-charcoal mb-4 text-sm">
            Revenue — last 7 days
          </h2>
          <div className="flex items-end gap-2 h-28">
            {dayBars.map((day) => (
              <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "88px" }}>
                  <div
                    className="w-full bg-primary/80 rounded-t transition-all duration-500 hover:bg-primary group relative"
                    style={{ height: `${Math.max(4, (day.revenue / maxRevenue) * 88)}px` }}
                  >
                    {day.revenue > 0 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-charcoal text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        ₹{(day.revenue / 100).toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-secondary text-xs">{day.label}</span>
              </div>
            ))}
          </div>
          {dayBars.every((d) => d.revenue === 0) && (
            <p className="text-secondary text-xs text-center mt-2">No paid orders in the last 7 days</p>
          )}
        </div>

        {/* Quiz + Content counters */}
        <div className="bento-span-2 card flex flex-col gap-4">
          <h2 className="font-heading font-bold text-charcoal text-sm">Content Overview</h2>
          {[
            { label: "Quiz Questions", value: quizQuestions ?? 0, href: "/admin/quiz" },
            { label: "Blog Posts", value: publishedPosts ?? 0, href: "/admin/blogs" },
            { label: "Learning Items", value: learningItems ?? 0, href: "/admin/learn/grammar" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="flex items-center justify-between hover:text-primary transition">
              <span className="text-secondary text-sm">{item.label}</span>
              <span className="font-heading font-bold text-charcoal text-lg">{item.value}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="mb-8">
        <h2 className="font-heading text-base font-bold text-charcoal mb-4">Quick Access</h2>
        <div className="bento-grid">
          {quickLinks.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={`bento-span-2 card block hover:no-underline group animate-fade-in-${Math.min(i + 1, 6)}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{link.emoji}</span>
                <div>
                  <h3 className="font-heading font-bold text-charcoal group-hover:text-primary transition text-sm">
                    {link.label}
                  </h3>
                  <p className="text-secondary text-xs mt-0.5">{link.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <h2 className="font-heading text-base font-bold text-charcoal mb-4">Recent Orders</h2>
      <AdminCard>
        {recentOrders && recentOrders.length > 0 ? (
          <AdminTable headers={["Order", "Email", "Status", "Amount", "Date"]}>
            {recentOrders.map((o) => (
              <tr key={o.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-2 px-2 font-mono text-xs text-secondary">{o.id.slice(0, 8)}</td>
                <td className="py-2 px-2 text-sm">{o.user_email}</td>
                <td className="py-2 px-2">
                  <StatusBadge
                    status={o.status}
                    variant={
                      o.status === "paid" ? "paid"
                        : o.status === "pending_payment" || o.status === "created" ? "pending"
                          : o.status === "failed" ? "failed"
                            : "created"
                    }
                  />
                </td>
                <td className="py-2 px-2 font-medium">₹{(o.total_amount_paise / 100).toLocaleString("en-IN")}</td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {new Date(o.created_at).toLocaleDateString("en-IN")}
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
