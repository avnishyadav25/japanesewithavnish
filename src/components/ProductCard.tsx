import Link from "next/link";
import Image from "next/image";

interface ProductCardProps {
  slug: string;
  name: string;
  price: number;
  comparePrice?: number;
  badge?: "offer" | "premium";
  jlptLevel?: string;
  size?: "small" | "medium" | "large";
  imageUrl?: string | null;
}

export function ProductCard({ slug, name, price, comparePrice, badge, jlptLevel, size = "medium", imageUrl }: ProductCardProps) {
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
      className={`card block hover:no-underline group overflow-hidden border-l-4 border-l-transparent hover:border-l-primary transition-colors ${sizeClasses[size]}`}
    >
      {imageUrl && (
        <div className={`relative w-full mb-4 rounded-bento overflow-hidden aspect-video ${size === "large" ? "min-h-[180px]" : "min-h-[120px]"}`}>
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes={size === "large" ? "(max-width: 768px) 100vw, 50vw" : "25vw"}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
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
