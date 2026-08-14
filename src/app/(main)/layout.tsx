import { headers } from "next/headers";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { ChatPanel } from "@/components/ChatPanel";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { PageAnalytics } from "@/components/PageAnalytics";
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-white"
      >
        Skip to content
      </a>
      {!isComingSoon && (
        <>
          <AnnouncementBar />
          <Header isAdmin={isAdmin} />
        </>
      )}
      <main id="main-content" className={`flex-1 ${!isComingSoon && !isTutorRoute ? "pb-16 md:pb-0" : ""}`}>{children}</main>
      {!isComingSoon && (
        <Suspense fallback={null}>
          <PageAnalytics />
        </Suspense>
      )}
      {!isComingSoon && !isTutorRoute && (
        <>
          <Footer />
          <ChatPanel />
          <MobileBottomNav />
        </>
      )}
      <FeedbackWidget />
    </div>
  );
}
