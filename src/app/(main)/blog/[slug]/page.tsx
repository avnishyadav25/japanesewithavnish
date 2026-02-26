import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CTABlock } from "@/components/CTABlock";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !post) notFound();

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-6 card">
            <nav className="text-sm text-secondary mb-8">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <Link href="/blog" className="hover:text-primary">Blog</Link>
              <span className="mx-2">/</span>
              <span className="text-charcoal">{post.title}</span>
            </nav>

            <h1 className="font-heading text-3xl font-bold text-charcoal mb-4">{post.title}</h1>
            {post.published_at && (
              <time className="text-secondary text-sm block mb-6">
                {new Date(post.published_at).toLocaleDateString()}
              </time>
            )}

            <div
              className="prose prose-charcoal max-w-none [&_h2]:font-heading [&_h2]:font-bold"
              dangerouslySetInnerHTML={{ __html: post.content || "" }}
            />
          </div>
          <CTABlock
            title="Ready to level up?"
            description="Get the bundle that fits your level."
            productSlug="japanese-n5-mastery-bundle"
            buttonText="Browse Bundles"
          />
        </div>
      </div>
    </div>
  );
}
