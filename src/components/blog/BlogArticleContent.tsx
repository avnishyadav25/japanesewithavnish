import ReactMarkdown from "react-markdown";
import { slugify } from "@/lib/slugify";

interface BlogArticleContentProps {
  content: string;
  title?: string;
}

/** Strip a leading "# <title>" line matching the post's own title — the page
 * template already renders the title as an H1, so a matching one inside the
 * markdown body would show up twice. */
function stripDuplicateH1(content: string, title?: string): string {
  if (!title) return content;
  const normalizedTitle = title.trim().toLowerCase();
  return content.replace(/^\s*#[^\n]*\n+/, (match) => {
    const heading = match.replace(/^\s*#\s*/, "").trim().toLowerCase();
    return heading === normalizedTitle ? "" : match;
  });
}

export function BlogArticleContent({ content, title }: BlogArticleContentProps) {
  const deduped = stripDuplicateH1(content, title);
  const isHtml = deduped.trim().startsWith("<");

  if (isHtml) {
    return <div dangerouslySetInnerHTML={{ __html: deduped }} />;
  }

  return (
    <ReactMarkdown
      components={{
        h2: ({ children, ...props }) => {
          const text = Array.isArray(children)
            ? children.map((c) => (typeof c === "string" ? c : "")).join("")
            : typeof children === "string"
              ? children
              : "";
          return (
            <h2 id={slugify(text) || "h2"} className="scroll-mt-24" {...props}>
              {children}
            </h2>
          );
        },
        h3: ({ children, ...props }) => {
          const text = Array.isArray(children)
            ? children.map((c) => (typeof c === "string" ? c : "")).join("")
            : typeof children === "string"
              ? children
              : "";
          return (
            <h3 id={slugify(text) || "h3"} className="scroll-mt-24" {...props}>
              {children}
            </h3>
          );
        },
        img: ({ alt, src, ...props }) => (
          <span className="block my-6 text-center">
            <img
              {...props}
              alt={alt || ""}
              src={src || ""}
              className="max-w-[85%] w-full mx-auto rounded-[10px] object-cover object-top"
            />
          </span>
        ),
      }}
    >
      {deduped}
    </ReactMarkdown>
  );
}
