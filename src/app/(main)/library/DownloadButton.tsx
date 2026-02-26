"use client";

import { useState } from "react";

export function DownloadButton({ assetId }: { assetId: string; userEmail?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/download?asset_id=${assetId}`, {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Download failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-secondary text-sm py-2 px-4"
    >
      {loading ? "..." : "Download"}
    </button>
  );
}
