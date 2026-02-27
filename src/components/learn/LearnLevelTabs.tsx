"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { LearnLevel } from "@/lib/learn-filters";

const STORAGE_KEY = "learn_last_level";
const TABS: { id: LearnLevel; label: string }[] = [
  { id: "all", label: "All" },
  { id: "n5", label: "N5" },
  { id: "n4", label: "N4" },
  { id: "n3", label: "N3" },
  { id: "n2", label: "N2" },
  { id: "n1", label: "N1" },
];

interface LearnLevelTabsProps {
  active: LearnLevel;
  basePath?: string;
}

export function LearnLevelTabs({ active, basePath = "/learn" }: LearnLevelTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setLevel = useCallback(
    (level: LearnLevel) => {
      if (typeof window !== "undefined" && level !== "all") {
        try {
          localStorage.setItem(STORAGE_KEY, level);
        } catch {}
      }
      const params = new URLSearchParams(searchParams.toString());
      if (level === "all") {
        params.delete("level");
      } else {
        params.set("level", level);
      }
      params.delete("page");
      const qs = params.toString();
      router.replace(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams, basePath]
  );

  useEffect(() => {
    const fromUrl = searchParams.get("level")?.toLowerCase();
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const resolved = (fromUrl as LearnLevel) || (stored as LearnLevel) || "all";
    if (resolved !== active && TABS.some((t) => t.id === resolved)) {
      setLevel(resolved);
    }
  }, [searchParams, active, setLevel]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLevel(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <p className="text-[#555555] text-sm mt-2">
        Not sure your level?{" "}
        <a href="/quiz" className="text-primary font-medium hover:underline">
          Take the quiz →
        </a>
      </p>
    </div>
  );
}
