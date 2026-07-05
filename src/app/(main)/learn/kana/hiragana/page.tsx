import { HiraganaClient } from "./HiraganaClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interactive Hiragana Chart & Tracing Practice | Japanese with Avnish",
  description: "Learn and practice all 46 Hiragana characters along with Dakuten and Yoon combination sounds. Listen to pronunciation and draw on the canvas.",
};

export default function HiraganaPage() {
  return <HiraganaClient />;
}
