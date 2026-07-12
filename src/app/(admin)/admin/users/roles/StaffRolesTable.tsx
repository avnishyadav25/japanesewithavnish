"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";

type StaffRow = { email: string; display_name: string | null; role: string };

const ROLE_OPTIONS = ["admin", "editor", "support", "student", "premium_student"];

export function StaffRolesTable({ initial }: { initial: StaffRow[] }) {
  const [rows, setRows] = useState(initial);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);

  async function changeRole(email: string, role: string) {
    setSavingEmail(email);
    try {
      const res = await fetch("/api/admin/profiles/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.email === email ? { ...r, role } : r)));
      } else {
        alert("Failed to update role");
      }
    } finally {
      setSavingEmail(null);
    }
  }

  return (
    <AdminCard>
      <AdminTable headers={["Email", "Name", "Role"]}>
        {rows.map((r) => (
          <tr key={r.email} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
            <td className="py-3 px-2 font-medium text-charcoal">{r.email}</td>
            <td className="py-3 px-2 text-secondary">{r.display_name || "—"}</td>
            <td className="py-3 px-2">
              <select
                value={r.role}
                disabled={savingEmail === r.email}
                onChange={(e) => changeRole(r.email, e.target.value)}
                className="h-9 px-2 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </AdminTable>
    </AdminCard>
  );
}
