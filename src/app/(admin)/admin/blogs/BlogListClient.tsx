"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useMemo } from "react";
import { isLearnContent } from "@/lib/blog-filters";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";

type Post = {
    id: string;
    slug: string;
    title: string;
    status: string;
    published_at: string | null;
    jlpt_level: string[] | string | null;
    og_image_url?: string | null;
    summary?: string | null;
    content_type?: string | null;
    created_at?: string;
    updated_at?: string;
};

type SortBy = "title" | "content_type" | "updated_at" | "created_at" | "published_at" | "status";
type SortDir = "asc" | "desc";

function formatDate(s: string | null | undefined) {
    if (!s) return "—";
    return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type View = "table" | "grid" | "gallery";

const LEVEL_COLORS: Record<string, string> = {
    N5: "bg-green-100 text-green-800",
    N4: "bg-yellow-100 text-yellow-800",
    N3: "bg-orange-100 text-orange-800",
    N2: "bg-red-100 text-red-800",
    N1: "bg-purple-100 text-purple-800",
};

function LevelBadge({ level }: { level: string }) {
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[level] ?? "bg-gray-100 text-gray-700"}`}>
            {level}
        </span>
    );
}

function StatusDot({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${status === "published" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-700"
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === "published" ? "bg-green-500" : "bg-yellow-500"}`} />
            {status === "published" ? "Published" : "Draft"}
        </span>
    );
}

export function BlogListClient({
    posts,
    stats,
}: {
    posts: Post[];
    stats: { total: number; published: number; draft: number; thisMonth: number };
}) {
    const [view, setView] = useState<View>("table");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
    const [levelFilter, setLevelFilter] = useState("all");
    const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [sortBy, setSortBy] = useState<SortBy>("created_at");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const filtered = useMemo(() => {
        let p = posts;
        if (statusFilter !== "all") p = p.filter((x) => x.status === statusFilter);
        if (levelFilter !== "all") {
            p = p.filter((x) => {
                const levels = Array.isArray(x.jlpt_level) ? x.jlpt_level : x.jlpt_level ? [x.jlpt_level] : [];
                return levels.includes(levelFilter);
            });
        }
        if (contentTypeFilter !== "all") {
            if (contentTypeFilter === "blog") {
                p = p.filter((x) => !x.content_type || x.content_type === "blog");
            } else {
                p = p.filter((x) => (x.content_type ?? "").toLowerCase() === contentTypeFilter.toLowerCase());
            }
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            p = p.filter((x) => x.title.toLowerCase().includes(q) || x.slug.includes(q));
        }
        return p;
    }, [posts, statusFilter, levelFilter, contentTypeFilter, search]);

    const sorted = useMemo(() => {
        const list = [...filtered];
        const mult = sortDir === "asc" ? 1 : -1;
        list.sort((a, b) => {
            let va: string | number | null = null;
            let vb: string | number | null = null;
            if (sortBy === "title") {
                va = a.title ?? "";
                vb = b.title ?? "";
            } else if (sortBy === "content_type") {
                va = (a.content_type ?? "blog") as string;
                vb = (b.content_type ?? "blog") as string;
            } else if (sortBy === "updated_at") {
                va = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                vb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            } else if (sortBy === "created_at") {
                va = a.created_at ? new Date(a.created_at).getTime() : 0;
                vb = b.created_at ? new Date(b.created_at).getTime() : 0;
            } else if (sortBy === "published_at") {
                va = a.published_at ? new Date(a.published_at).getTime() : 0;
                vb = b.published_at ? new Date(b.published_at).getTime() : 0;
            } else if (sortBy === "status") {
                va = a.status ?? "";
                vb = b.status ?? "";
            }
            if (va === null || vb === null) return 0;
            if (typeof va === "number" && typeof vb === "number") return mult * (va - vb);
            return mult * String(va).localeCompare(String(vb));
        });
        return list;
    }, [filtered, sortBy, sortDir]);

    function toggleSort(col: SortBy) {
        setSortBy(col);
        setSortDir((d) => (sortBy === col ? (d === "asc" ? "desc" : "asc") : "desc"));
    }

    function toggleSelect(id: string) {
        setSelected((s) => {
            const n = new Set(s);
            if (n.has(id)) { n.delete(id); } else { n.add(id); }
            return n;
        });
    }

    function toggleAll() {
        if (selected.size === filtered.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map((p) => p.id)));
        }
    }

    async function bulkDelete() {
        if (selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} post${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
        setBulkLoading(true);
        await Promise.all(
            Array.from(selected).map((id) => {
                const post = posts.find((p) => p.id === id);
                if (!post) return Promise.resolve();
                if (isLearnContent(post.content_type)) {
                    return fetch(`/api/admin/learning-content/${post.content_type}/${post.slug}`, { method: "DELETE" });
                }
                return fetch(`/api/admin/posts/${post.slug}`, { method: "DELETE" });
            })
        );
        setSelected(new Set());
        setBulkLoading(false);
        window.location.reload();
    }

    async function bulkPublish(status: "published" | "draft") {
        if (selected.size === 0) return;
        setBulkLoading(true);
        await Promise.all(
            Array.from(selected).map(async (id) => {
                const post = posts.find((p) => p.id === id);
                if (!post) return;
                if (isLearnContent(post.content_type)) {
                    const res = await fetch(`/api/admin/learning-content/${post.content_type}/${post.slug}`);
                    if (!res.ok) return;
                    const full = await res.json();
                    return fetch(`/api/admin/learning-content/${post.content_type}/${post.slug}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...full, status }),
                    });
                }
                return fetch(`/api/admin/posts/${post.slug}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...post, status }),
                });
            })
        );
        setSelected(new Set());
        setBulkLoading(false);
        window.location.reload();
    }

    return (
        <div className="animate-fade-in">
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Total Posts", value: stats.total, color: "text-charcoal" },
                    { label: "Published", value: stats.published, color: "text-green-700" },
                    { label: "Drafts", value: stats.draft, color: "text-yellow-700" },
                    { label: "This Month", value: stats.thisMonth, color: "text-primary" },
                ].map((s, i) => (
                    <div key={s.label} className="card-content" style={{ animationDelay: `${i * 0.06}s` }}>
                        <p className="text-secondary text-xs uppercase tracking-wider">{s.label}</p>
                        <p className={`font-heading text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Search */}
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search posts…"
                    className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm text-charcoal bg-white w-48 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />

                {/* Status filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | "published" | "draft")}
                    className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm text-charcoal bg-white"
                >
                    <option value="all">All statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                </select>

                {/* Level filter */}
                <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm text-charcoal bg-white"
                >
                    <option value="all">All levels</option>
                    {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                        <option key={l} value={l}>{l}</option>
                    ))}
                </select>

                {/* Content type filter */}
                <select
                    value={contentTypeFilter}
                    onChange={(e) => setContentTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm text-charcoal bg-white"
                >
                    <option value="all">All content types</option>
                    <option value="blog">Blog</option>
                    {LEARN_CONTENT_TYPES.map((t) => (
                        <option key={t} value={t}>{LEARN_TYPE_LABELS[t as LearnContentType]}</option>
                    ))}
                </select>

                {/* Bulk actions */}
                {selected.size > 0 && (
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-[var(--divider)]">
                        <span className="text-sm text-secondary">{selected.size} selected</span>
                        <button
                            onClick={() => bulkPublish("published")}
                            disabled={bulkLoading}
                            className="text-sm text-green-700 hover:underline"
                        >
                            Publish
                        </button>
                        <button
                            onClick={() => bulkPublish("draft")}
                            disabled={bulkLoading}
                            className="text-sm text-yellow-700 hover:underline"
                        >
                            Unpublish
                        </button>
                        <button
                            onClick={bulkDelete}
                            disabled={bulkLoading}
                            className="text-sm text-red-600 hover:underline"
                        >
                            Delete
                        </button>
                    </div>
                )}

                {/* View toggle — pushed right */}
                <div className="ml-auto flex items-center border border-[var(--divider)] rounded-bento overflow-hidden">
                    {(["table", "grid", "gallery"] as View[]).map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${view === v
                                ? "bg-primary text-white"
                                : "bg-white text-secondary hover:text-primary hover:bg-[var(--base)]"
                                }`}
                        >
                            {v === "table" ? "☰ Table" : v === "grid" ? "⊞ Grid" : "🖼 Gallery"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results count */}
            <p className="text-secondary text-xs mb-3">
                {filtered.length} post{filtered.length !== 1 ? "s" : ""}
                {search || statusFilter !== "all" || levelFilter !== "all" || contentTypeFilter !== "all" ? " matching filters" : ""}
            </p>

            {/* Views */}
            {filtered.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-secondary mb-4">No posts match your filters.</p>
                    <button
                        onClick={() => { setSearch(""); setStatusFilter("all"); setLevelFilter("all"); setContentTypeFilter("all"); }}
                        className="text-primary hover:underline text-sm"
                    >
                        Clear filters
                    </button>
                </div>
            ) : view === "table" ? (
                <TableView posts={sorted} selected={selected} onToggle={toggleSelect} onToggleAll={toggleAll} sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            ) : view === "grid" ? (
                <GridView posts={sorted} selected={selected} onToggle={toggleSelect} />
            ) : (
                <GalleryView posts={sorted} selected={selected} onToggle={toggleSelect} />
            )}
        </div>
    );
}

function SortableTh({
    label, col, sortBy, sortDir, onSort,
}: { label: string; col: SortBy; sortBy: SortBy; sortDir: SortDir; onSort: (c: SortBy) => void }) {
    const active = sortBy === col;
    return (
        <th className="py-3 px-3 text-left font-medium text-charcoal whitespace-nowrap">
            <button type="button" onClick={() => onSort(col)} className="hover:text-primary flex items-center gap-1">
                {label}
                {active && <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>}
            </button>
        </th>
    );
}

function TableView({
    posts, selected, onToggle, onToggleAll, sortBy, sortDir, onSort,
}: {
    posts: Post[];
    selected: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: () => void;
    sortBy: SortBy;
    sortDir: SortDir;
    onSort: (col: SortBy) => void;
}) {
    return (
        <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
                <thead className="border-b border-[var(--divider)]">
                    <tr>
                        <th className="py-3 px-3 text-left w-8">
                            <input
                                type="checkbox"
                                checked={selected.size === posts.length && posts.length > 0}
                                onChange={onToggleAll}
                                className="accent-primary"
                            />
                        </th>
                        <th className="py-3 px-3 text-left font-medium text-charcoal w-16">Image</th>
                        <th className="py-3 px-3 text-left font-medium text-charcoal">Title</th>
                        <SortableTh label="Content type" col="content_type" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                        <th className="py-3 px-3 text-left font-medium text-charcoal">Status</th>
                        <th className="py-3 px-3 text-left font-medium text-charcoal">JLPT</th>
                        <SortableTh label="Published" col="published_at" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                        <SortableTh label="Last modified" col="updated_at" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                        <SortableTh label="Created" col="created_at" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                        <th className="py-3 px-3 text-left font-medium text-charcoal">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {posts.map((p) => {
                        const levels = Array.isArray(p.jlpt_level)
                            ? p.jlpt_level
                            : p.jlpt_level
                                ? [p.jlpt_level]
                                : [];
                        return (
                            <tr
                                key={p.id}
                                className={`border-b border-[var(--divider)] transition-colors ${selected.has(p.id) ? "bg-primary/5" : "hover:bg-[var(--base)]"
                                    }`}
                            >
                                <td className="py-2 px-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(p.id)}
                                        onChange={() => onToggle(p.id)}
                                        className="accent-primary"
                                    />
                                </td>
                                <td className="py-2 px-3">
                                    {p.og_image_url ? (
                                        <span className="relative block w-12 h-12 rounded overflow-hidden bg-[var(--base)] shrink-0">
                                            <Image
                                                src={p.og_image_url}
                                                alt=""
                                                width={48}
                                                height={48}
                                                className="object-cover w-full h-full"
                                                unoptimized={p.og_image_url.startsWith("http")}
                                            />
                                        </span>
                                    ) : (
                                        <span className="w-12 h-12 rounded bg-[var(--divider)] flex items-center justify-center text-secondary text-xs">—</span>
                                    )}
                                </td>
                                <td className="py-2 px-3 font-medium text-charcoal max-w-xs">
                                    <span className="line-clamp-1">{p.title}</span>
                                    <span className="text-secondary text-xs block">{p.slug}</span>
                                </td>
                                <td className="py-2 px-3 text-secondary text-xs capitalize">{p.content_type ?? "blog"}</td>
                                <td className="py-2 px-3"><StatusDot status={p.status} /></td>
                                <td className="py-2 px-3">
                                    <div className="flex flex-wrap gap-1">
                                        {levels.map((l) => <LevelBadge key={l} level={l} />)}
                                        {levels.length === 0 && <span className="text-secondary text-xs">—</span>}
                                    </div>
                                </td>
                                <td className="py-2 px-3 text-secondary text-xs">
                                    {p.published_at ? formatDate(p.published_at) : "—"}
                                </td>
                                <td className="py-2 px-3 text-secondary text-xs">{formatDate(p.updated_at)}</td>
                                <td className="py-2 px-3 text-secondary text-xs">{formatDate(p.created_at)}</td>
                                <td className="py-2 px-3">
                                    <div className="flex gap-3">
                                        <Link href={`/admin/blogs/${p.slug}/edit`} className="text-primary text-sm hover:underline">Edit</Link>
                                        <Link href={`/admin/blogs/${p.slug}/comments`} className="text-secondary text-sm hover:underline">Comments</Link>
                                        {p.status === "published" && (
                                            <Link href={isLearnContent(p.content_type) ? `/blog/${p.content_type}/${p.slug}` : `/blog/${p.slug}`} target="_blank" className="text-secondary text-sm hover:underline">↗ View</Link>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function GridView({
    posts, selected, onToggle,
}: {
    posts: Post[];
    selected: Set<string>;
    onToggle: (id: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((p, i) => {
                const levels = Array.isArray(p.jlpt_level) ? p.jlpt_level : p.jlpt_level ? [p.jlpt_level] : [];
                return (
                    <div
                        key={p.id}
                        className={`card relative group cursor-pointer transition-all ${selected.has(p.id) ? "ring-2 ring-primary" : ""}`}
                        style={{ animationDelay: `${i * 0.04}s` }}
                        onClick={() => onToggle(p.id)}
                    >
                        <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => onToggle(p.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-3 right-3 accent-primary z-10"
                        />
                        {p.og_image_url ? (
                            <div className="relative w-full aspect-video mb-2 rounded-t overflow-hidden bg-[var(--base)]">
                                <Image
                                    src={p.og_image_url}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    unoptimized={p.og_image_url.startsWith("http")}
                                    sizes="(max-width: 640px) 100vw, 33vw"
                                />
                            </div>
                        ) : (
                            <div className="w-full aspect-video mb-2 rounded-t bg-[var(--divider)]" />
                        )}
                        <div className="flex flex-wrap gap-1 mb-2 px-1">
                            {levels.map((l) => <LevelBadge key={l} level={l} />)}
                            <StatusDot status={p.status} />
                        </div>
                        <h3 className="font-heading font-bold text-charcoal text-sm line-clamp-2 mb-1 px-1">{p.title}</h3>
                        {p.summary && <p className="text-secondary text-xs line-clamp-2 mb-3">{p.summary}</p>}
                        <div className="flex gap-3 mt-auto pt-2 border-t border-[var(--divider)]">
                            <Link
                                href={`/admin/blogs/${p.slug}/edit`}
                                className="text-primary text-xs hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Edit
                            </Link>
                            <Link
                                href={`/admin/blogs/${p.slug}/comments`}
                                className="text-secondary text-xs hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Comments
                            </Link>
                            {p.status === "published" && (
                                <Link
                                    href={isLearnContent(p.content_type) ? `/blog/${p.content_type}/${p.slug}` : `/blog/${p.slug}`}
                                    target="_blank"
                                    className="text-secondary text-xs hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    View ↗
                                </Link>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function GalleryView({
    posts, selected, onToggle,
}: {
    posts: Post[];
    selected: Set<string>;
    onToggle: (id: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((p, i) => {
                const levels = Array.isArray(p.jlpt_level) ? p.jlpt_level : p.jlpt_level ? [p.jlpt_level] : [];
                return (
                    <div
                        key={p.id}
                        className={`card overflow-hidden p-0 group cursor-pointer transition-all ${selected.has(p.id) ? "ring-2 ring-primary" : ""}`}
                        style={{ animationDelay: `${i * 0.04}s` }}
                        onClick={() => onToggle(p.id)}
                    >
                        {/* Image */}
                        <div className="relative aspect-video bg-[var(--base)] overflow-hidden">
                            {p.og_image_url ? (
                                <img
                                    src={p.og_image_url}
                                    alt={p.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-4xl opacity-20 japanese-kanji-accent">文</span>
                                </div>
                            )}
                            <input
                                type="checkbox"
                                checked={selected.has(p.id)}
                                onChange={() => onToggle(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-2 right-2 accent-primary"
                            />
                            <div className="absolute bottom-2 left-2">
                                <StatusDot status={p.status} />
                            </div>
                        </div>

                        {/* Info */}
                        <div className="p-4">
                            <div className="flex flex-wrap gap-1 mb-2">
                                {levels.map((l) => <LevelBadge key={l} level={l} />)}
                            </div>
                            <h3 className="font-heading font-semibold text-charcoal text-sm line-clamp-2 mb-3">{p.title}</h3>
                            <div className="flex gap-3">
                                <Link
                                    href={`/admin/blogs/${p.slug}/edit`}
                                    className="text-primary text-xs hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Edit
                                </Link>
                                <Link
                                    href={`/admin/blogs/${p.slug}/comments`}
                                    className="text-secondary text-xs hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Comments
                                </Link>
                                {p.status === "published" && (
                                    <Link
                                        href={isLearnContent(p.content_type) ? `/blog/${p.content_type}/${p.slug}` : `/blog/${p.slug}`}
                                        target="_blank"
                                        className="text-secondary text-xs hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        View ↗
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
