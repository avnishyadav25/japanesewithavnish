import Link from "next/link";

interface CTABlockProps {
  title: string;
  description?: string;
  productSlug: string;
  buttonText?: string;
}

export function CTABlock({ title, description, productSlug, buttonText = "Get the Bundle" }: CTABlockProps) {
  return (
    <div className="bg-base rounded-card p-8 border border-[var(--divider)] my-8">
      <h3 className="text-xl font-bold text-charcoal mb-2">{title}</h3>
      {description && <p className="text-secondary mb-4">{description}</p>}
      <Link href={`/product/${productSlug}`} className="btn-primary inline-block">
        {buttonText}
      </Link>
    </div>
  );
}
