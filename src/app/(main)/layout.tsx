import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { NewsletterSection } from "@/components/NewsletterSection";

const isComingSoon = process.env.COMING_SOON === "true" || process.env.COMING_SOON === "1";

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
          <NewsletterSection source="site" />
          <Footer />
        </>
      )}
    </div>
  );
}
