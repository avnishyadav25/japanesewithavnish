"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

type Product = {
    id: string;
    name: string;
    slug: string;
    price_paise: number;
    compare_price_paise: number | null;
    jlpt_level: string | null;
    badge: string | null;
    is_mega: boolean;
    image_url: string | null;
    description: string | null;
};

type View = "table" | "grid" | "gallery";

const LEVEL_COLORS: Record<string, string> = {
    N5: "bg-green-100 text-green-800",
    N4: "bg-yellow-100 text-yellow-800",
    N3: "bg-orange-100 text-orange-800",
    N2: "bg-red-100 text-red-800",
    N1: "bg-purple-100 text-purple-800",
    Mega: "bg-[#FFF7F7] text-primary border border-primary/20",
};

function formatPrice(paise: number) {
    return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function JLPT({ level }: { level: string }) {
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[level] ?? "bg-gray-100 text-gray-700"}`}>
            {level}
        </span>
    );
}

function BadgeChip({ badge }: { badge: string }) {
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge === "premium" ? "bg-[var(--base)] text-gold border border-gold" : "bg-[#FFF7F7] text-primary border border-primary/20"
            }`}>
            {badge}
        </span>
    );
}

function ProductImage({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
    if (!src) {
        return (
            <div
                className="rounded-bento bg-[var(--base)] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[var(--divider)]"
                style={{ width: size, height: size }}
            >
                <span className="japanese-kanji-accent text-xl opacity-30">日</span>
            </div>
        );
    }
    return (
        <div className="relative rounded-bento overflow-hidden flex-shrink-0 border border-[var(--divider)] bg-[var(--base)]" style={{ width: size, height: size }}>
            <Image src={src} alt={name} fill className="object-cover" sizes={`${size}px`} />
        </div>
    );
}

export function ProductListClient({
    products,
}: {
    products: Product[];
}) {
    const [view, setView] = useState<View>("grid");
    const [search, setSearch] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [badgeFilter, setBadgeFilter] = useState("all");

    const levels = ["N5", "N4", "N3", "N2", "N1", "Mega"];

    const stats = {
        total: products.length,
        byLevel: levels.reduce<Record<string, number>>((acc, l) => {
            acc[l] = products.filter((p) => p.jlpt_level === l).length;
            return acc;
        }, {}),
    };

    const filtered = useMemo(() => {
        let p = products;
        if (levelFilter !== "all") p = p.filter((x) => x.jlpt_level === levelFilter);
        if (badgeFilter !== "all") p = p.filter((x) => x.badge === badgeFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            p = p.filter((x) => x.name.toLowerCase().includes(q) || x.slug.includes(q));
        }
        return p;
    }, [products, levelFilter, badgeFilter, search]);

    return (
        <div className="animate-fade-in">
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <div className="card-content col-span-2 sm:col-span-1">
                    <p className="text-secondary text-xs uppercase tracking-wider">Total</p>
                    <p className="font-heading text-2xl font-bold text-charcoal mt-1">{stats.total}</p>
                </div>
                {levels.map((l) => (
                    <div
                        key={l}
                        className="card-content cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                        onClick={() => setLevelFilter(levelFilter === l ? "all" : l)}
                    >
                        <p className="text-secondary text-xs uppercase tracking-wider">{l}</p>
                        <p className="font-heading text-xl font-bold text-charcoal mt-1">{stats.byLevel[l] ?? 0}</p>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products…"
                    className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm text-charcoal bg-white w-48 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white text-charcoal"
                >
                    <option value="all">All JLPT</option>
                    {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select
                    value={badgeFilter}
                    onChange={(e) => setBadgeFilter(e.target.value)}
                    className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white text-charcoal"
                >
                    <option value="all">All badges</option>
                    <option value="offer">Offer</option>
                    <option value="premium">Premium</option>
                </select>
                <p className="text-secondary text-xs">{filtered.length} product{filtered.length !== 1 ? "s" : ""}</p>

                {/* View toggle */}
                <div className="ml-auto flex items-center border border-[var(--divider)] rounded-bento overflow-hidden">
                    {(["table", "grid", "gallery"] as View[]).map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${view === v ? "bg-primary text-white" : "bg-white text-secondary hover:text-primary hover:bg-[var(--base)]"
                                }`}
                        >
                            {v === "table" ? "☰ Table" : v === "grid" ? "⊞ Grid" : "🖼 Gallery"}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-secondary mb-3">No products match your filters.</p>
                    <button onClick={() => { setSearch(""); setLevelFilter("all"); setBadgeFilter("all"); }} className="text-primary text-sm hover:underline">Clear filters</button>
                </div>
            ) : view === "table" ? (
                <TableView products={filtered} />
            ) : view === "grid" ? (
                <GridView products={filtered} />
            ) : (
                <GalleryView products={filtered} />
            )}
        </div>
    );
}

function TableView({ products }: { products: Product[] }) {
    return (
        <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
                <thead className="border-b border-[var(--divider)]">
                    <tr>
                        <th className="py-3 px-3 text-left font-medium text-charcoal w-12"></th>
                        <th className="py-3 px-3 text-left font-medium text-charcoal">Product</th>
                        <th className="py-3 px-3 text-left font-medium text-charcoal">Price</th>
                        <th className="py-3 px-3 text-left font-medium text-charcoal">JLPT</th>
                        <th className="py-3 px-3 text-left font-medium text-charcoal">Badge</th>
                        <th className="py-3 px-3 text-left font-medium text-charcoal">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {products.map((p) => (
                        <tr key={p.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                            <td className="py-2 px-3">
                                <ProductImage src={p.image_url} name={p.name} size={40} />
                            </td>
                            <td className="py-2 px-3">
                                <div>
                                    <span className="font-medium text-charcoal block">
                                        {p.name}
                                        {p.is_mega && <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">MEGA</span>}
                                    </span>
                                    <span className="text-secondary text-xs">{p.slug}</span>
                                </div>
                            </td>
                            <td className="py-2 px-3">
                                <span className="font-medium text-charcoal">{formatPrice(p.price_paise)}</span>
                                {p.compare_price_paise && (
                                    <span className="ml-2 text-secondary text-xs line-through">{formatPrice(p.compare_price_paise)}</span>
                                )}
                            </td>
                            <td className="py-2 px-3">{p.jlpt_level ? <JLPT level={p.jlpt_level} /> : <span className="text-secondary text-xs">—</span>}</td>
                            <td className="py-2 px-3">{p.badge ? <BadgeChip badge={p.badge} /> : <span className="text-secondary text-xs">—</span>}</td>
                            <td className="py-2 px-3">
                                <div className="flex gap-3">
                                    <Link href={`/admin/products/${p.id}/edit`} className="text-primary text-sm hover:underline">Edit</Link>
                                    <Link href={`/product/${p.slug}`} target="_blank" className="text-secondary text-sm hover:underline">View ↗</Link>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function GridView({ products }: { products: Product[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p, i) => (
                <div key={p.id} className="card group" style={{ animationDelay: `${i * 0.04}s` }}>
                    <div className="flex items-start gap-4 mb-3">
                        <ProductImage src={p.image_url} name={p.name} size={56} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-1 mb-1">
                                {p.jlpt_level && <JLPT level={p.jlpt_level} />}
                                {p.badge && <BadgeChip badge={p.badge} />}
                                {p.is_mega && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">MEGA</span>}
                            </div>
                            <h3 className="font-heading font-bold text-charcoal text-sm line-clamp-2">{p.name}</h3>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--divider)]">
                        <div>
                            <span className="font-heading font-bold text-primary">{formatPrice(p.price_paise)}</span>
                            {p.compare_price_paise && (
                                <span className="ml-2 text-secondary text-xs line-through">{formatPrice(p.compare_price_paise)}</span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Link href={`/admin/products/${p.id}/edit`} className="text-primary text-sm hover:underline">Edit</Link>
                            <Link href={`/product/${p.slug}`} target="_blank" className="text-secondary text-sm hover:underline">↗</Link>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function GalleryView({ products }: { products: Product[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p, i) => (
                <div key={p.id} className="card overflow-hidden p-0 group" style={{ animationDelay: `${i * 0.04}s` }}>
                    <div className="relative aspect-video bg-[var(--base)] overflow-hidden">
                        {p.image_url ? (
                            <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                sizes="400px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-5xl japanese-kanji-accent opacity-20">日</span>
                            </div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-1">
                            {p.jlpt_level && <JLPT level={p.jlpt_level} />}
                            {p.badge && <BadgeChip badge={p.badge} />}
                        </div>
                        {p.is_mega && (
                            <div className="absolute top-2 right-2">
                                <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-semibold">MEGA</span>
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        <h3 className="font-heading font-bold text-charcoal text-sm line-clamp-2 mb-1">{p.name}</h3>
                        {p.description && <p className="text-secondary text-xs line-clamp-2 mb-3">{p.description}</p>}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="font-heading font-bold text-primary">{formatPrice(p.price_paise)}</span>
                                {p.compare_price_paise && (
                                    <span className="ml-2 text-secondary text-xs line-through">{formatPrice(p.compare_price_paise)}</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <Link href={`/admin/products/${p.id}/edit`} className="text-primary text-sm hover:underline">Edit</Link>
                                <Link href={`/product/${p.slug}`} target="_blank" className="text-secondary text-sm hover:text-charcoal">↗</Link>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
