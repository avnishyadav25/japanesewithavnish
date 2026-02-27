import Link from "next/link";
import { LeadMagnetForm } from "@/components/LeadMagnetForm";

export const metadata = {
  title: "Free N5 Kana Practice Pack | Japanese with Avnish",
  description: "Get your free N5 Hiragana and Katakana practice pack. Instant download. No spam.",
};

export default function FreeN5PackPage() {
  return (
    <div className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6 bg-[#FAF8F5]">
      <div className="max-w-[1100px] mx-auto">
        <div className="max-w-md mx-auto">
          <p className="text-primary font-medium uppercase tracking-widest text-sm mb-2">無料</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4">
            Free N5 Kana Practice Pack
          </h1>
          <p className="text-secondary mb-6">
            Get instant access to Hiragana and Katakana practice sheets. Perfect for beginners. ひらがな・カタカナの練習シートを無料でダウンロード。
          </p>
          <LeadMagnetForm />
          <p className="text-secondary text-sm mt-6">
            <Link href="/start-here" className="text-primary hover:underline">← Back to Start Here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
