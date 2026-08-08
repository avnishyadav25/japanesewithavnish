import { sql } from "@/lib/db";

const SOCIAL_SETTING_KEYS = ["youtube_url", "instagram_url", "twitter_url"] as const;

// Same site_settings keys + instagram fallback as Footer.tsx, so the Organization
// entity's sameAs matches whatever social links are actually live in the footer.
async function getSocialUrls(): Promise<string[]> {
  const map: Record<string, string> = {};
  if (sql) {
    const rows = (await sql`SELECT key, value FROM site_settings WHERE key = ANY(${SOCIAL_SETTING_KEYS})`) as {
      key: string;
      value: unknown;
    }[];
    rows.forEach((r) => {
      map[r.key] = typeof r.value === "string" ? r.value : "";
    });
  }
  const instagram = map.instagram_url?.trim() || "https://www.instagram.com/japanesewithavnish";
  return [map.youtube_url, instagram, map.twitter_url].filter((url): url is string => !!url?.trim());
}

export async function OrganizationSchema() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
  const sameAs = await getSocialUrls();
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Japanese with Avnish",
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
      name: "Japanese with Avnish",
      sameAs: process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com",
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
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
      name: authorName || "Japanese with Avnish Editorial Team",
    },
    publisher: {
      "@type": "Organization",
      name: "Japanese with Avnish",
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
