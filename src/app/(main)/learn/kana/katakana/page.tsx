import { KatakanaClient } from "./KatakanaClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interactive Katakana Chart & Tracing Practice | Japanese with Avnish",
  description: "Learn and practice all Katakana characters along with Dakuten and Yoon combination sounds. Listen to Japanese pronunciation audio and practice drawing.",
};

export default function KatakanaPage() {
  return <KatakanaClient />;
}
