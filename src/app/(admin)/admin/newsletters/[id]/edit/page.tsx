import { sql } from "@/lib/db";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NewsletterForm } from "../../NewsletterForm";

type Row = {
  id: string;
  slug: string;
  title: string | null;
  subject: string;
  body_html: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export default async function EditNewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sql) notFound();
  let newsletter: Row | null = null;
  try {
    const rows = await sql`
      SELECT id, slug, title, subject, body_html, status, sent_at, created_at, updated_at
      FROM newsletters WHERE id = ${id} LIMIT 1
    ` as Row[];
    newsletter = rows[0] ?? null;
  } catch {
    // table may not exist
  }
  if (!newsletter) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Edit newsletter"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Newsletters", href: "/admin/newsletters" },
        ]}
      />
      <NewsletterForm newsletter={newsletter} />
    </div>
  );
}
