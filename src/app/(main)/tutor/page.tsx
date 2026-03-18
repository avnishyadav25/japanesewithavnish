"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };
type TutorHistoryItem = {
  question: string;
  answer_preview: string;
  ask_count: number;
  user_email: string | null;
};

type LearnNavItem = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

const GUEST_MESSAGE_LIMIT = 5;

const SUGGESTED_PROMPTS = [
  "Explain the difference between は and が",
  "Give me practice sentences for 食べる",
  "Correct this sentence: 私はりんごを食べます",
  "What does です mean?",
  "Quiz me on N5 vocabulary",
];

const LEARN_NAV_ITEMS: LearnNavItem[] = [
  { href: "/learn", label: "All" },
  { href: "/learn/curriculum", label: "Curriculum" },
  { href: "/learn/dashboard", label: "My dashboard", requiresAuth: true },
  { href: "/review", label: "Review", requiresAuth: true },
  { href: "/start-here", label: "Start Here" },
  { href: "/jlpt", label: "JLPT" },
  { href: "/free-n5-pack", label: "Free N5 Pack" },
  { href: "/learn/grammar", label: "Grammar" },
  { href: "/learn/vocabulary", label: "Vocabulary" },
  { href: "/learn/kanji", label: "Kanji" },
  { href: "/learn/reading", label: "Reading" },
  { href: "/learn/reading/sandbox", label: "Reading sandbox" },
  { href: "/learn/listening", label: "Listening" },
  { href: "/learn/shadowing", label: "Shadowing" },
  { href: "/learn/writing", label: "Writing" },
  { href: "/learn/exam", label: "Mock exam" },
  { href: "/learn/analytics", label: "Analytics", requiresAuth: true },
  { href: "/learn/practice_test", label: "Practice Test" },
  { href: "/learn/sounds", label: "Sounds" },
  { href: "/learn/study_guide", label: "Study Guide" },
  { href: "/quiz", label: "Placement Quiz" },
];

function CorrectSentenceBlock() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ corrected: string; explanation: string; isCorrect: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/correct-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult({ corrected: data.corrected, explanation: data.explanation, isCorrect: data.isCorrect });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-bento border border-[var(--divider)] bg-white p-4 space-y-3">
      <h3 className="font-heading font-semibold text-charcoal">Correct my sentence</h3>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a Japanese sentence…"
          className="flex-1 px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
          disabled={loading}
        />
        <button type="submit" className="btn-primary px-4 py-2 text-sm rounded-bento" disabled={loading || !text.trim()}>
          {loading ? "Checking…" : "Check"}
        </button>
      </form>
      {error && <p className="text-primary text-sm">{error}</p>}
      {result && (
        <div className="text-sm space-y-2 pt-2 border-t border-[var(--divider)]">
          {result.isCorrect && <p className="text-green-700">Correct!</p>}
          <p className="text-charcoal"><strong>Corrected:</strong> {result.corrected}</p>
          <p className="text-secondary">{result.explanation}</p>
        </div>
      )}
    </div>
  );
}

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [history, setHistory] = useState<TutorHistoryItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSessionEmail(d?.email ?? null))
      .catch(() => setSessionEmail(null));
  }, []);

  useEffect(() => {
    const email = sessionEmail;
    const url = email ? `/api/ai/tutor/history?user_email=${encodeURIComponent(email)}` : "/api/ai/tutor/history";
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHistory(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setHistory([]));
  }, [sessionEmail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userCount = messages.filter((m) => m.role === "user").length;
  const showRegisterPrompt = !sessionEmail && userCount >= GUEST_MESSAGE_LIMIT;

  function handleLearnClick(item: LearnNavItem) {
    if (item.requiresAuth && !sessionEmail) {
      router.push(`/login?redirect=${encodeURIComponent(item.href)}`);
      return;
    }
    router.push(item.href);
  }

  async function send(text?: string) {
    const toSend = (text ?? input.trim()).trim();
    if (!toSend || loading) return;
    if (!text) setInput("");
    setMessages((m) => [...m, { role: "user", content: toSend }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: toSend }],
          user_email: sessionEmail || undefined,
        }),
      });
      const data = await res.json();
      if (data.reply != null) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.error || "Sorry, I couldn’t reply." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--base)] flex flex-col">
      <header className="border-b border-[var(--divider)] bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-charcoal text-xl">Nihongo Navi</h1>
          <p className="text-secondary text-xs">Your AI Japanese tutor — grammar, vocab, and practice.</p>
        </div>
        <Link href="/learn" className="text-sm text-primary font-medium hover:underline">
          Learn hub →
        </Link>
      </header>

      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Left sidebar: recent questions */}
          <aside className="lg:w-72 lg:flex-shrink-0 space-y-3 hidden lg:block">
            <div className="rounded-bento border border-[var(--divider)] bg-white p-3 space-y-2">
              <h3 className="font-heading text-sm font-semibold text-charcoal flex items-center justify-between">
                Recent questions
              </h3>
              <p className="text-xs text-secondary">
                Public questions when logged out; your history when signed in.
              </p>
              <div className="space-y-1 max-h-[420px] overflow-y-auto border-t border-[var(--divider)] pt-2">
                {history.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => send(item.question)}
                    className="w-full text-left px-2 py-2 rounded-md hover:bg-[var(--base-soft)] transition text-xs text-charcoal border border-transparent hover:border-[var(--divider)]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-medium truncate">
                        {item.user_email ? item.user_email : "Public"}
                      </span>
                      <span className="text-[11px] text-secondary">
                        {item.ask_count}×
                      </span>
                    </div>
                    <div className="text-[11px] line-clamp-2">{item.question}</div>
                  </button>
                ))}
                {history.length === 0 && (
                  <p className="text-xs text-secondary">No questions recorded yet.</p>
                )}
              </div>
            </div>
          </aside>

          {/* Main chat column */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <CorrectSentenceBlock />
              <p className="text-secondary text-sm">
                Or ask anything about Japanese: grammar, vocabulary, kanji, or get practice and corrections.
              </p>
              <p className="text-charcoal text-sm font-medium">Suggested prompts:</p>
              <ul className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => send(prompt)}
                      className="px-3 py-2 rounded-lg bg-white border border-[var(--divider)] text-sm text-charcoal hover:border-primary hover:text-primary transition"
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-bento px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-white text-charcoal border border-[var(--divider)]"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-bento px-4 py-3 text-sm text-secondary border border-[var(--divider)]">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
          </div>

          {/* Right sidebar: Learn hub navigation */}
          <aside className="lg:w-72 lg:flex-shrink-0 space-y-3 hidden lg:block">
            <div className="rounded-bento border border-[var(--divider)] bg-white p-3 space-y-2">
              <h3 className="font-heading text-sm font-semibold text-charcoal">
                Learn hub
              </h3>
              <p className="text-xs text-secondary">
                Browse lessons and tools. Some areas need an account.
              </p>
              <div className="mt-2 pt-2 border-t border-[var(--divider)] space-y-1 max-h-[420px] overflow-y-auto">
                {LEARN_NAV_ITEMS.map((item) => {
                  const isLocked = item.requiresAuth && !sessionEmail;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => handleLearnClick(item)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs text-left border border-transparent hover:border-[var(--divider)] hover:bg-[var(--base-soft)] transition"
                    >
                      <span className="truncate">{item.label}</span>
                      {item.requiresAuth && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-secondary">
                          {isLocked ? "Login" : "Private"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        {showRegisterPrompt && (
          <div className="mt-4 p-4 rounded-bento bg-primary/10 border border-primary/30">
            <p className="text-charcoal text-sm mb-3">
              Create a free account to keep chatting with Nihongo Navi and save your progress.
            </p>
            <Link
              href="/login?redirect=/tutor"
              className="inline-block btn-primary text-sm px-4 py-2 rounded-bento"
            >
              Sign up / Log in
            </Link>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 pt-4 border-t border-[var(--divider)]"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about grammar, vocab, or ask for a correction…"
            className="flex-1 px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none"
            disabled={loading || showRegisterPrompt}
          />
          <button
            type="submit"
            className="btn-primary px-6 py-3 rounded-bento"
            disabled={loading || !input.trim() || showRegisterPrompt}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
