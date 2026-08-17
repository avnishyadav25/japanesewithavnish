import Link from "next/link";

/**
 * The row of link-styled filter buttons used across the admin.
 *
 * Extracted because the same class string was written out by hand in five places
 * (video/projects, video/assets/BgmLibrary, the project workspace's language toggle, and two
 * more), and they had already drifted — some `rounded-button`, some `rounded-bento`, some with a
 * hover state and some without.
 *
 * Deliberately `<Link>`-based rather than a client component with onClick: every current use is
 * "filter this server-rendered list", which needs no JavaScript and keeps the filter in the URL
 * so it survives a refresh and can be linked to.
 */
export interface FilterOption {
  label: string;
  /** Omit for the "All" pill. */
  value?: string;
  /** Shown after the label, e.g. a count. */
  badge?: string | number;
}

export function FilterPills({
  options,
  active,
  basePath,
  param = "status",
  /** Query params to carry across when switching pills, so filters compose. */
  preserve,
}: {
  options: FilterOption[];
  active?: string;
  basePath: string;
  param?: string;
  preserve?: Record<string, string | undefined>;
}) {
  function hrefFor(value?: string): string {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(preserve ?? {})) {
      if (v) query.set(k, v);
    }
    if (value) query.set(param, value);
    else query.delete(param);
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = active === option.value || (!active && !option.value);
        return (
          <Link
            key={option.label}
            href={hrefFor(option.value)}
            className={`px-3 py-1.5 rounded-button text-sm border transition ${
              on
                ? "border-primary bg-red-light text-primary font-semibold"
                : "border-[var(--divider)] text-secondary hover:border-primary/40 hover:text-primary"
            }`}
          >
            {option.label}
            {option.badge !== undefined && (
              <span className="ml-1.5 text-xs tabular-nums opacity-70">{option.badge}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
