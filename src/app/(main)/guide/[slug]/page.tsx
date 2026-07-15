import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { GuideSectionBody } from "@/components/GuideSectionBody";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

type GuideSection = {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  body: string | null;
  icon: string | null;
  feature_image_url: string | null;
  link_href: string | null;
  link_label: string | null;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!sql) return {};
  const rows = await sql`
    SELECT title, short_description, feature_image_url
    FROM platform_guide_sections WHERE slug = ${slug} AND published = true LIMIT 1
  ` as { title: string; short_description: string; feature_image_url: string | null }[];
  const s = rows[0];
  if (!s) return {};
  return {
    title: `${s.title} — Site Guide | Japanese with Avnish`,
    description: s.short_description,
    openGraph: {
      title: s.title,
      description: s.short_description,
      images: s.feature_image_url ? [{ url: s.feature_image_url }] : undefined,
      type: "article",
      url: `${BASE}/guide/${slug}`,
    },
  };
}

export default async function GuideSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!sql) notFound();

  const rows = await sql`
    SELECT id, title, slug, short_description, body, icon, feature_image_url, link_href, link_label
    FROM platform_guide_sections WHERE slug = ${slug} AND published = true LIMIT 1
  `;
  const section = rows[0] as GuideSection | undefined;
  if (!section) notFound();

  return (
    <div className="bg-[#FAF8F5] japanese-wave-bg">
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[760px] mx-auto">
          <nav className="text-sm text-secondary mb-6">
            <Link href="/guide" className="hover:text-primary transition">Site Guide</Link>
            <span className="mx-2 opacity-50">／</span>
            <span className="text-charcoal">{section.title}</span>
          </nav>

          <div className="flex items-start gap-3 mb-4">
            {section.icon && <span className="text-4xl leading-none shrink-0">{section.icon}</span>}
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal">{section.title}</h1>
          </div>

          <p className="text-secondary text-lg leading-relaxed mb-6">{section.short_description}</p>

          {section.feature_image_url && (
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden mb-8 border border-[var(--divider)]">
              <Image
                src={section.feature_image_url}
                alt={section.title}
                fill
                className="object-cover"
                unoptimized={section.feature_image_url.startsWith("http")}
                sizes="760px"
              />
            </div>
          )}

          {section.body && (
            <div className="mb-8">
              <GuideSectionBody content={section.body} />
            </div>
          )}

          {section.link_href && (
            <div className="pt-4 border-t border-[var(--divider)]">
              <Link href={section.link_href} className="btn-primary inline-block">
                {section.link_label || "Learn more"} →
              </Link>
            </div>
          )}

          <div className="mt-10">
            <Link href="/guide" className="text-primary text-sm font-bold hover:underline">
              ← Back to Site Guide
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
