"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PolicyRow({ contentType, requiredFields }: { contentType: string; requiredFields: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(requiredFields.join(", "));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const fields = value.split(",").map((s) => s.trim()).filter(Boolean);
      await fetch(`/api/admin/review/policies/${contentType}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiredFields: fields }),
      });
      setDirty(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-[var(--divider)]">
      <td className="py-2 px-2 font-medium text-charcoal text-sm">{contentType}</td>
      <td className="py-2 px-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDirty(true);
          }}
          placeholder="comma-separated field names"
          className="w-full px-2 py-1 border border-[var(--divider)] rounded-bento text-xs font-mono"
        />
      </td>
      <td className="py-2 px-2">
        {dirty && (
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="px-2.5 py-1 rounded-bento text-xs font-medium bg-primary text-white hover:opacity-90 transition disabled:opacity-50"
          >
            Save
          </button>
        )}
      </td>
    </tr>
  );
}
