import "server-only";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LibraryContent } from "./LibraryContent";

async function getUserEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email || null;
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
                Access My Library
              </h1>
              <p className="text-secondary mb-6">
                Enter your email to receive a magic link. No password needed.
              </p>
              <p className="text-secondary text-sm mb-4">
                We&apos;ll send a secure one-time link to log you in and open
                your purchases.
              </p>
              <p className="text-secondary text-sm">
                <Link
                  href="/login?redirect=/library"
                  className="btn-primary inline-block mt-4"
                >
                  Send Magic Link
                </Link>
              </p>
              <p className="text-secondary text-xs mt-4">
                Purchased but used a different email? Use that email on the
                magic link screen. If payment failed, check the payment
                confirmation or contact support.
              </p>
            </div>
            <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
              <h2 className="font-heading text-lg font-semibold text-charcoal mb-2">
                How library access works
              </h2>
              <ul className="text-secondary text-sm space-y-1">
                <li>Secure magic link login (no passwords stored).</li>
                <li>Lifetime access to your purchased bundles.</li>
                <li>Re-download PDFs and audio anytime.</li>
                <li>Need help? Use the support email on the site.</li>
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
                Your purchased bundles and downloads.
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
