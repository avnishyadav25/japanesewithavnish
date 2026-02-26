import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    redirect("/login?redirect=/admin");
  }

  return (
    <div className="min-h-screen bg-base">
      <nav className="border-b border-[var(--divider)] bg-white px-4 py-3 flex gap-6">
        <Link href="/admin" className="font-bold text-charcoal">Admin</Link>
        <Link href="/admin/products" className="text-secondary hover:text-primary">Products</Link>
        <Link href="/admin/orders" className="text-secondary hover:text-primary">Orders</Link>
        <Link href="/admin/quiz" className="text-secondary hover:text-primary">Quiz</Link>
        <Link href="/admin/subscribers" className="text-secondary hover:text-primary">Newsletter</Link>
        <Link href="/" className="text-secondary hover:text-primary ml-auto">← Site</Link>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
