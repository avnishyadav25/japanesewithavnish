"use client";

import { useState } from "react";
import Link from "next/link";
import { WritingCanvas } from "@/components/learn/WritingCanvas";

/** One free tracing attempt on あ for logged-out visitors, then a signup CTA. */
export function WritingGuestDemo({ redirectSlug }: { redirectSlug: string }) {
  const [attempted, setAttempted] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-secondary text-xs text-center">
        Try tracing <span className="font-bold text-charcoal">あ</span> for free — no account needed.
      </p>
      <WritingCanvas
        character="あ"
        characterType="hiragana"
        reading="a"
        onVerify={() => setAttempted(true)}
      />
      {attempted && (
        <div className="text-center p-5 rounded-2xl border border-[var(--divider)] bg-[#FAF8F5] space-y-3">
          <p className="text-charcoal font-medium text-sm">
            Nice work! Create a free account to unlock the full character set and save your progress.
          </p>
          <Link
            href={`/login?tab=signup&redirect=${encodeURIComponent(`/learn/writing/${redirectSlug}`)}`}
            className="btn-primary inline-flex h-11 px-5 rounded-xl text-xs font-bold font-heading items-center"
          >
            Create a free account
          </Link>
        </div>
      )}
    </div>
  );
}
