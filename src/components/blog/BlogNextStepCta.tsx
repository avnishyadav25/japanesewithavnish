import Link from "next/link";

export function BlogNextStepCta() {
  return (
    <div className="card p-6 mt-12 text-center">
      <h3 className="font-heading font-bold text-charcoal text-xl mb-4">
        What should you do next?
      </h3>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/quiz" className="btn-primary">
          Take the Quiz
        </Link>
        <Link href="/store" className="btn-secondary">
          Browse Bundles
        </Link>
        <Link href="/login" className="text-primary font-medium hover:underline py-2">
          Store
        </Link>
      </div>
    </div>
  );
}
