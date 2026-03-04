import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-base">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M20 0v40M0 20h40' stroke='%231A1A1A' stroke-width='.5' fill='none'/%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          <Link href="/" className="mb-8 focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-full">
            <Image
              src="/logo-dark.png"
              alt="Japanese with Avnish"
              width={64}
              height={64}
              className="rounded-full object-contain"
              priority
            />
          </Link>

          <p className="font-heading text-6xl sm:text-7xl font-bold text-charcoal mb-2">404</p>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-charcoal mb-2">
            Page not found
          </h1>
          <p className="text-secondary text-sm sm:text-base mb-2">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          <p className="text-secondary/80 text-sm mb-6" lang="ja">
            ページが見つかりません。お探しのページは存在しないか、移動した可能性があります。
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/" className="btn-primary px-6 py-3">
              Go home <span className="font-normal text-sm opacity-90">/ ホームへ</span>
            </Link>
            <Link
              href="/blog"
              className="border border-[var(--divider)] text-charcoal px-6 py-3 rounded-bento hover:bg-[var(--divider)]/20 transition-colors text-sm font-medium"
            >
              Blog
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
