import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">404</h1>
      <p className="text-secondary mb-6">Page not found</p>
      <Link href="/" className="btn-primary">
        Go home
      </Link>
    </div>
  );
}
