import ReactMarkdown from "react-markdown";
import { slugify } from "@/lib/slugify";

interface BlogArticleContentProps {
  content: string;
}

export function BlogArticleContent({ content }: BlogArticleContentProps) {
  const isHtml = content.trim().startsWith("<");

  if (isHtml) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
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
      {content}
    </ReactMarkdown>
  );
}
