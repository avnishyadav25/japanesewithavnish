import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Admin Dashboard</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/admin/products" className="card block hover:no-underline">
          <h2 className="font-bold text-charcoal">Products</h2>
          <p className="text-secondary text-sm mt-1">Manage bundles and assets</p>
        </Link>
        <Link href="/admin/orders" className="card block hover:no-underline">
          <h2 className="font-bold text-charcoal">Orders</h2>
          <p className="text-secondary text-sm mt-1">View orders and payments</p>
        </Link>
        <Link href="/admin/quiz" className="card block hover:no-underline">
          <h2 className="font-bold text-charcoal">Quiz</h2>
          <p className="text-secondary text-sm mt-1">Questions and thresholds</p>
        </Link>
        <Link href="/admin/subscribers" className="card block hover:no-underline">
          <h2 className="font-bold text-charcoal">Newsletter</h2>
          <p className="text-secondary text-sm mt-1">Export subscribers</p>
        </Link>
      </div>
    </div>
  );
}
