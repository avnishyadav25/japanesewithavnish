"use client";

import Link from "next/link";

const LEVELS = [
  { value: "", label: "All" },
  { value: "n5", label: "N5" },
  { value: "n4", label: "N4" },
  { value: "n3", label: "N3" },
  { value: "n2", label: "N2" },
  { value: "n1", label: "N1" },
  { value: "mega", label: "Mega" },
];

export function StoreFilters({ currentLevel }: { currentLevel?: string }) {
  const base = "/store";

  return (
    <div className="flex flex-wrap gap-2">
      {LEVELS.map(({ value, label }) => {
        const href = value ? `${base}?level=${value}` : base;
        const isActive = (!currentLevel && !value) || (currentLevel?.toLowerCase() === value);
        return (
          <Link
            key={value || "all"}
            href={href}
            className={`px-4 py-2 rounded-badge text-sm font-medium transition ${
              isActive
                ? "bg-primary text-white"
                : "bg-white border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
