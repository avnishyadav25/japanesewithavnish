import { sql } from "@/lib/db";
import { BRAND, SOCIAL_SETTINGS_KEYS, sameAsUrls } from "@/lib/brand";

/**
 * Profile URLs for the Organization entity.
 *
 * Previously this listed three accounts and carried its own Instagram fallback that disagreed
 * with the database. It now resolves through `@/lib/brand`, which means all six live accounts —
 * YouTube, Instagram, X, Facebook, Threads, Pinterest — are declared instead of three. Search
 * engines use `sameAs` to connect the site to those profiles, so the three that were missing
 * were a free signal being thrown away.
 */
async function getSocialUrls(): Promise<string[]> {
  const map: Record<string, string> = {};
  if (sql) {
    const rows = (await sql`SELECT key, value FROM site_settings WHERE key = ANY(${SOCIAL_SETTINGS_KEYS})`) as {
      key: string;
      value: unknown;
    }[];
    rows.forEach((r) => {
      map[r.key] = typeof r.value === "string" ? r.value : "";
    });
  }
  return sameAsUrls(map);
}

export async function OrganizationSchema() {
  const siteUrl = BRAND.siteUrl;
  const sameAs = await getSocialUrls();
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: "Premium Japanese learning resources. JLPT bundles, placement quiz, and lessons.",
    sameAs,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function BreadcrumbListSchema({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Generic, reusable — not wired into any page yet. Emitting a Person with a placeholder
// bio/credentials would be a false E-E-A-T signal; wire this in once real author content
// (bio, credentials, photo) exists.
export function PersonSchema({
  name,
  url,
  jobTitle,
  description,
  image,
  sameAs,
}: {
  name: string;
  url?: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  sameAs?: string[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    ...(url && { url }),
    ...(jobTitle && { jobTitle }),
    ...(description && { description }),
    ...(image && { image }),
    ...(sameAs && sameAs.length > 0 && { sameAs }),
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

export function CourseSchema({
  name,
  description,
  url,
  numberOfLessons,
}: {
  name: string;
  description: string;
  url: string;
  numberOfLessons?: number;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    description,
    url,
    provider: {
      "@type": "Organization",
      name: BRAND.name,
      sameAs: BRAND.siteUrl,
    },
    ...(numberOfLessons && {
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
        courseWorkload: `${numberOfLessons} lessons`,
      },
    }),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function ArticleSchema({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authorName,
}: {
  title: string;
  description?: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}) {
  const siteUrl = BRAND.siteUrl;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: description || title,
    url,
    ...(image && { image: [image] }),
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    author: {
      "@type": "Person",
      name: authorName || `${BRAND.name} Editorial Team`,
    },
    publisher: {
      "@type": "Organization",
      name: BRAND.name,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
      },
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
