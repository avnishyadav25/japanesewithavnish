"use client";

import { motion } from "framer-motion";
import type { BundleItem } from "@/data/bundle-contents";

interface BundleContentsTreeProps {
  items: BundleItem[];
  titleJa?: string;
  titleEn?: string;
}

function isPdf(name: string) {
  return name.endsWith(".pdf");
}

function TreeItem({ item, index }: { item: BundleItem; index: number }) {
  const isFile = isPdf(item.name);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="flex items-center gap-2 py-1.5 text-sm text-charcoal"
    >
      <span className="text-secondary shrink-0">
        {isFile ? "📄" : "📁"}
      </span>
      <span>{item.name}</span>
    </motion.div>
  );
}

export function BundleContentsTree({ items, titleJa = "内容", titleEn = "What's Inside" }: BundleContentsTreeProps) {
  return (
    <div className="card-content japanese-shoji-border">
      <div className="flex items-center gap-2 mb-4">
        <span className="japanese-kanji-accent text-lg">{titleJa}</span>
        <span className="text-secondary text-sm">—</span>
        <span className="text-secondary text-sm">{titleEn}</span>
      </div>
      <div className="space-y-0">
        {items.map((item, i) => (
          <TreeItem key={item.name} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}
