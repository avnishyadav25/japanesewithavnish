import { toIso8601Duration, type EmbeddedVideo } from "@/lib/video/embeds";
import { publicLanguageTag } from "@/lib/video/types";

/**
 * Player for a Video Studio render embedded on a content page.
 *
 * `preload="none"` is deliberate: these sit below the fold on pages that already carry a lot,
 * and preloading even metadata for a 100MB MP4 would cost real LCP on mobile. The poster frame
 * is what the user sees until they press play.
 */
export function ContentVideo({ video, className = "" }: { video: EmbeddedVideo; className?: string }) {
  // Vertical renders would blow out the column at full width; cap them so a 9:16 short sits as
  // a phone-shaped block rather than a two-screen-tall wall.
  const isVertical = Boolean(video.width && video.height && video.height > video.width);

  return (
    <figure className={`my-8 ${className}`.trim()}>
      <div className={isVertical ? "max-w-[360px] mx-auto" : ""}>
        <video
          src={video.videoUrl}
          poster={video.posterUrl ?? undefined}
          controls
          preload="none"
          playsInline
          className="w-full rounded-bento bg-black shadow-card"
        >
          {video.vttUrl && <track kind="captions" src={video.vttUrl} srcLang={publicLanguageTag(video.narrationLang)} label="Captions" default />}
        </video>
      </div>
      <figcaption className="text-sm text-secondary mt-2 text-center">
        {video.title}
        {video.durationSeconds ? ` · ${Math.round(video.durationSeconds)}s` : ""}
      </figcaption>
    </figure>
  );
}

/**
 * schema.org VideoObject.
 *
 * Worth the few lines: a page carrying a VideoObject is eligible for video rich results and a
 * thumbnail in search, which is a direct lift on exactly the pages the SEO work is targeting.
 * `contentUrl` must be a real, publicly fetchable MP4 — Google fetches it to verify — which the
 * R2 public bucket URL is.
 */
export function VideoObjectSchema({ video, pageUrl }: { video: EmbeddedVideo; pageUrl: string }) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com").replace(/\/$/, "");
  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.title,
    ...(video.posterUrl && { thumbnailUrl: [video.posterUrl] }),
    uploadDate: video.createdAt,
    ...(video.durationSeconds && { duration: toIso8601Duration(video.durationSeconds) }),
    contentUrl: video.videoUrl,
    embedUrl: pageUrl.startsWith("http") ? pageUrl : `${siteUrl}${pageUrl}`,
    // publicLanguageTag, not the raw value: "hinglish" is not a BCP-47 tag, and an invalid
    // inLanguage in VideoObject schema is an SEO-visible error. It becomes "hi-Latn".
    inLanguage: publicLanguageTag(video.narrationLang),
    publisher: {
      "@type": "Organization",
      name: "Japanese with Avnish",
      logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` },
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}

/** Renders every video linked to a page, plus one VideoObject each. */
export function ContentVideoSection({ videos, pageUrl }: { videos: EmbeddedVideo[]; pageUrl: string }) {
  if (videos.length === 0) return null;
  return (
    <section aria-label="Videos">
      {videos.map((video) => (
        <div key={video.linkId}>
          <ContentVideo video={video} />
          <VideoObjectSchema video={video} pageUrl={pageUrl} />
        </div>
      ))}
    </section>
  );
}
