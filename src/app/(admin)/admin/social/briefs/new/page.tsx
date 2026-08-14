import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { briefForRender } from "@/lib/social/briefs";

export const dynamic = "force-dynamic";

/**
 * Entry point for "Promote" on a render card.
 *
 * A server-side find-or-create then a redirect, rather than a client fetch, so the render card
 * stays a plain link and ProjectWorkspace.tsx does not grow another piece of client state. It is
 * idempotent — clicking Promote twice lands on the same brief.
 */
export default async function NewSocialBriefPage({
  searchParams,
}: {
  searchParams: Promise<{ renderId?: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const { renderId } = await searchParams;
  if (!renderId) redirect("/admin/social");

  const brief = await briefForRender(renderId, admin.email);
  redirect(`/admin/social/briefs/${brief.id}`);
}
