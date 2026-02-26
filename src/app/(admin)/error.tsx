"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Something went wrong</h1>
      <p className="text-secondary mb-6 text-center max-w-md">{error.message}</p>
      <div className="flex gap-4">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/admin" className="btn-secondary">
          Back to Admin
        </Link>
      </div>
    </div>
  );
}
