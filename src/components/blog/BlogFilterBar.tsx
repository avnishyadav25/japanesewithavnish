"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";

const LEVEL_IDS = ["n5", "n4", "n3", "n2", "n1"] as const;

const TYPE_PILLS = [
  { id: "all" as const, label: "All" },
  ...LEARN_CONTENT_TYPES.map((t) => ({ id: t as string, label: LEARN_TYPE_LABELS[t as LearnContentType] })),
];

const LEVEL_PILLS = LEVEL_IDS.map((id) => ({ id, label: id.toUpperCase() }));

function parseList(param: string | null): string[] {
  if (!param || param === "all") return [];
  return param.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function BlogFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const levelParam = searchParams?.get("level") ?? "all";
  const typeParam = searchParams?.get("type") ?? "all";

  const selectedLevels = useMemo(() => parseList(levelParam), [levelParam]);
  const selectedTypes = useMemo(() => parseList(typeParam), [typeParam]);
  const typeIsAll = selectedTypes.length === 0;

  const setParams = useCallback(
    (level: string, type: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("level", level);
      params.set("type", type);
      params.delete("page");
      router.push(`/blog?${params.toString()}`);
    },
    [router, searchParams]
  );

  const toggleType = useCallback(
    (id: string) => {
      if (id === "all") {
        setParams(levelParam, "all");
        return;
      }
      const next = typeIsAll ? [id] : selectedTypes.includes(id) ? selectedTypes.filter((t) => t !== id) : [...selectedTypes, id];
      setParams(levelParam, next.length === 0 ? "all" : next.join(","));
    },
    [levelParam, typeIsAll, selectedTypes, setParams]
  );

  const toggleLevel = useCallback(
    (id: string) => {
      const next = selectedLevels.includes(id) ? selectedLevels.filter((l) => l !== id) : [...selectedLevels, id];
      setParams(next.length === 0 ? "all" : next.join(","), typeParam);
    },
    [typeParam, selectedLevels, setParams]
  );

  const pillClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
      active ? "bg-primary text-white" : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary hover:text-primary"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: All + content types */}
      <div className="flex flex-wrap gap-2 items-center">
        {TYPE_PILLS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggleType(p.id)}
            className={pillClass(p.id === "all" ? typeIsAll : selectedTypes.includes(p.id))}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* Row 2: levels */}
      <div className="flex flex-wrap gap-2 items-center">
        {LEVEL_PILLS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggleLevel(p.id)}
            className={pillClass(selectedLevels.includes(p.id))}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
