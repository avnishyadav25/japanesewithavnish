"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import type { JLPTLevel } from "@/data/jlpt-levels";

const TYPE_PILLS = [
  { id: "all", label: "All" },
  { id: "grammar", label: "Grammar" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "kanji", label: "Kanji" },
  { id: "reading", label: "Reading" },
  { id: "listening", label: "Listening" },
  { id: "tips", label: "Tips/Roadmap" },
] as const;

type Post = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  jlpt_level?: string[] | null;
  tags?: string[] | null;
  published_at?: string | null;
};

interface JLPTLessonsSectionProps {
  level: JLPTLevel;
  initialPosts: Post[];
  pinnedSlugs: string[];
}

function matchesType(post: Post, type: string): boolean {
  if (type === "all") return true;
  const tags = (post.tags || []).map((t) => t.toLowerCase());
  const typeNorm = type === "vocab" ? "vocabulary" : type;
  return tags.some((t) => t.includes(typeNorm) || t.includes("roadmap"));
}

function matchesSearch(post: Post, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    (post.title || "").toLowerCase().includes(lower) ||
    (post.summary || "").toLowerCase().includes(lower) ||
    (post.tags || []).some((t) => t.toLowerCase().includes(lower))
  );
}

export function JLPTLessonsSection({
  level,
  initialPosts,
  pinnedSlugs,
}: JLPTLessonsSectionProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (level) {
      setLoading(true);
      fetch(`/api/posts?level=${level}&type=all`)
        .then((r) => r.json())
        .then((d) => {
          setPosts(d.posts || []);
        })
        .finally(() => setLoading(false));
    }
  }, [level]);

  const filtered = useMemo(() => {
    return posts.filter(
      (p) => matchesType(p, typeFilter) && matchesSearch(p, search)
    );
  }, [posts, typeFilter, search]);

  const pinned = useMemo(() => {
    if (pinnedSlugs.length === 0) {
      return filtered.slice(0, 3);
    }
    const ordered: Post[] = [];
    for (const slug of pinnedSlugs) {
      const p = filtered.find((x) => x.slug === slug);
      if (p) ordered.push(p);
    }
    return ordered;
  }, [filtered, pinnedSlugs]);

  const rest = useMemo(() => {
    const pinnedIds = new Set(pinned.map((p) => p.id));
    return filtered.filter((p) => !pinnedIds.has(p.id)).slice(0, 9);
  }, [filtered, pinned]);

  const levelLabel = level === "mega" ? "All Levels" : level.toUpperCase();

  return (
    <section id="lessons" className="scroll-mt-8">
      <h2 className="font-heading text-2xl font-bold text-charcoal mb-4">
        Lessons for {levelLabel}
      </h2>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search grammar, kanji, vocab…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-[var(--divider)] rounded-md text-charcoal placeholder:text-secondary"
        />
        <div className="flex flex-wrap gap-2">
          {TYPE_PILLS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setTypeFilter(p.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                typeFilter === p.id
                  ? "bg-primary text-white"
                  : "bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-secondary text-sm">Loading…</p>
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="mb-6">
              <p className="text-secondary text-sm font-medium mb-3">
                Recommended for this level
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                {pinned.map((post) => (
                  <LessonCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {rest.map((post) => (
              <LessonCard key={post.id} post={post} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-secondary text-sm py-8">No lessons match your filters.</p>
          )}
        </>
      )}
    </section>
  );
}

function LessonCard({ post }: { post: Post }) {
  const tags = (post.tags || []).slice(0, 2);
  const jlptTag = Array.isArray(post.jlpt_level)
    ? post.jlpt_level[0]
    : post.jlpt_level;
  const displayTags = jlptTag ? [jlptTag, ...tags.filter((t) => t !== jlptTag)] : tags;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="card p-4 block hover:no-underline group"
    >
      <h3 className="font-heading font-bold text-charcoal mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {post.title}
      </h3>
      {post.summary && (
        <p className="text-secondary text-sm mb-2 line-clamp-2">{post.summary}</p>
      )}
      {displayTags.length > 0 && (
        <p className="text-xs text-secondary mb-2">
          {displayTags.join(" • ")}
        </p>
      )}
      <span className="text-primary text-sm font-medium">Read →</span>
    </Link>
  );
}
