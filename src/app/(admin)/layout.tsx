import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

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
      <AdminSidebar />
      <main className="md:ml-[240px] min-h-screen japanese-wave-bg pt-14 md:pt-0">
        <div className="p-6 max-w-[1200px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
