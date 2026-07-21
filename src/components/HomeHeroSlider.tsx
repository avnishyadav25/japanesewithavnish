"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const AUTO_ADVANCE_MS = 7000;

function CurrentSlide() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 items-center">
      {/* Headline + Actions */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/10 text-white border border-white/5">
            🔥 Join a growing community
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#D0021B]/20 text-[#FF6B6B] border border-[#D0021B]/10">
            JLPT N5 → N1
          </span>
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl font-black text-white leading-tight">
          The structured path
          <br />
          to <span className="text-[#FF6B6B]">Japanese fluency</span>
        </h1>

        <p className="text-white/80 text-sm font-semibold tracking-wide">
          Structured Japanese Learning from N5 to N1.
        </p>

        <p className="text-white/70 text-sm leading-relaxed max-w-lg">
          Unlock unlimited Japanese learning with a premium pass. Get 150+ structured lessons from N5 to N1, interactive practice drills, community scoreboards, streaks, and badges.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/quiz"
            className="btn-primary h-12 px-6 rounded-xl text-xs font-bold font-heading flex items-center justify-center shadow-md hover:bg-primary/95 transition-colors"
          >
            Find My Level → Quiz
          </Link>
          <a
            href="#pricing"
            className="h-12 px-6 rounded-xl text-xs font-bold font-heading flex items-center justify-center border-2 border-white/20 text-white hover:bg-white/5 transition-colors"
          >
            View Pricing Passes
          </a>
        </div>

        <div className="flex flex-wrap gap-5 text-[11px] font-medium text-white/50 pt-2">
          {["Fixed-duration passes", "Structured Pathways", "Secure checkout"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="text-[#C8A35F]">✓</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* Right — Beautiful mock visual card of dashboard */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Student Profile</span>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#C8A35F]/20 text-[#C8A35F] uppercase border border-[#C8A35F]/20">Active Pass</span>
        </div>

        <div className="space-y-3.5">
          <div>
            <span className="text-[10px] text-white/40 block">Course Target</span>
            <span className="text-xs font-black text-white block mt-0.5">JLPT N5 Pathway</span>
          </div>

          <div>
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="text-white/40">Pathway Completion</span>
              <span className="text-white/80 font-bold">42%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="bg-[#D0021B] h-full w-[42%]" />
            </div>
          </div>

          <div>
            <span className="text-[10px] text-white/40 block mb-1">Recent Achievements</span>
            <div className="flex gap-1.5">
              {["🔥", "🎓", "🗣️", "🏆"].map((emoji, idx) => (
                <span key={idx} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs">
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function First500FreeSlide() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 items-center">
      {/* Headline + Actions */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#C8A35F]/20 text-[#C8A35F] border border-[#C8A35F]/20">
            🎁 Limited-time offer
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#D0021B]/20 text-[#FF6B6B] border border-[#D0021B]/10">
            First 500 users only
          </span>
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl font-black text-white leading-tight">
          Your first month,
          <br />
          <span className="text-[#FF6B6B]">completely free</span>
        </h1>

        <p className="text-white/80 text-sm font-semibold tracking-wide">
          Use code FIRST500FREE at checkout — no catch, no card tricks.
        </p>

        <p className="text-white/70 text-sm leading-relaxed max-w-lg">
          The first 500 people to apply this code get a full 30-Day Premium Pass free — every level N5 to N1, mock tests, unlimited practice, and Nihongo Navi included. Once 500 spots are claimed, the code stops working for good.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/pricing"
            className="btn-primary h-12 px-6 rounded-xl text-xs font-bold font-heading flex items-center justify-center shadow-md hover:bg-primary/95 transition-colors"
          >
            Claim Your Free Month →
          </Link>
          <a
            href="#pricing"
            className="h-12 px-6 rounded-xl text-xs font-bold font-heading flex items-center justify-center border-2 border-white/20 text-white hover:bg-white/5 transition-colors"
          >
            See What&apos;s Included
          </a>
        </div>

        <div className="flex flex-wrap gap-5 text-[11px] font-medium text-white/50 pt-2">
          {["100% off, applied at checkout", "Full access, not a limited trial", "Capped at 500 redemptions"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="text-[#C8A35F]">✓</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* Right — Order summary mock card showing the code applied */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C8A35F] animate-pulse" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Order Summary</span>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#C8A35F]/20 text-[#C8A35F] uppercase border border-[#C8A35F]/20">Code applied</span>
        </div>

        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white">30-Day Premium Pass</span>
            <span className="text-xs text-white/40 line-through">₹99</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/60">Code FIRST500FREE</span>
            <span className="text-[#C8A35F] font-bold">−100%</span>
          </div>

          <div className="w-full h-px bg-white/10" />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Total due today</span>
            <span className="text-xl font-black text-white">₹0</span>
          </div>

          <div>
            <span className="text-[10px] text-white/40 block mb-1">Included in your free month</span>
            <div className="flex gap-1.5">
              {["📚", "🎧", "✍️", "🤖"].map((emoji, idx) => (
                <span key={idx} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs">
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SLIDES = [
  { key: "current", render: CurrentSlide },
  { key: "first500free", render: First500FreeSlide },
];

export function HomeHeroSlider() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActive((a) => (a + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const ActiveSlide = SLIDES[active].render;

  return (
    <section
      className="relative overflow-hidden py-24 px-4 sm:px-6 bg-[#1A1A1A]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Glow Effects */}
      <div
        className="pointer-events-none absolute -top-16 right-0 w-[400px] h-[400px] rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(208,2,27,.2) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-24 w-[300px] h-[300px] rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, rgba(200,163,95,.1) 0%, transparent 70%)" }}
      />

      <div className="max-w-5xl mx-auto relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={SLIDES[active].key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <ActiveSlide />
          </motion.div>
        </AnimatePresence>

        {/* Slide dots */}
        <div className="flex justify-center gap-2 mt-10">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                active === i ? "w-8 bg-[#D0021B]" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
