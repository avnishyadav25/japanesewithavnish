import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getBrief, listVariants } from "@/lib/social/briefs";
import { listChannels } from "@/lib/social/channels";
import { capabilityReport } from "@/lib/social/adapters";
import { listPostsForBrief } from "@/lib/social/publications";
import { BriefWorkspace } from "./BriefWorkspace";

export const dynamic = "force-dynamic";

export default async function SocialBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // One round trip for everything the workspace needs, in the shape /admin/review uses.
  const brief = await getBrief(id);
  if (!brief) notFound();

  const [variants, channels, posts] = await Promise.all([
    listVariants(id),
    listChannels(),
    listPostsForBrief(id),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <AdminPageHeader
        title={brief.title}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Social", href: "/admin/social" },
          { label: "Brief" },
        ]}
        actions={
          brief.renderId
            ? [{ label: "Back to video", href: `/admin/video/renders` }]
            : []
        }
      />
      <BriefWorkspace
        brief={brief}
        initialVariants={variants}
        channels={channels}
        capabilities={capabilityReport(channels)}
        initialPosts={posts}
      />
    </div>
  );
}
