import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-charcoal mb-6">Admin Dashboard</h1>
      <div className="bento-grid">
        <Link href="/admin/products" className="bento-span-2 bento-row-2 card block hover:no-underline group">
          <h2 className="font-heading font-bold text-charcoal group-hover:text-primary transition">Products</h2>
          <p className="text-secondary text-sm mt-1">Manage bundles and assets</p>
        </Link>
        <Link href="/admin/orders" className="bento-span-2 bento-row-2 card block hover:no-underline group">
          <h2 className="font-heading font-bold text-charcoal group-hover:text-primary transition">Orders</h2>
          <p className="text-secondary text-sm mt-1">View orders and payments</p>
        </Link>
        <Link href="/admin/quiz" className="bento-span-2 card block hover:no-underline group">
          <h2 className="font-heading font-bold text-charcoal group-hover:text-primary transition">Quiz</h2>
          <p className="text-secondary text-sm mt-1">Questions and thresholds</p>
        </Link>
        <Link href="/admin/subscribers" className="bento-span-2 card block hover:no-underline group">
          <h2 className="font-heading font-bold text-charcoal group-hover:text-primary transition">Newsletter</h2>
          <p className="text-secondary text-sm mt-1">Export subscribers</p>
        </Link>
      </div>
    </div>
  );
}
