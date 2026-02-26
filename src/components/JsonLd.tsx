export function OrganizationSchema() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Japanese with Avnish",
    url: siteUrl,
    description: "Premium Japanese learning resources. JLPT bundles, placement quiz, and lessons.",
    sameAs: [],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function ProductSchema({
  name,
  description,
  price,
  priceCurrency = "INR",
  url,
}: {
  name: string;
  description?: string;
  price: number;
  priceCurrency?: string;
  url: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: description || name,
    url,
    offers: {
      "@type": "Offer",
      price,
      priceCurrency,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
