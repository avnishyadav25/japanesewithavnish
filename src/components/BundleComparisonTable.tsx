interface ComparisonRow {
  label: string;
  n5?: string;
  n4?: string;
  n3?: string;
  n2?: string;
  n1?: string;
  mega?: string;
}

interface BundleComparisonData {
  rows?: ComparisonRow[];
  prices?: Record<string, number>;
}

const COLUMNS = ["n5", "n4", "n3", "n2", "n1", "mega"] as const;
const COL_LABELS: Record<string, string> = {
  n5: "N5",
  n4: "N4",
  n3: "N3",
  n2: "N2",
  n1: "N1",
  mega: "Mega",
};

export function BundleComparisonTable({ data }: { data: BundleComparisonData | null }) {
  if (!data?.rows?.length) return null;

  return (
    <div className="card overflow-hidden p-5">
      <h3 className="font-heading font-bold text-charcoal mb-4 text-2xl">Bundle comparison (quick view)</h3>
      <p className="text-secondary text-sm mb-3 lg:hidden">Swipe to compare →</p>
      <div className="overflow-x-auto -mx-5 -mb-5">
        <table className="w-full min-w-[600px] text-[13px]">
          <thead>
            <tr className="border-b border-[#EEEEEE]">
              <th className="text-left py-2.5 px-4 font-medium text-charcoal w-28 sticky left-0 bg-white z-10 h-10"> </th>
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className={`py-3 px-4 font-medium text-charcoal text-center ${
                    col === "mega" ? "border-l-2 border-[var(--gold)] bg-[#FFFDF5]" : ""
                  }`}
                >
                  {COL_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b border-[#EEEEEE] last:border-0 h-10">
                <td className="py-2.5 px-4 text-secondary font-medium sticky left-0 bg-white z-10">{row.label}</td>
                {COLUMNS.map((col) => (
                  <td
                    key={col}
                    className={`py-2.5 px-4 text-center ${
                      col === "mega" ? "border-l-2 border-[var(--gold)] bg-[#FFFDF5]" : ""
                    }`}
                  >
                    {(row as unknown as Record<string, string | undefined>)[col] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {data.prices && (
              <tr className="border-t-2 border-[#EEEEEE] font-semibold h-10">
                <td className="py-2.5 px-4 text-charcoal sticky left-0 bg-white z-10">Price</td>
                {COLUMNS.map((col) => (
                  <td
                    key={col}
                    className={`py-2.5 px-4 text-center text-primary ${
                      col === "mega" ? "border-l-2 border-[var(--gold)] bg-[#FFFDF5]" : ""
                    }`}
                  >
                    ₹{data.prices?.[col] ?? "—"}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
