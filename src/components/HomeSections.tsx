import Link from "next/link";
import Image from "next/image";

// ── Steps Section ────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Take the Quiz",
    sub: "Know your JLPT level in 3 minutes. Get an instant recommended JLPT level and learning path.",
    cta: "Start Quiz →",
    href: "/quiz",
  },
  {
    n: "02",
    title: "Create your free account",
    sub: "Pick a level (N5→N1) and start learning. Upgrade anytime for unlimited daily access.",
    cta: "Explore Premium →",
    href: "/pricing",
  },
  {
    n: "03",
    title: "Study & Access",
    sub: "Learn online anytime — on any device. Your progress is saved automatically.",
    cta: "My Dashboard →",
    href: "/learn/dashboard",
  },
];

export function StepsSection() {
  return (
    <section className="bg-white py-[60px] px-4 sm:px-6 border-b border-[var(--divider)]">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-10">
          <div className="text-[11px] font-bold tracking-[.1em] uppercase text-[var(--subtle)] mb-2">
            How it works
          </div>
          <h2 className="font-serif text-[30px] font-normal text-[#1A1A1A]">
            Start learning in 3 steps
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="bg-[var(--background)] rounded-xl border border-[var(--divider)] p-7 relative"
            >
              <div className="font-serif text-[48px] text-[var(--divider)] leading-none mb-3 font-normal">
                {s.n}
              </div>
              <div className="text-[17px] font-bold mb-2 text-[#1A1A1A]">{s.title}</div>
              <div className="text-[14px] text-[#555] leading-[1.7] mb-5">{s.sub}</div>
              <Link
                href={s.href}
                className="text-[13px] font-bold text-primary inline-flex items-center gap-1 hover:underline"
              >
                {s.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── NihongoNavi Section ───────────────────────────────────────────────────────

const NAVI_FEATURES = [
  { icon: "💬", text: "Grammar explanations in plain English" },
  { icon: "📖", text: "Kanji breakdowns with readings & meanings" },
  { icon: "✏️", text: "Sentence correction with explanations" },
  { icon: "🎯", text: "JLPT-level targeted practice" },
];

const CHAT_MESSAGES = [
  { role: "user", text: "How do I use に vs で for location?" },
  {
    role: "ai",
    text: "Great question! Use に for the destination or existence (いる/ある), and で for where the action happens. 例: 図書館で勉強する vs 図書館にいる",
  },
  { role: "user", text: "What does 決める mean?" },
  {
    role: "ai",
    text: "決める (きめる) means \"to decide.\" e.g. 旅行の日を決める — to decide on a travel date. It's an N4 verb, transitive.",
  },
];

export function NihongoNaviSection() {
  return (
    <section
      className="relative overflow-hidden py-[80px] px-4 sm:px-6"
      style={{ background: "#1A1A1A" }}
    >
      {/* Glow */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-[500px] h-full"
        style={{
          background:
            "radial-gradient(ellipse at right, rgba(208,2,27,.10) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[1100px] mx-auto relative grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-[60px] items-center">
        {/* Left */}
        <div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-[var(--red-light)] text-primary mb-5">
            ✨ AI-Powered
          </span>
          <h2 className="font-serif text-[38px] font-normal text-white leading-[1.2] mb-4">
            Meet Nihongo Navi,
            <br />
            <em className="italic text-white/80">your Japanese tutor</em>
          </h2>
          <p className="text-[16px] text-white/65 leading-[1.75] mb-8 max-w-[420px]">
            Ask anything — grammar questions, vocab lookups, sentence correction, kanji
            breakdown. Available 24/7, included with Premium access.
          </p>
          <div className="flex flex-col gap-3 mb-8">
            {NAVI_FEATURES.map((f) => (
              <div key={f.text} className="flex gap-3 items-center">
                <span className="text-[18px]">{f.icon}</span>
                <span className="text-[15px] text-white/75">{f.text}</span>
              </div>
            ))}
          </div>
          <Link
            href="/tutor"
            className="inline-flex items-center gap-2 bg-primary text-white font-bold rounded-lg px-6 py-3.5 text-[16px] hover:bg-primary/90 transition-colors"
          >
            Try Nihongo Navi →
          </Link>
        </div>

        {/* Right — static chat demo */}
        <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: "#1e1e1e" }}>
          {/* Chat header */}
          <div
            className="px-5 py-3.5 flex items-center gap-3 border-b border-white/[.07]"
            style={{ background: "#252525" }}
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[15px] flex-shrink-0">
              🤖
            </div>
            <div>
              <div className="text-[14px] font-bold text-white">Nihongo Navi</div>
              <div className="text-[11px] text-white/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Online
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="p-5 flex flex-col gap-3 min-h-[260px]">
            {CHAT_MESSAGES.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] px-3.5 py-2.5 text-[13.5px] leading-[1.6]"
                  style={{
                    borderRadius:
                      m.role === "user"
                        ? "14px 14px 4px 14px"
                        : "14px 14px 14px 4px",
                    background: m.role === "user" ? "#D0021B" : "#2a2a2a",
                    color: m.role === "user" ? "#fff" : "rgba(255,255,255,.85)",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {/* Typing indicator */}
            <div className="flex justify-start">
              <div
                className="px-4 py-2.5 flex gap-1 items-center"
                style={{ background: "#2a2a2a", borderRadius: "14px 14px 14px 4px" }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-white/40 bounce-dot inline-block"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="px-4 py-3 border-t border-white/[.07] flex gap-2">
            <div
              className="flex-1 rounded-[10px] px-3.5 py-2.5 text-[13px] text-white/30"
              style={{ background: "#2a2a2a" }}
            >
              Ask anything in Japanese...
            </div>
            <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center text-white text-[16px] cursor-pointer">
              ↑
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Quiz CTA Section ──────────────────────────────────────────────────────────

const QUIZ_STATS = [
  { n: "10", l: "Questions" },
  { n: "3 min", l: "Duration" },
  { n: "N5→N1", l: "Coverage" },
];

export function QuizCTASection() {
  return (
    <section className="py-[80px] px-4 sm:px-6 bg-[var(--background)]">
      <div className="max-w-[1100px] mx-auto">
        <div className="bg-[var(--red-light)] border border-[#fecdd3] rounded-[20px] p-10 sm:p-12 flex flex-col sm:flex-row items-start sm:items-center gap-10">
          {/* Left */}
          <div className="flex-1">
            <div className="text-[11px] font-bold tracking-[.1em] uppercase text-primary/70 mb-3">
              Free placement quiz
            </div>
            <h2 className="font-serif text-[32px] font-normal text-[#1A1A1A] mb-3 leading-[1.2]">
              Not sure which level?
              <br />
              {"We'll tell you in 3 minutes."}
            </h2>
            <p className="text-[15px] text-[#555] leading-[1.7]">
              Answer 10 questions on grammar, kanji, and vocabulary — get an instant recommended
              JLPT level and learning path for you.
            </p>
          </div>
          {/* Right */}
          <div className="flex-shrink-0 text-center sm:text-right">
            <div className="flex gap-6 mb-6 justify-center sm:justify-end">
              {QUIZ_STATS.map((s) => (
                <div key={s.l} className="text-center">
                  <div className="text-[22px] font-extrabold text-primary">{s.n}</div>
                  <div className="text-[11px] text-[#555] font-semibold">{s.l}</div>
                </div>
              ))}
            </div>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 bg-primary text-white font-bold rounded-lg px-6 py-3.5 text-[16px] hover:bg-primary/90 transition-colors"
            >
              Start the Quiz →
            </Link>
            <div className="text-[12px] text-[var(--subtle)] mt-2">No signup required</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Why Avnish Section ────────────────────────────────────────────────────────

const WHY_FEATURES = [
  {
    title: "Structured N5→N1 roadmap",
    sub: "No guessing what to study next — each lesson builds on the last.",
  },
  {
    title: "JLPT-style mock tests at every level",
    sub: "Practise JLPT-style vocabulary, grammar, reading, and listening formats.",
  },
  {
    title: "Progressive grammar, vocab, and kanji",
    sub: "Learn smarter, not more — spaced repetition built in.",
  },
  {
    title: "AI tutor available 24/7",
    sub: "Nihongo Navi answers questions the textbook can't.",
  },
];

export function WhyAvnishSection() {
  return (
    <section className="py-[80px] px-4 sm:px-6 bg-white border-t border-[var(--divider)]">
      <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-16 items-center">
        {/* Photo */}
        <div className="text-center">
          <div className="w-[220px] h-[280px] rounded-[20px] bg-[var(--divider)] mx-auto flex items-center justify-center overflow-hidden">
            <Image
              src="/logo.png"
              alt="Avnish — JLPT educator"
              width={220}
              height={280}
              className="object-cover w-full h-full"
            />
          </div>
          <div className="mt-4 text-[17px] font-bold text-[#1A1A1A]">Avnish</div>
          <div className="text-[13px] text-[var(--subtle)]">JLPT educator & creator</div>
        </div>

        {/* Content */}
        <div>
          <div className="text-[11px] font-bold tracking-[.1em] uppercase text-[var(--subtle)] mb-3">
            Why learners choose this system
          </div>
          <h2 className="font-serif text-[32px] font-normal text-[#1A1A1A] mb-4 leading-[1.2]">
            Built for real JLPT results,
            <br />
            <em className="italic">not just study material</em>
          </h2>
          <p className="text-[15px] text-[#555] leading-[1.8] mb-8 max-w-[480px]">
            I built this system because I couldn&apos;t find one that was both structured and
            actually enjoyable to use. Every lesson is mapped to JLPT level expectations — but
            taught the way I wish I had learned.
          </p>
          <div className="flex flex-col gap-4 mb-8">
            {WHY_FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3.5 items-start">
                <div className="w-[22px] h-[22px] rounded-full bg-[var(--red-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-[12px] font-bold">✓</span>
                </div>
                <div>
                  <div className="text-[15px] font-bold mb-0.5">{f.title}</div>
                  <div className="text-[13px] text-[#555] leading-[1.6]">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/start-here"
            className="text-primary font-bold text-[14px] inline-flex items-center gap-1 hover:underline"
          >
            Read my story →
          </Link>
        </div>
      </div>
    </section>
  );
}
