import Link from "next/link";

export function JLPTMegaHighlight() {
  return (
    <div className="card p-6 border-l-4 border-l-[#C8A35F] bg-white">
      <h3 className="font-heading text-xl font-bold text-charcoal mb-2">
        Full JLPT System (N5 → N1)
      </h3>
      <p className="text-secondary text-sm mb-4">
        Premium includes everything from beginner to advanced. Best value if
        you&apos;re serious.
      </p>
      <Link
        href="/pricing"
        className="btn-primary inline-block"
      >
        View Premium Plans
      </Link>
    </div>
  );
}
