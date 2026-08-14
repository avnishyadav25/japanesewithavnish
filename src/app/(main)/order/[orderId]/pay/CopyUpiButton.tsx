"use client";

import { useState } from "react";

export function CopyUpiButton({ upiId }: { upiId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(upiId).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-sm font-medium text-primary underline hover:no-underline"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
