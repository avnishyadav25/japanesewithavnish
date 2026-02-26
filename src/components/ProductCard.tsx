import Link from "next/link";

interface ProductCardProps {
  slug: string;
  name: string;
  price: number;
  comparePrice?: number;
  badge?: "offer" | "premium";
  jlptLevel?: string;
  size?: "small" | "medium" | "large";
}

export function ProductCard({ slug, name, price, comparePrice, badge, jlptLevel, size = "medium" }: ProductCardProps) {
  const priceRs = price / 100;
  const compareRs = comparePrice ? comparePrice / 100 : null;

  const sizeClasses = {
    small: "p-4 h-full",
    medium: "p-6 h-full",
    large: "p-8 h-full flex flex-col justify-between",
  };

  return (
    <Link
      href={`/product/${slug}`}
      className={`card block hover:no-underline group ${sizeClasses[size]}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        {badge === "offer" && <span className="badge-offer">Offer</span>}
        {badge === "premium" && <span className="badge-premium">Premium</span>}
        {jlptLevel && !badge && (
          <span className="text-secondary text-xs font-medium uppercase tracking-wider">{jlptLevel}</span>
        )}
      </div>
      <h3 className={`font-heading font-bold text-charcoal group-hover:text-primary transition-colors ${
        size === "large" ? "text-2xl mb-4" : size === "medium" ? "text-lg mb-2" : "text-base mb-2"
      }`}>
        {name}
      </h3>
      <div className="flex items-baseline gap-2 mt-auto">
        <span className={`font-bold text-primary ${size === "large" ? "text-2xl" : "text-xl"}`}>₹{priceRs}</span>
        {compareRs && (
          <span className="text-secondary line-through text-sm">₹{compareRs}</span>
        )}
      </div>
    </Link>
  );
}
