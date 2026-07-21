"use client";

import { useEffect, useState } from "react";

type ActivityEvent = {
  type: "tutor_chat" | "lesson_progress" | "srs_review" | "reward" | "login";
  timestamp: string;
  summary: string;
  detail?: string | null;
};

const TYPE_LABELS: Record<ActivityEvent["type"], string> = {
  tutor_chat: "Tutor chat",
  lesson_progress: "Lesson progress",
  srs_review: "SRS review",
  reward: "XP / points",
  login: "Login",
};

const TYPE_COLORS: Record<ActivityEvent["type"], string> = {
  tutor_chat: "bg-blue-50 text-blue-700 border-blue-200",
  lesson_progress: "bg-emerald-50 text-emerald-700 border-emerald-200",
  srs_review: "bg-amber-50 text-amber-700 border-amber-200",
  reward: "bg-primary/5 text-primary border-primary/20",
  login: "bg-[var(--base)] text-secondary border-[var(--divider)]",
};

/** Merged activity trace panel for the admin user-detail page (decision #7): tutor chat, lesson
 * progress, SRS review, XP/points changes, and login history in one chronological feed, with a
 * type filter since a very active learner's feed can get long. */
export function UserActivityTrace({ email }: { email: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityEvent["type"] | "all">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/students/${encodeURIComponent(email)}/activity`)
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [email]);

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${filter === "all" ? "bg-charcoal text-white border-charcoal" : "border-[var(--divider)] text-secondary"}`}
        >
          All
        </button>
        {(Object.keys(TYPE_LABELS) as ActivityEvent["type"][]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${filter === t ? "bg-charcoal text-white border-charcoal" : "border-[var(--divider)] text-secondary"}`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <p className="text-xs text-secondary">Loading…</p>}
      {!loading && filtered.length === 0 && <p className="text-xs text-secondary italic">No activity recorded yet.</p>}

      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {filtered.map((e, i) => (
          <div key={i} className="text-xs border border-[var(--divider)] rounded-xl px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${TYPE_COLORS[e.type]}`}>
                {TYPE_LABELS[e.type]}
              </span>
              <span className="text-secondary text-[10px] shrink-0">{new Date(e.timestamp).toLocaleString()}</span>
            </div>
            <p className="text-charcoal mt-1">{e.summary}</p>
            {e.detail && <p className="text-secondary text-[10px] mt-0.5">{e.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
