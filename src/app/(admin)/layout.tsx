import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AdminLogout } from "./AdminLogout";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") || "";
  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-base">{children}</div>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-base">
      <nav className="border-b border-[var(--divider)] bg-white px-4 py-3 flex flex-wrap gap-4 items-center">
        <Link href="/admin" className="font-heading font-bold text-charcoal">Admin</Link>
        <Link href="/admin/products" className="text-secondary hover:text-primary text-sm transition">Products</Link>
        <Link href="/admin/orders" className="text-secondary hover:text-primary text-sm transition">Orders</Link>
        <Link href="/admin/quiz" className="text-secondary hover:text-primary text-sm transition">Quiz</Link>
        <Link href="/admin/subscribers" className="text-secondary hover:text-primary text-sm transition">Newsletter</Link>
        <Link href="/" className="text-secondary hover:text-primary text-sm ml-auto">← Site</Link>
        <AdminLogout />
      </nav>
      <main className="p-6 max-w-[1200px] mx-auto">{children}</main>
    </div>
  );
}
