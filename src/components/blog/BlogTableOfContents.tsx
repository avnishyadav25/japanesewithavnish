"use client";

import { slugify } from "@/lib/slugify";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

function extractHeadings(content: string): TocItem[] {
  const items: TocItem[] = [];
  let idCounter = 0;
  const lines = content.split("\n");
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h2) {
      idCounter++;
      items.push({ id: slugify(h2[1]) || `h-${idCounter}`, text: h2[1].trim(), level: 2 });
    } else if (h3) {
      idCounter++;
      items.push({ id: slugify(h3[1]) || `h-${idCounter}`, text: h3[1].trim(), level: 3 });
    }
  }
  return items;
}

interface BlogTableOfContentsProps {
  content: string;
}

export function BlogTableOfContents({ content }: BlogTableOfContentsProps) {
  const items = extractHeadings(content);

  if (items.length === 0) return null;

  return (
    <nav className="mb-8" aria-label="Table of contents">
      <h3 className="font-heading font-bold text-charcoal mb-3">On this page</h3>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className={item.level === 3 ? "pl-4" : ""}
          >
            <a
              href={`#${item.id}`}
              className="text-secondary hover:text-primary hover:underline"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
