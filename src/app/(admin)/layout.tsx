import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAdminSession } from "@/lib/auth/admin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") || "";
  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-base">{children}</div>;
  }

  const admin = await getAdminSession();
  if (!admin) {
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
