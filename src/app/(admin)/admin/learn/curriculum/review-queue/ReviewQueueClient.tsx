"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { BLOCK_TYPE_LABELS, type BlockType } from "@/lib/blocks/blockTypes";

type PendingBlock = {
  id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_code: string;
  block_type: BlockType;
  block_data: Record<string, unknown>;
  generated_by_model: string | null;
  created_at: string;
};

function summarize(block: PendingBlock): string {
  const d = block.block_data;
  switch (block.block_type) {
    case "section_heading":
      return String(d.title ?? "");
    case "rich_text":
      return String(d.markdown ?? "").slice(0, 160);
    default:
      return JSON.stringify(d).slice(0, 160);
  }
}

export function ReviewQueueClient() {
  const [blocks, setBlocks] = useState<PendingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/curriculum/review-queue");
    const data = await res.json();
    setBlocks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setActingId(id);
    try {
      const res = await fetch("/api/admin/curriculum/review-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) setBlocks((prev) => prev.filter((b) => b.id !== id));
      else alert(`Failed to ${action} block`);
    } finally {
      setActingId(null);
    }
  }

  if (loading) return <p className="text-secondary py-8 text-center text-xs">Loading…</p>;
  if (blocks.length === 0) return <AdminEmptyState message="No AI-generated blocks are pending review." />;

  const byLesson = new Map<string, PendingBlock[]>();
  for (const b of blocks) {
    if (!byLesson.has(b.lesson_id)) byLesson.set(b.lesson_id, []);
    byLesson.get(b.lesson_id)!.push(b);
  }

  return (
    <div className="space-y-4">
      {Array.from(byLesson.entries()).map(([lessonId, lessonBlocks]) => (
        <AdminCard key={lessonId}>
          <div className="flex items-center justify-between mb-3">
            <Link href={`/admin/learn/curriculum/lessons/${lessonId}`} className="font-heading font-semibold text-charcoal hover:text-primary">
              {lessonBlocks[0].lesson_code} — {lessonBlocks[0].lesson_title}
            </Link>
            <span className="text-[10px] text-secondary uppercase tracking-wider">{lessonBlocks.length} pending block(s)</span>
          </div>
          <div className="space-y-2">
            {lessonBlocks.map((b) => (
              <div key={b.id} className="border border-[var(--divider)] rounded-bento p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{BLOCK_TYPE_LABELS[b.block_type]}</span>
                    {b.generated_by_model && <span className="text-[10px] text-secondary">via {b.generated_by_model}</span>}
                  </div>
                  <p className="text-xs text-charcoal line-clamp-2">{summarize(b)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => act(b.id, "approve")}
                    disabled={actingId === b.id}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => act(b.id, "reject")}
                    disabled={actingId === b.id}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-[#D0021B] hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      ))}
    </div>
  );
}
