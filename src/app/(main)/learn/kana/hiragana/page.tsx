import { HiraganaClient } from "./HiraganaClient";
import { Metadata } from "next";
import { canonicalUrl } from "@/lib/seo";

const TITLE = "Interactive Hiragana Chart & Tracing Practice | Japanese with Avnish";
const DESCRIPTION =
  "Learn and practice all 46 Hiragana characters along with Dakuten and Yoon combination sounds. Listen to pronunciation and draw on the canvas.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/learn/kana/hiragana" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonicalUrl("/learn/kana/hiragana"), type: "website", images: ["/og-default.png"] },
};

export default function HiraganaPage() {
  return <HiraganaClient />;
}
