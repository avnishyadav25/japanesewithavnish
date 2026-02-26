import Link from "next/link";

interface ProductCardProps {
  slug: string;
  name: string;
  price: number;
  comparePrice?: number;
  badge?: "offer" | "premium";
  jlptLevel?: string;
}

export function ProductCard({ slug, name, price, comparePrice, badge, jlptLevel }: ProductCardProps) {
  const priceRs = price / 100;
  const compareRs = comparePrice ? comparePrice / 100 : null;

  return (
    <Link href={`/product/${slug}`} className="card block hover:no-underline">
      {badge === "offer" && <span className="badge-offer mb-3 inline-block">Offer</span>}
      {badge === "premium" && <span className="badge-premium mb-3 inline-block">Premium</span>}
      {jlptLevel && !badge && (
        <span className="text-secondary text-sm font-medium mb-2 block">{jlptLevel}</span>
      )}
      <h3 className="text-lg font-bold text-charcoal mb-2">{name}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-primary">₹{priceRs}</span>
        {compareRs && (
          <span className="text-secondary line-through text-sm">₹{compareRs}</span>
        )}
      </div>
    </Link>
  );
}
