import "server-only";
import Link from "next/link";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/access-tokens";
import { LibraryContent } from "../library/LibraryContent";

const ACCESS_TOKEN_COOKIE = "access_token";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-6 card p-12 text-center">
              <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">
                Access your library
              </h1>
              <p className="text-secondary mb-4">
                Use the link we sent to your email after your purchase. That link
                opens your library and stays valid for 30 days.
              </p>
              <Link href="/store" className="btn-primary">
                Browse the store
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return (
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-6 card p-12 text-center">
              <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">
                Link invalid or expired
              </h1>
              <p className="text-secondary mb-4">
                This access link may have expired or already been used. Check your
                purchase confirmation email for a valid link, or contact support.
              </p>
              <Link href="/store" className="btn-primary">
                Browse the store
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

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
        <div className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
            Store
          </h1>
          <p className="text-secondary">
            Your purchased bundles and downloads.
          </p>
        </div>
        <LibraryContent userEmail={payload.email} />
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-secondary">
          <div>
            <span className="font-medium text-charcoal">Need help?</span> Contact
            the support email in the footer.
          </div>
          <Link href="/store" className="text-primary hover:underline">
            Browse the store →
          </Link>
        </div>
      </div>
    </div>
  );
}
