import { ReactNode } from "react";

interface AdminTableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
}

export function AdminTable({ headers, children, className = "" }: AdminTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`.trim()}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--divider)]">
            {headers.map((h) => (
              <th key={h} className="text-left py-3 px-2 font-semibold text-charcoal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-base/50">{children}</tbody>
      </table>
    </div>
  );
}
