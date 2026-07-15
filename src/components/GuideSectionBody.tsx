"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

export function GuideSectionBody({ content }: { content: string }) {
  return (
    <div className="prose prose-neutral max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children, ...props }) => (
            <p className="my-4 leading-8 text-[0.95rem] text-secondary" {...props}>
              {children}
            </p>
          ),
          img: ({ alt, src, ...props }) => (
            <span className="block my-7 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                {...props}
                alt={alt || ""}
                src={src || ""}
                className="max-w-2xl w-full mx-auto rounded-2xl object-cover object-top border border-[var(--divider)] shadow-sm"
              />
            </span>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-outside pl-6 my-5 space-y-3 text-secondary" {...props}>
              {children}
            </ol>
          ),
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-outside pl-6 my-5 space-y-3 text-secondary" {...props}>
              {children}
            </ul>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-7" {...props}>
              {children}
            </li>
          ),
          strong: ({ children, ...props }) => (
            <strong className="text-charcoal font-semibold" {...props}>
              {children}
            </strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
