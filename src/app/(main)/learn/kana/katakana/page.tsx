import { KatakanaClient } from "./KatakanaClient";
import { Metadata } from "next";
import { canonicalUrl } from "@/lib/seo";

const TITLE = "Interactive Katakana Chart & Tracing Practice | Japanese with Avnish";
const DESCRIPTION =
  "Learn and practice all Katakana characters along with Dakuten and Yoon combination sounds. Listen to Japanese pronunciation audio and practice drawing.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/learn/kana/katakana" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonicalUrl("/learn/kana/katakana"), type: "website", images: ["/og-default.png"] },
};

export default function KatakanaPage() {
  return <KatakanaClient />;
}
