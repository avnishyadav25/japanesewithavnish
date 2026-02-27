type Comment = {
  id: string;
  author_name: string;
  author_email: string;
  content: string;
  created_at: string;
};

type BlogCommentListProps = {
  comments: Comment[];
};

export function BlogCommentList({ comments }: BlogCommentListProps) {
  if (comments.length === 0) return null;

  return (
    <div className="space-y-4">
      {comments.map((c) => (
        <article
          key={c.id}
          className="p-4 rounded-bento border border-[var(--divider)] bg-[var(--base)]"
        >
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-heading font-semibold text-charcoal">{c.author_name}</span>
            <time className="text-secondary text-xs">
              {new Date(c.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </div>
          <p className="text-charcoal text-sm whitespace-pre-wrap">{c.content}</p>
        </article>
      ))}
    </div>
  );
}
