import { headers } from "next/headers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { ChatPanel } from "@/components/ChatPanel";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { getAdminSession } from "@/lib/auth/admin";

const isComingSoon =
  process.env.COMING_SOON === "true" || process.env.COMING_SOON === "1";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  const isAdmin = !!session;
  
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isTutorRoute = pathname === "/tutor";

  return (
    <div className="min-h-screen flex flex-col bg-base">
      {!isComingSoon && (
        <>
          <AnnouncementBar />
          <Header isAdmin={isAdmin} />
        </>
      )}
      <main className="flex-1">{children}</main>
      {!isComingSoon && !isTutorRoute && (
        <>
          <Footer />
          <ChatPanel />
        </>
      )}
      <FeedbackWidget />
    </div>
  );
}
