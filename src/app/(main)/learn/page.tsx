import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn Japanese | Japanese with Avnish",
  description: "Browse Japanese learning resources organized by study area. Hiragana, Katakana, Kanji, Grammar, Vocab, Listening, Reading, and Writing.",
};

interface HubCard {
  title: string;
  desc: string;
  href: string;
  image: string;
  badge?: string;
}

export default function LearnHubPage() {
  const cards: HubCard[] = [
    {
      title: "JLPT Courses",
      desc: "Full structured curriculum lessons from N5 to N1 level.",
      href: "/learn/curriculum",
      image: "/images/hub/jlpt.jpg",
      badge: "Core",
    },
    {
      title: "Hiragana & Katakana",
      desc: "Interactive kana charts, stroke order guides, and tracing.",
      href: "/learn/kana",
      image: "/images/hub/kana.jpg",
      badge: "Characters",
    },
    {
      title: "Kanji Study & Writing Practice",
      desc: "Explore an expanding library of Kanji with readings, meanings, and writing practice.",
      href: "/learn/kana/kanji",
      image: "/images/hub/kanji.jpg",
      badge: "Kanji",
    },
    {
      title: "Grammar Lessons",
      desc: "Detailed grammar point explanations, structures, and examples.",
      href: "/learn/grammar",
      image: "/images/hub/grammar.jpg",
    },
    {
      title: "Vocabulary Lists",
      desc: "Core Japanese word definitions, audio pronunciation, and quizzes.",
      href: "/learn/vocabulary",
      image: "/images/hub/vocabulary.jpg",
    },
    {
      title: "Listening Comprehension",
      desc: "Japanese pronunciation audio dialogue scenarios with comprehension questions.",
      href: "/learn/listening",
      image: "/images/hub/listening.jpg",
      badge: "Audio",
    },
    {
      title: "Reading Sandbox",
      desc: "Read real Japanese essays and click on words for inline lookup.",
      href: "/learn/reading",
      image: "/images/hub/reading.jpg",
    },
    {
      title: "Writing Practice",
      desc: "Interactive composition writing canvas exercises.",
      href: "/learn/writing",
      image: "/images/hub/writing.jpg",
    },
    {
      title: "Grammar Drills",
      desc: "Practice and reinforce sentence structures with active exercises.",
      href: "/learn/grammar-drills",
      image: "/images/hub/drills.jpg",
      badge: "Drills",
    },
    {
      title: "Adaptive Placement Quiz",
      desc: "Take the 25-question adaptive test (approximately 5 minutes) to determine your JLPT level.",
      href: "/quiz",
      image: "/images/hub/quiz.jpg",
      badge: "Quiz",
    },
  ];

  return (
    <div className="py-12 sm:py-16 px-6 sm:px-8 lg:px-12 bg-white min-h-[90vh]">
      <div className="max-w-6xl mx-auto text-center">
        {/* Main Hub Title */}
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-tight mb-2">
          Learn Japanese
        </h1>
        
        <p className="text-secondary text-sm mt-3">
          New here?{" "}
          <Link href="/guide" className="text-primary font-semibold hover:underline">
            Read the Site Guide
          </Link>{" "}
          for a quick tour of everything below.
        </p>

        {/* Divider line matching user screenshot */}
        <div className="w-full h-[1px] bg-[#E2E8F0] my-8" />

        {/* Hub Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-8 justify-center">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-[#E2E8F0] hover:border-primary hover:shadow-md transition-all duration-300 no-underline"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] w-full bg-[#FAF8F5] overflow-hidden border-b border-[#E2E8F0]">
                {/* Fallback pattern if image is not generated yet */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-secondary/5 flex items-center justify-center text-charcoal/20 select-none font-bold text-4xl">
                  {card.title.charAt(0)}
                </div>
                
                {/* Visual card cover image */}
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  sizes="(max-w-768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  unoptimized
                />

                {card.badge && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-charcoal/90 text-white select-none">
                    {card.badge}
                  </span>
                )}
              </div>

              {/* Title Section */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-heading text-lg font-bold text-[#1A1A1A] group-hover:text-primary transition-colors text-center mb-1.5">
                    {card.title}
                  </h3>
                  <p className="text-secondary text-xs leading-relaxed text-center">
                    {card.desc}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
