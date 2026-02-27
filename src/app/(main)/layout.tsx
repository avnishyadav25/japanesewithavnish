import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { NewsletterSection } from "@/components/NewsletterSection";
import { Suspense } from "react";
import { PathnameGuard } from "./pathname-guard";

const isComingSoon =
  process.env.COMING_SOON === "true" || process.env.COMING_SOON === "1";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-base">
      {!isComingSoon && (
        <>
          <AnnouncementBar />
          <Header />
        </>
      )}
      <main className="flex-1">{children}</main>
      {!isComingSoon && (
        <>
          <Suspense>
            <PathnameGuard>
              <NewsletterSection source="site" />
            </PathnameGuard>
          </Suspense>
          <Footer />
        </>
      )}
    </div>
  );
}
