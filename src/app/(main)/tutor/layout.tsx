import type { Metadata } from "next";
import { clampTitle, clampDescription, canonicalUrl } from "@/lib/seo";

const TITLE = clampTitle("AI Japanese Tutor | Japanese with Avnish");
const DESCRIPTION = clampDescription(
  "Ask the AI Japanese tutor grammar, vocabulary, and JLPT questions and get instant, level-appropriate explanations."
);

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tutor" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonicalUrl("/tutor"), type: "website" },
};

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
