"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  relatedSlug?: string | null;
  relatedContentType?: string | null;
  relatedTitle?: string | null;
};
type TutorHistoryItem = {
  question: string;
  answer_preview: string;
  ask_count: number;
  user_email: string | null;
  created_at?: string;
};

const CHAT_MODES = [
  { val: "general", label: "General Tutor", desc: "Normal Japanese help" },
  { val: "correct", label: "Correct Sentence", desc: "Grammar correction" },
  { val: "explain", label: "Explain Grammar", desc: "Explain grammar patterns" },
  { val: "quiz", label: "Quiz Me", desc: "Generate vocabulary or grammar quizzes" },
  { val: "vocab", label: "Vocabulary Builder", desc: "Word meanings & examples" },
  { val: "kanji", label: "Kanji Helper", desc: "Readings, meanings, stroke notes" },
  { val: "reading", label: "Reading Sandbox", desc: "Translate and explain passages" },
  { val: "coach", label: "JLPT Coach", desc: "Study plans and strategies" },
];

const SUGGESTED_GROUPS = [
  {
    category: "Grammar",
    prompts: [
      "Explain the difference between は and が",
      "What does です mean?",
      "Explain Japanese て-form verbs",
    ],
  },
  {
    category: "Practice",
    prompts: [
      "Quiz me on N5 vocabulary words",
      "Give me 5 practice sentences for 食べる",
      "Make a Japanese particles mini test",
    ],
  },
  {
    category: "Correction",
    prompts: [
      "Correct this sentence: 私はりんごを食べます",
      "Make this more natural: 日本語を勉強するです",
    ],
  },
];

export default function TutorPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<TutorHistoryItem[]>([]);
  const [selectedMode, setSelectedMode] = useState("general");
  const [useContext, setUseContext] = useState(true);
  const [msg, setMsg] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch Session & Profile
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setSessionEmail(d?.email ?? null);
        if (d?.email) {
          fetch("/api/profile")
            .then((res) => (res.ok ? res.json() : null))
            .then((pData) => setProfile(pData?.profile ?? null))
            .catch(() => {});
        }
      })
      .catch(() => setSessionEmail(null));
  }, []);

  // Fetch Tutor Logs History
  const fetchHistory = () => {
    const url = sessionEmail
      ? `/api/ai/tutor/history?user_email=${encodeURIComponent(sessionEmail)}`
      : "/api/ai/tutor/history";
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHistory(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setHistory([]));
  };

  useEffect(() => {
    fetchHistory();
  }, [sessionEmail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userMessagesCount = messages.filter((m) => m.role === "user").length;
  const isPremium = profile?.is_lifetime || (profile?.premium_until && new Date(profile.premium_until) > new Date());
  const remainingQuestions = isPremium ? "Unlimited" : Math.max(0, 5 - userMessagesCount);

  // Dynamic history topic tags classifier
  const getTopicTag = (q: string) => {
    const text = q.toLowerCase();
    if (text.includes("grammar") || text.includes("は") || text.includes("が")) return { label: "Grammar", color: "bg-blue-50 text-blue-700" };
    if (text.includes("correct") || text.includes("sentence")) return { label: "Correction", color: "bg-green-50 text-green-700" };
    if (text.includes("quiz") || text.includes("test")) return { label: "Quiz", color: "bg-purple-50 text-purple-700" };
    if (text.includes("vocab") || text.includes("word")) return { label: "Vocab", color: "bg-amber-50 text-[#C8A35F]" };
    if (text.includes("kanji")) return { label: "Kanji", color: "bg-red-50 text-primary" };
    if (text.includes("read") || text.includes("text")) return { label: "Reading", color: "bg-teal-50 text-teal-700" };
    return { label: "General", color: "bg-gray-50 text-secondary" };
  };

  async function send(text?: string) {
    const toSend = (text ?? input.trim()).trim();
    if (!toSend || loading) return;
    if (!text) setInput("");

    setMessages((m) => [...m, { role: "user", content: toSend, mode: selectedMode }]);
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: toSend }],
          user_email: sessionEmail || undefined,
          mode: selectedMode,
          use_context: useContext,
        }),
      });
      const data = await res.json();
      if (data.reply != null) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.reply,
            relatedSlug: data.relatedSlug ?? null,
            relatedContentType: data.relatedContentType ?? null,
            relatedTitle: data.relatedTitle ?? null,
          },
        ]);
        fetchHistory();
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.error || "Sorry, I couldn’t reply." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear your chat history logs?")) return;
    setHistory([]);
  };

  const handleCopy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setMsg("✅ Copied to clipboard!");
    setTimeout(() => setMsg(""), 2000);
  };

  const handleSaveToReview = async (question: string, answer: string, asFlashcard: boolean) => {
    if (!sessionEmail) {
      router.push(`/login?redirect=/tutor`);
      return;
    }
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          itemType: asFlashcard ? "tutor_flashcard" : "tutor_note",
          snapshotTitle: question.slice(0, 200),
          snapshotContent: `Q: ${question}\n\nA: ${answer}`,
        }),
      });
      if (!res.ok) throw new Error();
      setMsg(asFlashcard ? "✅ Flashcard created!" : "✅ Saved to review queue!");
    } catch {
      setMsg("Couldn't save that right now. Try again.");
    } finally {
      setTimeout(() => setMsg(""), 2500);
    }
  };

  const handleReportIssue = async (question: string, answer: string) => {
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: sessionEmail || "",
          message: `Reported from Nihongo Navi.\nQ: ${question}\nA: ${answer}`.slice(0, 2000),
        }),
      });
      if (!res.ok) throw new Error();
      setMsg("✅ Thanks — reported to the team.");
    } catch {
      setMsg("Couldn't submit the report. Try again.");
    } finally {
      setTimeout(() => setMsg(""), 2500);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex bg-[#FAF8F5] overflow-hidden page-enter">
      
      {/* 1. Left Sidebar: Recent Chats */}
      <aside className="w-72 bg-white border-r border-[var(--divider)] flex flex-col justify-between hidden md:flex shrink-0">
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-black text-xs text-charcoal uppercase tracking-wider">Recent Chats</h3>
            <button
              onClick={() => setMessages([])}
              className="text-[10px] font-bold text-primary hover:underline"
            >
              + New Chat
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--divider)]">
            {history.map((item, idx) => {
              const tag = getTopicTag(item.question);
              return (
                <button
                  key={idx}
                  onClick={() => send(item.question)}
                  className="w-full text-left p-3 border border-[var(--divider)] hover:border-primary/20 rounded-2xl hover:bg-[var(--base)] transition-all space-y-1 block"
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${tag.color}`}>
                      {tag.label}
                    </span>
                    <span className="text-[9px] text-secondary font-semibold">{item.ask_count}×</span>
                  </div>
                  <p className="text-xs text-charcoal font-semibold truncate mt-1">{item.question}</p>
                </button>
              );
            })}

            {history.length === 0 && (
              <p className="text-secondary text-[11px] text-center py-6">No recent queries.</p>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="p-4 border-t border-[var(--divider)]">
            <button
              onClick={handleClearHistory}
              className="w-full py-2 border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-bold font-heading rounded-xl transition"
            >
              Clear History
            </button>
          </div>
        )}
      </aside>

      {/* 2. Center: Main Chat Panel */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        
        {/* Tutor workspace Header */}
        <div className="bg-white border-b border-[var(--divider)] p-4 flex items-center justify-between shadow-xs">
          <div>
            <h1 className="font-heading font-black text-sm text-charcoal">Nihongo Navi</h1>
            <p className="text-secondary text-[10px]">Your AI Japanese tutor for grammar, vocabulary, kanji, and JLPT practice.</p>
          </div>
          <div>
            {isPremium ? (
              <span className="text-[10px] font-bold bg-[#FAF8F5] border border-[#C8A35F] text-[#C8A35F] px-3 py-1 rounded-full uppercase tracking-wider">
                ★ Premium Active
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-[#FFF7F7] text-primary px-3 py-1 rounded-full uppercase tracking-wider">
                Free: {remainingQuestions} questions left
              </span>
            )}
          </div>
        </div>

        {msg && (
          <div className="mx-6 mt-4 p-3 bg-white border border-[var(--divider)] rounded-xl text-center text-xs font-semibold text-charcoal shadow-sm">
            {msg}
          </div>
        )}

        {/* Scrollable message timeline */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto space-y-6 pt-4">
              
              {/* Welcoming Empty State Card */}
              <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 shadow-sm text-center space-y-2">
                <span className="text-3xl block">こんにちは 👋</span>
                <h3 className="font-heading font-black text-base text-charcoal">I&apos;m Nihongo Navi</h3>
                <p className="text-secondary text-xs leading-relaxed max-w-sm mx-auto">
                  Ask me anything about Japanese particles, grammar rules, vocabulary definitions, or paste a sentence for instant correction.
                </p>
              </div>

              {/* Grouped suggested prompt chips */}
              <div className="space-y-4">
                {SUGGESTED_GROUPS.map((group) => (
                  <div key={group.category} className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase text-secondary tracking-wider">
                      {group.category} Assistance
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {group.prompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => send(prompt)}
                          className="px-3.5 py-2 bg-white border border-[var(--divider)] hover:border-primary/30 rounded-2xl text-xs text-charcoal font-medium hover:bg-[var(--base)] transition-colors text-left"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={i}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-xs shadow-sm leading-relaxed ${
                        isUser
                          ? "bg-primary text-white"
                          : "bg-white text-charcoal border border-[var(--divider)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {!isUser && (
                        <div className="mt-3.5 pt-2 border-t border-[var(--divider)] flex flex-wrap gap-3 text-[10px] font-bold text-secondary">
                          <button
                            onClick={() => handleCopy(msg.content)}
                            className="hover:text-primary transition-colors"
                          >
                            Copy Response
                          </button>
                          <button
                            onClick={() => send(`Give me practice drills for: ${msg.content.slice(0, 40)}...`)}
                            className="hover:text-primary transition-colors"
                          >
                            Practice Again
                          </button>
                          <button
                            onClick={() => handleSaveToReview(messages[i - 1]?.content ?? "", msg.content, false)}
                            className="hover:text-primary transition-colors"
                          >
                            Save to Review
                          </button>
                          <button
                            onClick={() => handleSaveToReview(messages[i - 1]?.content ?? "", msg.content, true)}
                            className="hover:text-primary transition-colors"
                          >
                            Create Flashcard
                          </button>
                          {msg.relatedSlug && msg.relatedContentType && (
                            <Link
                              href={`/learn/${msg.relatedContentType}/${msg.relatedSlug}`}
                              className="hover:text-primary transition-colors"
                            >
                              Open Related Lesson{msg.relatedTitle ? `: ${msg.relatedTitle}` : ""}
                            </Link>
                          )}
                          <button
                            onClick={() => handleReportIssue(messages[i - 1]?.content ?? "", msg.content)}
                            className="hover:text-primary transition-colors"
                          >
                            Report an Issue
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[var(--divider)] rounded-3xl px-5 py-3.5 text-xs text-secondary shadow-sm">
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.4s]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Sticky Composer Controls Panel */}
        <div className="bg-white border-t border-[var(--divider)] p-4 shadow-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="max-w-3xl mx-auto space-y-3"
          >
            {/* Mode selection + toggle triggers */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-secondary font-bold">
              <div className="flex items-center gap-2">
                <span>MODE:</span>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="bg-[#FAF8F5] border border-[var(--divider)] rounded-lg px-2.5 py-1 text-[10px] font-bold text-charcoal focus:outline-none"
                >
                  {CHAT_MODES.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.label} ({m.desc})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="ctxToggle"
                  checked={useContext}
                  onChange={(e) => setUseContext(e.target.checked)}
                  className="h-3 w-3 text-primary rounded"
                />
                <label htmlFor="ctxToggle" className="cursor-pointer">Use my current lesson as context</label>
              </div>
            </div>

            {/* Input fields row */}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Nihongo Navi about grammar, vocab, kanji, or sentence correction..."
                className="flex-1 h-11 px-4 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:border-primary focus:outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-primary h-11 px-6 rounded-xl text-xs font-bold font-heading shrink-0"
              >
                Send
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* 3. Right Sidebar: Learning Tools & Context panels */}
      <aside className="w-72 bg-white border-l border-[var(--divider)] p-4 space-y-5 hidden lg:block overflow-y-auto shrink-0">
        
        {/* Learning Tools List */}
        <div className="space-y-3">
          <h3 className="font-heading font-black text-xs text-charcoal uppercase tracking-wider">Learning Tools</h3>
          <div className="space-y-1.5 pt-2 border-t border-[var(--divider)] text-xs font-bold text-secondary">
            {[
              { href: "/learn/curriculum", label: "Curriculum" },
              { href: "/learn/dashboard", label: "My Dashboard" },
              { href: "/review", label: "Review Tasks", premium: true },
              { href: "/learn/grammar", label: "Grammar Path" },
              { href: "/learn/vocabulary", label: "Vocabulary" },
              { href: "/learn/kanji", label: "Kanji Portal" },
              { href: "/learn/reading/sandbox", label: "Reading Sandbox", premium: true },
              { href: "/quiz", label: "Placement Quiz" },
            ].map((tool) => (
              <button
                key={tool.href}
                onClick={() => router.push(tool.href)}
                className="w-full flex justify-between items-center p-2 hover:bg-[var(--base)] rounded-xl transition-colors border border-transparent hover:border-[var(--divider)] text-left"
              >
                <span>{tool.label}</span>
                {tool.premium && (
                  <span className="text-[9px] uppercase tracking-wider font-bold text-[#C8A35F]">Premium</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* AI Limit status card */}
        <div className="bg-[#FAF8F5] border border-[var(--divider)] rounded-3xl p-4 space-y-2">
          <h4 className="font-heading font-bold text-xs text-charcoal">AI Tutor Quota</h4>
          {isPremium ? (
            <p className="text-secondary text-[11px] leading-relaxed">
              ★ Premium Access Active. You have unlimited questions and prioritize tutoring helpers.
            </p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-secondary text-[11px] leading-relaxed">
                Free accounts have a limit of 5 AI questions per day. Upgrade to bypass daily limits completely.
              </p>
              <button
                onClick={() => router.push("/#pricing")}
                className="w-full py-2 bg-primary text-white rounded-xl text-[10px] font-bold font-heading text-center shadow-xs block"
              >
                Upgrade to Premium
              </button>
            </div>
          )}
        </div>

        {/* Current Lesson context stats */}
        <div className="bg-[#FAF8F5] border border-[var(--divider)] rounded-3xl p-4 space-y-3">
          <h4 className="font-heading font-bold text-xs text-charcoal">Study Context</h4>
          <dl className="text-[11px] space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-secondary">Current level:</dt>
              <dd className="font-bold text-charcoal">{profile?.recommended_level || "N5"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-secondary">Target level:</dt>
              <dd className="font-bold text-charcoal">{profile?.target_level || "N5"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-secondary">XP / Points:</dt>
              <dd className="font-bold text-primary">{profile?.xp || 0} XP</dd>
            </div>
          </dl>
        </div>

      </aside>

    </div>
  );
}
export const dynamic = "force-dynamic";
