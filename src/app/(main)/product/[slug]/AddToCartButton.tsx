"use client";

import Link from "next/link";

interface AddToCartButtonProps {
  productId: string;
  slug: string;
  pricePaise: number;
}

export function AddToCartButton({ slug, pricePaise }: AddToCartButtonProps) {
  return (
    <Link
      href={`/checkout?product=${slug}`}
      className="btn-primary inline-block text-center"
    >
      Buy Now — ₹{pricePaise / 100}
    </Link>
  );
}
