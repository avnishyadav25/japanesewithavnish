"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

interface ProductCardProps {
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  comparePrice?: number;
  badge?: "offer" | "premium";
  jlptLevel?: string;
  size?: "small" | "medium" | "large";
  imageUrl?: string | null;
  index?: number;
}

export function ProductCard({
  slug,
  name,
  description,
  price,
  comparePrice,
  badge,
  jlptLevel,
  size = "medium",
  imageUrl,
  index = 0,
}: ProductCardProps) {
  const priceRs = price / 100;
  const compareRs = comparePrice ? comparePrice / 100 : null;
  const discount =
    compareRs && compareRs > priceRs
      ? Math.round(((compareRs - priceRs) / compareRs) * 100)
      : null;

  const sizeClasses = {
    small: "p-4 h-full",
    medium: "p-6 h-full",
    large: "p-8 h-full flex flex-col justify-between",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="h-full"
    >
      <Link
        href={`/product/${slug}`}
        className={`card block hover:no-underline group overflow-hidden border-l-4 border-l-transparent hover:border-l-primary transition-colors ${sizeClasses[size]}`}
      >
        {/* Feature image */}
        {imageUrl && (
          <div
            className={`relative w-full mb-4 rounded-bento overflow-hidden aspect-video ${size === "large" ? "min-h-[180px]" : "min-h-[120px]"
              }`}
          >
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes={
                size === "large" ? "(max-width: 768px) 100vw, 50vw" : "25vw"
              }
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            {discount && (
              <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {discount}% OFF
              </div>
            )}
          </div>
        )}

        {/* Badges + level row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {badge === "offer" && <span className="badge-offer">Offer</span>}
          {badge === "premium" && (
            <span className="badge-premium">Premium</span>
          )}
          {jlptLevel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--base)] border border-[var(--divider)] text-secondary font-medium">
              {jlptLevel}
            </span>
          )}
        </div>

        {/* Name */}
        <h3
          className={`font-heading font-bold text-charcoal group-hover:text-primary transition-colors ${size === "large"
              ? "text-2xl mb-3"
              : size === "medium"
                ? "text-lg mb-2"
                : "text-base mb-2"
            }`}
        >
          {name}
        </h3>

        {/* Description (medium + large only) */}
        {description && size !== "small" && (
          <p className="text-secondary text-sm leading-relaxed line-clamp-2 mb-3">
            {description}
          </p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-auto pt-3 border-t border-[var(--divider)]">
          <span
            className={`font-bold text-primary ${size === "large" ? "text-2xl" : "text-xl"
              }`}
          >
            ₹{priceRs.toLocaleString("en-IN")}
          </span>
          {compareRs && (
            <span className="text-secondary line-through text-sm">
              ₹{compareRs.toLocaleString("en-IN")}
            </span>
          )}
          {discount && !imageUrl && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold ml-auto">
              {discount}% off
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
