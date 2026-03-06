import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { slugify } from "@/lib/slugify";
import { TTSPlayButton } from "@/components/learn/LessonMetaContent";

type SectionAudio = Record<string, string>;
type Meta = Record<string, unknown> | null | undefined;

function metaStr(meta: Meta, key: string): string {
  const v = meta?.[key];
  return v != null ? String(v) : "";
}

function hasAudio(meta: Meta): boolean {
  if (meta?.audio_url != null && String(meta.audio_url)) return true;
  const urls = meta?.audio_urls;
  return Array.isArray(urls) && urls.some((u) => u != null && String(u));
}

export function LearnMarkdown({
  content,
  meta,
  contentType,
}: {
  content: string;
  meta?: Meta;
  contentType?: string;
}) {
  const sectionAudio = (meta?.section_audio as SectionAudio | undefined) ?? {};
  const m = meta ?? {};
  const audio = hasAudio(meta);

  function SectionWithAudio({
    level,
    children,
    className,
    ...props
  }: { level: 2 | 3; children?: React.ReactNode } & React.HTMLAttributes<HTMLHeadingElement>) {
    const text = typeof children === "string" ? children : flattenText(children);
    const id = text ? (slugify(text) || `h-${level}`) : undefined;
    const url = text ? sectionAudio[text] ?? sectionAudio[text.trim()] : "";
    const Tag = level === 2 ? "h2" : "h3";
    return (
      <>
        <Tag id={id} className={["scroll-mt-24", className].filter(Boolean).join(" ")} {...props}>
          {children}
        </Tag>
        {url && (
          <div className="mt-1 mb-3 flex items-center gap-2">
            <audio controls className="h-8 max-w-[240px]" src={url} preload="metadata">
              Your browser does not support the audio element.
            </audio>
            <span className="text-xs text-secondary">Listen</span>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Vocabulary: japanese, reading, type, meaning — before markdown */}
      {contentType === "vocabulary" && (metaStr(meta, "japanese") || metaStr(meta, "meaning")) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center overflow-hidden bg-white">
          <div className="flex flex-wrap items-baseline justify-center gap-2 mb-2">
            {metaStr(meta, "japanese") && (
              <>
                <span className="text-2xl font-medium text-charcoal">{metaStr(meta, "japanese")}</span>
                {!audio && <TTSPlayButton text={metaStr(meta, "japanese")} />}
              </>
            )}
            {metaStr(meta, "reading") && (
              <span className="text-secondary text-lg">({metaStr(meta, "reading")})</span>
            )}
            {metaStr(meta, "type") && (
              <span className="text-xs text-secondary border border-[var(--divider)] px-2 py-0.5 rounded">
                {metaStr(meta, "type")}
              </span>
            )}
          </div>
          {metaStr(meta, "meaning") && <p className="text-charcoal mb-2">{metaStr(meta, "meaning")}</p>}
        </div>
      )}

      {/* Grammar: grammar_form, reading, meaning, structure — before markdown */}
      {contentType === "grammar" && (metaStr(meta, "grammar_form") || metaStr(meta, "meaning")) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center overflow-hidden bg-white">
          <div className="flex flex-wrap items-baseline justify-center gap-2 mb-2">
            {metaStr(meta, "grammar_form") && (
              <>
                <span className="text-2xl font-medium text-charcoal">{metaStr(meta, "grammar_form")}</span>
                {!audio && <TTSPlayButton text={metaStr(meta, "grammar_form")} />}
              </>
            )}
            {metaStr(meta, "reading") && (
              <span className="text-secondary text-lg">({metaStr(meta, "reading")})</span>
            )}
          </div>
          {metaStr(meta, "meaning") && <p className="text-charcoal mb-2">{metaStr(meta, "meaning")}</p>}
          {metaStr(meta, "structure") && (
            <p className="text-[1.5rem] text-secondary font-mono mb-3">{metaStr(meta, "structure")}</p>
          )}
        </div>
      )}

      {/* Kanji: character, meaning, stroke_count, onyomi, kunyomi — before markdown */}
      {contentType === "kanji" && (metaStr(meta, "character") || metaStr(meta, "meaning")) && (
        <div className="mb-6 p-4 rounded-bento bg-[var(--divider)]/20 text-center overflow-hidden bg-white">
          <div className="flex flex-wrap items-baseline justify-center gap-3 mb-2">
            {metaStr(meta, "character") && (
              <>
                <span className="text-4xl font-medium text-charcoal">{metaStr(meta, "character")}</span>
                {!audio && <TTSPlayButton text={metaStr(meta, "character")} />}
              </>
            )}
            {metaStr(meta, "meaning") && <span className="text-charcoal">{metaStr(meta, "meaning")}</span>}
            {meta?.stroke_count != null && (
              <span className="text-xs text-secondary">{Number(meta.stroke_count)} strokes</span>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-[1.5rem]">
            {Array.isArray(m.onyomi) && (m.onyomi as string[]).length > 0 && (
              <span>
                <span className="text-secondary">On: </span>
                {(m.onyomi as string[]).join(", ")}
              </span>
            )}
            {Array.isArray(m.kunyomi) && (m.kunyomi as string[]).length > 0 && (
              <span>
                <span className="text-secondary">Kun: </span>
                {(m.kunyomi as string[]).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
        img: ({ alt, src, ...props }) => (
          <span className="block my-4 text-center">
            <img
              {...props}
              alt={alt || ""}
              src={src || ""}
              className="max-w-md w-full mx-auto rounded-[10px] object-cover object-center border border-[var(--divider)] bg-[var(--divider)]/10"
            />
          </span>
        ),
        h2: ({ children, ...props }) => (
          <SectionWithAudio level={2} {...props}>
            {children}
          </SectionWithAudio>
        ),
        h3: ({ children, ...props }) => (
          <SectionWithAudio level={3} {...props}>
            {children}
          </SectionWithAudio>
        ),
      }}
    >
        {content}
      </ReactMarkdown>
    </>
  );
}

function flattenText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (node && typeof node === "object" && "props" in node) return flattenText((node as { props: { children?: React.ReactNode } }).props?.children);
  return "";
}

