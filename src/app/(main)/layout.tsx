import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const isComingSoon = process.env.COMING_SOON === "true" || process.env.COMING_SOON === "1";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-base">
      {!isComingSoon && <Header />}
      <main className="flex-1">{children}</main>
      {!isComingSoon && <Footer />}
    </div>
  );
}
