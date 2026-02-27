"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { JLPT_LEVELS, type JLPTLevel } from "@/data/jlpt-levels";

const STORAGE_KEY = "jlpt_last_level";

interface JLPTLevelTabsProps {
  active: JLPTLevel;
  onActiveChange?: (level: JLPTLevel) => void;
}

export function JLPTLevelTabs({ active, onActiveChange }: JLPTLevelTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setLevel = useCallback(
    (level: JLPTLevel) => {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, level);
        } catch {}
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("level", level);
      router.replace(`/jlpt?${params.toString()}`, { scroll: false });
      onActiveChange?.(level);
    },
    [router, searchParams, onActiveChange]
  );

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const fromUrl = searchParams.get("level")?.toLowerCase();
    const resolved = (fromUrl as JLPTLevel) || (stored as JLPTLevel) || "n5";
    if (JLPT_LEVELS.includes(resolved) && resolved !== active) {
      onActiveChange?.(resolved);
    }
  }, [searchParams, active, onActiveChange]);

  return (
    <div className="flex flex-wrap gap-2">
      {JLPT_LEVELS.map((level) => {
        const isMega = level === "mega";
        const isActive = active === level;
        return (
          <button
            key={level}
            type="button"
            onClick={() => setLevel(level)}
            className={`px-4 py-2 rounded-md font-medium text-sm transition ${
              isActive
                ? isMega
                  ? "bg-[#C8A35F] text-white"
                  : "bg-primary text-white"
                : "bg-white border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
            }`}
          >
            {level === "mega" ? "Mega (All Levels)" : level.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
