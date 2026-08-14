import "server-only";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { LibraryContent } from "./LibraryContent";

async function getUserEmail() {
  const session = await getSession();
  return session?.email ?? null;
}

export default async function LibraryPage() {
  const email = await getUserEmail();

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-6">
          <Link
            href="/start-here"
            className="text-sm text-secondary hover:text-primary"
          >
            ← Back to Start Here
          </Link>
        </div>

        {!email ? (
          <div className="bento-grid">
            <div className="bento-span-4 bento-row-2 card flex flex-col justify-center">
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
                My Library
              </h1>
              <p className="text-secondary mb-6">
                Please log in to see completed lessons, review queue, and purchases.
              </p>
              <p className="text-secondary text-sm mb-4">
                Your library is built from lessons you study and items you add for review.
              </p>
              <p className="text-secondary text-sm">
                <Link
                  href="/login?redirect=/library"
                  className="btn-primary inline-block mt-4"
                >
                  Log in
                </Link>
              </p>
            </div>
            <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
              <h2 className="font-heading text-lg font-semibold text-charcoal mb-2">
                What shows here
              </h2>
              <ul className="text-secondary text-sm space-y-1">
                <li>Completed lessons for study again.</li>
                <li>Items added to your review queue.</li>
                <li>Purchases and downloads.</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-10">
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
                My Library
              </h1>
              <p className="text-secondary">
                Completed lessons, review queue, and purchases.
              </p>
            </div>
            <LibraryContent userEmail={email} />
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-secondary">
              <div>
                <span className="font-medium text-charcoal">
                  Need help accessing?
                </span>{" "}
                Contact the support email shown in the footer.
              </div>
              <Link href="/refund-policy" className="text-primary hover:underline">
                View refund policy →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
