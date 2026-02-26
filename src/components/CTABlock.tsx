import Link from "next/link";

interface CTABlockProps {
  title: string;
  description?: string;
  productSlug: string;
  buttonText?: string;
}

export function CTABlock({ title, description, productSlug, buttonText = "Get the Bundle" }: CTABlockProps) {
  return (
    <div className="bento-span-6 card bg-base border-[var(--divider)]">
      <h3 className="font-heading text-xl font-bold text-charcoal mb-2">{title}</h3>
      {description && <p className="text-secondary mb-4">{description}</p>}
      <Link href={`/product/${productSlug}`} className="btn-primary inline-block">
        {buttonText}
      </Link>
    </div>
  );
}
