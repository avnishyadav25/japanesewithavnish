import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { DetailComprehensionClient } from "./DetailComprehensionClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ListeningDetailPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();

  if (!sql) {
    return notFound();
  }

  // 1. Fetch the post
  const posts = await sql`
    SELECT id, title, (jlpt_level)[1] AS level
    FROM posts
    WHERE slug = ${slug} AND content_type = 'listening' AND status = 'published'
    LIMIT 1
  ` as { id: string; title: string; level: string | null }[];

  const post = posts[0];
  if (!post) {
    return notFound();
  }

  // 2. Fetch the listening parent item
  const listeningRows = await sql`
    SELECT id, title, audio_url, notes
    FROM listening
    WHERE post_id = ${post.id}
    LIMIT 1
  ` as { id: string; title: string; audio_url: string; notes: string | null }[];

  const listening = listeningRows[0];
  if (!listening) {
    return notFound();
  }

  // 3. Fetch all scenarios linked to this listening ID, with each scenario's question count,
  // and only keep scenarios that are actually complete (real audio + transcript + 3+ questions).
  // A published post with no complete scenario should 404, not render a half-finished page.
  const scenariosRows = await sql`
    SELECT ls.id, ls.title, ls.audio_url, ls.transcript, ls.sort_order,
           (SELECT COUNT(*) FROM listening_questions lq WHERE lq.scenario_id = ls.id)::int AS question_count
    FROM listening_scenarios ls
    WHERE ls.listening_id = ${listening.id}
    ORDER BY ls.sort_order, ls.title
  ` as { id: string; title: string; audio_url: string; transcript: string | null; sort_order: number; question_count: number }[];

  const completeScenariosRows = scenariosRows.filter(
    (s) => s.audio_url && s.transcript && s.question_count >= 3
  );
  if (completeScenariosRows.length === 0) {
    return notFound();
  }

  const scenarios = completeScenariosRows.map((s) => ({
    id: s.id,
    title: s.title,
    audioUrl: s.audio_url,
    transcript: s.transcript,
    sortOrder: s.sort_order,
  }));

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 px-4 sm:px-6">
      <div className="max-w-[800px] mx-auto space-y-6">
        
        {/* Breadcrumbs */}
        <nav className="text-[11px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <Link href="/learn" className="hover:text-primary transition-colors">Learn Hub</Link>
          <span>/</span>
          <Link href="/learn/listening" className="hover:text-primary transition-colors">Listening</Link>
          <span>/</span>
          <span className="text-charcoal truncate">{post.title}</span>
        </nav>

        {/* Title */}
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#D0021B] uppercase bg-[#FFF7F7] px-3 py-1 rounded-full border border-[#D0021B]/10">
            {post.level || "N5"} • Listening Comprehension
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-charcoal mt-2.5">
            {post.title}
          </h1>
          {listening.notes && (
            <p className="text-secondary text-xs mt-2 leading-relaxed">{listening.notes}</p>
          )}
        </div>

        <DetailComprehensionClient
          scenarios={scenarios}
          sessionEmail={session?.email ?? null}
        />

      </div>
    </div>
  );
}
