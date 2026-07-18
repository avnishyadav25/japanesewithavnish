"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GenerateMockTestModal } from "@/components/admin/GenerateMockTestModal";

/** "+ Generate with AI" trigger for the practice_test list page — creates a brand-new mock-test
 * post from scratch (unlike PracticeTestBuilder's in-page trigger, which adds sections to an
 * already-open post). Server-component pages can't hand an onClick down to AdminPageHeader
 * (functions don't cross the server/client boundary), so this is rendered as a standalone
 * client component alongside the header instead of as one of its actions. */
export function GenerateMockTestButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary inline-flex items-center gap-1.5"
      >
        ✨ Generate with AI
      </button>
      {open && (
        <GenerateMockTestModal
          mode="new"
          onClose={() => setOpen(false)}
          onComplete={(_postId, slug) => {
            setOpen(false);
            router.push(`/admin/learn/practice_test/${slug}/edit`);
          }}
        />
      )}
    </>
  );
}
