import Link from "next/link";

const FILTER_TABS = [
  { value: "", label: "All" },
  { value: "n5", label: "N5" },
  { value: "n4", label: "N4" },
  { value: "n3", label: "N3" },
  { value: "n2", label: "N2" },
  { value: "n1", label: "N1" },
  { value: "mega", label: "⭐ Mega" },
];

export function StoreHero({ currentLevel }: { currentLevel?: string }) {
  return (
    <div className="bg-[#1A1A1A]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-[56px] pb-0">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-white/15 text-white">
            6 bundles
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-white/15 text-white">
            JLPT N5→N1
          </span>
        </div>

        <h1 className="font-serif text-[36px] sm:text-[44px] font-normal text-white leading-[1.15] mb-3">
          The JLPT bundle store
        </h1>
        <p className="text-[16px] text-white/60 mb-10 max-w-[480px]">
          Structured study materials for every level. One-time purchase, lifetime access via your Library.
        </p>

        {/* Filter tabs — sit at bottom of dark band, flush with content below */}
        <div className="flex flex-wrap gap-2 pb-0">
          {FILTER_TABS.map(({ value, label }) => {
            const href = value ? `/store?level=${value}` : "/store";
            const isActive =
              (!currentLevel && !value) ||
              currentLevel?.toLowerCase() === value;
            return (
              <Link
                key={value || "all"}
                href={href}
                className={`px-4 py-2 rounded-t-lg text-[13px] font-semibold transition-colors ${
                  isActive
                    ? "bg-[var(--background)] text-[#1A1A1A]"
                    : "bg-white/[.06] text-white/65 hover:bg-white/[.12] hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
