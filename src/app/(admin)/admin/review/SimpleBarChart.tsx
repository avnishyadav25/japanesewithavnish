// Gap-fix phase 14: no chart library exists anywhere in this codebase (confirmed — no
// recharts/chart.js/d3 in package.json, no existing Chart component in /admin), and the
// admin area's own convention is thin custom components over pulling in a table/chart
// library. A handful of horizontal bars/columns don't need one either.

export function SimpleBarChart({ rows, emptyMessage }: { rows: { label: string; count: number }[]; emptyMessage: string }) {
  if (rows.length === 0) return <p className="text-secondary text-sm">{emptyMessage}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-32 shrink-0 truncate text-xs text-secondary" title={r.label}>
            {r.label}
          </span>
          <div className="flex-1 bg-base rounded-full h-4 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max((r.count / max) * 100, 3)}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-medium text-charcoal">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

/** 30-day trend as a simple column sparkline — zero-fills gap days so the shape of the
 * trend (including quiet stretches) reads correctly rather than compressing to just the
 * days something happened. */
export function TrendSparkline({ days }: { days: { day: string; count: number }[] }) {
  const byDay = new Map(days.map((d) => [d.day, d.count]));
  const today = new Date();
  const filled: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    filled.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  const max = Math.max(...filled.map((d) => d.count), 1);
  const total = filled.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) return <p className="text-secondary text-sm">No review runs in the last 30 days.</p>;

  return (
    <div>
      <div className="flex items-end gap-0.5 h-20">
        {filled.map((d) => (
          <div
            key={d.day}
            className="flex-1 bg-primary rounded-sm min-h-[2px]"
            style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)}%` }}
            title={`${d.day}: ${d.count} run(s)`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-secondary mt-1">
        <span>{filled[0].day}</span>
        <span>{total} run(s) total</span>
        <span>{filled[filled.length - 1].day}</span>
      </div>
    </div>
  );
}
