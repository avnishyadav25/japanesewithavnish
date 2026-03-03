"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";

type SocialPack = {
  packId: string | null;
  payload: Record<string, unknown>;
  imageUrls: Record<string, string>;
};

type LoadedSocialPackRow = {
  id: string;
  entity_type: string;
  slug: string;
  title: string;
  description?: string | null;
  summary?: string | null;
  link?: string | null;
  reference_image_url?: string | null;
  payload: Record<string, unknown>;
  image_urls?: Record<string, string> | null;
};

export function SocialPrepareForm() {
  const searchParams = useSearchParams();
  const [contentType, setContentType] = useState<"blog" | "product" | "newsletter">("blog");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");
  const [entityId, setEntityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [pack, setPack] = useState<SocialPack | null>(null);
  const [contentLLM, setContentLLM] = useState<"deepseek" | "gemini">("deepseek");
  const [imageGenLoading, setImageGenLoading] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [customUserPrompt, setCustomUserPrompt] = useState("");
  const [link, setLink] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [lastReelVideoUrl, setLastReelVideoUrl] = useState<string | null>(null);
  const [loadPackId, setLoadPackId] = useState("");
  const [loadPackLoading, setLoadPackLoading] = useState(false);
  const imageUrlsRef = useRef<Record<string, string>>({});
  const refInputRef = useRef<HTMLInputElement>(null);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (pack) imageUrlsRef.current = pack.imageUrls;
  }, [pack]);

  function applyLoadedPack(loaded: LoadedSocialPackRow) {
    setPack({
      packId: loaded.id,
      payload: loaded.payload || {},
      imageUrls: loaded.image_urls || {},
    });
    setTitle(loaded.title || title);
    if (loaded.description != null) setDescription(loaded.description || "");
    if (loaded.summary != null) setSummary(loaded.summary || "");
    if (loaded.link != null) setLink(loaded.link || "");
    if (loaded.reference_image_url != null) setReferenceImageUrl(loaded.reference_image_url || "");
  }

  const fetchLookup = useCallback(async (type: string, slugVal: string) => {
    const res = await fetch(`/api/admin/social-lookup?type=${type}&slug=${encodeURIComponent(slugVal)}`, { credentials: "include" });
    const data = await res.json();
    if (data.title) setTitle(data.title);
    if (data.description != null) setDescription(data.description);
    if (data.summary != null) setSummary(data.summary);
    if (data.entity_id) setEntityId(data.entity_id);
    if (data.link) setLink(`${base}${data.link}`);
    else setLink("");
    return data;
  }, [base]);

  useEffect(() => {
    const type = searchParams.get("type");
    const slugParam = searchParams.get("slug");
    if (type === "blog" || type === "product" || type === "newsletter") setContentType(type);
    if (slugParam) {
      setSlug(slugParam);
      fetchLookup(type || "blog", slugParam);
    }
  }, [searchParams, fetchLookup]);

  async function handlePrepopulate() {
    if (!slug.trim()) return;
    setLoading(true);
    try {
      // First try loading an existing pack for this type + slug.
      try {
        const res = await fetch(
          `/api/admin/social-packs?entity_type=${encodeURIComponent(contentType)}&slug=${encodeURIComponent(
            slug.trim()
          )}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.pack) {
            applyLoadedPack(data.pack as LoadedSocialPackRow);
            return;
          }
        }
      } catch {
        // If lookup fails, fall back to source lookup below.
      }

      // If no saved pack yet, fall back to prepopulating from the source content.
      await fetchLookup(contentType, slug.trim());
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateFullPack() {
    setPackLoading(true);
    setPack(null);
    try {
      let linkToSend = link.trim();
      let payloadTitle = title.trim();
      let payloadDescription = description.trim();
      let payloadSummary = summary.trim();
      if (slug.trim()) {
        const data = await fetchLookup(contentType, slug.trim());
        if (data.title) payloadTitle = data.title;
        if (data.description) payloadDescription = data.description;
        if (data.summary) payloadSummary = data.summary ?? payloadSummary;
        linkToSend = data.link ? `${base}${data.link}` : linkToSend;
      }
      const res = await fetch("/api/ai/social-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          slug: slug.trim() || undefined,
          title: payloadTitle,
          description: payloadDescription,
          summary: payloadSummary || undefined,
          link: linkToSend || undefined,
          entity_id: entityId || undefined,
          reference_image_url: referenceImageUrl.trim() || undefined,
          user_prompt: customUserPrompt.trim() || undefined,
          content_llm: contentLLM,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPack({ packId: data.packId, payload: data.payload || {}, imageUrls: {} });
    } catch {
      // Error could be shown via toast or inline state if needed
    } finally {
      setPackLoading(false);
    }
  }

  async function generateImageForSlot(
    slot: string,
    prompt: string,
    options?: { aspectRatio?: string; referenceImageUrl?: string }
  ) {
    if (!pack?.packId || !prompt.trim()) return;
    setImageGenLoading(slot);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageType: "blog",
          prompt: prompt.trim(),
          context: { title: title || "Social" },
          aspectRatio: options?.aspectRatio,
          referenceImageUrl: options?.referenceImageUrl || referenceImageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const url = (data.imageUrl ?? data.url) as string;

      const previousUrl = imageUrlsRef.current[slot];
      if (previousUrl && previousUrl !== url) {
        try {
          await fetch("/api/admin/delete-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: previousUrl }),
            credentials: "include",
          });
        } catch {
          // Best-effort cleanup; ignore failures so the new image still saves.
        }
      }

      const next = { ...imageUrlsRef.current, [slot]: url };
      imageUrlsRef.current = next;
      setPack((prev) => (prev ? { ...prev, imageUrls: next } : prev));
      await fetch(`/api/admin/social-packs/${pack.packId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_urls: next }),
      });
    } catch {
      // show toast or inline error if needed
    } finally {
      setImageGenLoading(null);
    }
  }

  async function handleLoadPack(byId: boolean) {
    setLoadPackLoading(true);
    try {
      const url = byId && loadPackId.trim()
        ? `/api/admin/social-packs?id=${encodeURIComponent(loadPackId.trim())}`
        : `/api/admin/social-packs?entity_type=${encodeURIComponent(contentType)}&slug=${encodeURIComponent(slug.trim())}`;
      if (!byId && !slug.trim()) {
        return;
      }
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (data.error) {
        window.alert(data.error);
        return;
      }
      const loaded = data.pack as LoadedSocialPackRow;
      if (!loaded) return;
      applyLoadedPack(loaded);
    } finally {
      setLoadPackLoading(false);
    }
  }

  async function handleSavePack() {
    if (!pack?.packId) return;
    setSaveLoading(true);
    try {
      await fetch(`/api/admin/social-packs/${pack.packId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_urls: pack.imageUrls,
          reference_image_url: referenceImageUrl.trim() || null,
        }),
      });
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleUploadReference(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRef(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/upload-reference-image", { method: "POST", body: form, credentials: "include" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.url) setReferenceImageUrl(data.url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingRef(false);
      e.target.value = "";
    }
  }

  async function handleCreateReelVideo(imageUrls: string[]) {
    if (imageUrls.length === 0) return;
    setVideoLoading(true);
    setLastReelVideoUrl(null);
    try {
      const res = await fetch("/api/ai/create-reel-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        window.alert(data.error);
        return;
      }
      if (data.videoUrl) {
        setLastReelVideoUrl(data.videoUrl);
        window.open(data.videoUrl, "_blank");
      }
    } finally {
      setVideoLoading(false);
    }
  }

  function copyText(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(text);
  }

  function openShareUrl(platform: string, text: string) {
    const encoded = encodeURIComponent(text);
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encoded}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(base)}&summary=${encoded}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(base)}&quote=${encoded}`,
    };
    const url = urls[platform];
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4 text-xl">Content source</h2>
        <p className="text-secondary text-base mb-4">
          Prepopulate from slug (blog/product/newsletter), or paste title and description. Then generate a full pack.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-base font-medium text-charcoal mb-1">Type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as "blog" | "product" | "newsletter")}
              className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal text-base"
            >
              <option value="blog">Blog</option>
              <option value="product">Product</option>
              <option value="newsletter">Newsletter</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Slug (e.g. best-books-jlpt-n1)"
              className="flex-1 px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal text-base"
            />
            <button
              type="button"
              onClick={handlePrepopulate}
              disabled={loading || !slug.trim()}
              className="btn-primary whitespace-nowrap"
            >
              {loading ? "…" : "Prepopulate"}
            </button>
          </div>
          <div className="border-t border-[var(--divider)] pt-4">
            <label className="block text-base font-medium text-charcoal mb-2">Load existing pack</label>
            <p className="text-secondary text-sm mb-2">Show saved pack by Pack ID, or by content type + slug (latest pack for that content).</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={loadPackId}
                onChange={(e) => setLoadPackId(e.target.value)}
                placeholder="Pack ID (UUID)"
                className="w-72 px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal text-base"
              />
              <button
                type="button"
                onClick={() => handleLoadPack(true)}
                disabled={loadPackLoading || !loadPackId.trim()}
                className="border border-primary text-primary px-4 py-2.5 rounded-bento hover:bg-primary/10 disabled:opacity-50 text-base"
              >
                {loadPackLoading ? "Loading…" : "Load by ID"}
              </button>
              <button
                type="button"
                onClick={() => handleLoadPack(false)}
                disabled={loadPackLoading || !slug.trim()}
                className="border border-primary text-primary px-4 py-2.5 rounded-bento hover:bg-primary/10 disabled:opacity-50 text-base"
              >
                Load by type & slug
              </button>
            </div>
          </div>
          <div>
            <label className="block text-base font-medium text-charcoal mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal text-base"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-charcoal mb-1">Summary (short)</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One-line or short summary"
              className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal text-base"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-charcoal mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Full description or paste from blog/product"
              className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal text-base"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-charcoal mb-1">Link (optional, used in prompt)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://... or /blog/slug (set by Prepopulate)"
              className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal text-base"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-charcoal mb-1">Prompt for full pack (editable)</label>
            <p className="text-secondary text-xs mb-1">This is sent to the AI when you click &quot;Generate full pack&quot;. Edit to add instructions or override the default.</p>
            <textarea
              value={
                customUserPrompt !== ""
                  ? customUserPrompt
                  : `Content type: ${contentType}. Topic/Title: ${title.trim() || "(enter title)"}. ${summary ? `Summary: ${summary}. ` : ""}${description ? `Description: ${description.slice(0, 500)}${description.length > 500 ? "…" : ""}. ` : ""}${link ? `Link: ${link}. ` : ""}Generate the full content pack JSON.`
              }
              onChange={(e) => setCustomUserPrompt(e.target.value)}
              rows={4}
              placeholder="Builds from fields above, or type your own prompt"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
            />
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setCustomUserPrompt("")}
                className="text-sm text-primary hover:underline"
              >
                Reset to default from fields
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-charcoal">Content model:</label>
              <select
                value={contentLLM}
                onChange={(e) => setContentLLM(e.target.value as "deepseek" | "gemini")}
                className="px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal bg-white"
              >
                <option value="deepseek">DeepSeek</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleGenerateFullPack}
              disabled={packLoading || (!title.trim() && !slug.trim())}
              className="border border-primary text-primary px-4 py-2 rounded-bento hover:bg-primary/10 disabled:opacity-50"
            >
              {packLoading ? "Generating full pack…" : "Generate full pack"}
            </button>
          </div>
        </div>
      </AdminCard>

      {pack && (
        <AdminCard>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading font-bold text-charcoal">Full content pack</h2>
            <button
              type="button"
              onClick={handleGenerateFullPack}
              disabled={packLoading}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              Regenerate pack
            </button>
          </div>
          {pack.packId && (
            <p className="text-secondary text-base mb-4">Saved to database. Pack content is stored as soon as it is generated.</p>
          )}
          <div className="mb-4">
            <label className="block text-base font-medium text-charcoal mb-1">Reference image (for japani style). Upload logo or paste URL.</label>
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="url"
                value={referenceImageUrl}
                onChange={(e) => setReferenceImageUrl(e.target.value)}
                placeholder="https://... or upload below"
                className="flex-1 min-w-[200px] px-4 py-2.5 border border-[var(--divider)] rounded-bento text-charcoal text-base"
              />
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadReference}
              />
              <button
                type="button"
                onClick={() => refInputRef.current?.click()}
                disabled={uploadingRef}
                className="border border-primary text-primary px-4 py-2.5 rounded-bento hover:bg-primary/10 disabled:opacity-50 text-base"
              >
                {uploadingRef ? "Uploading…" : "Upload to R2"}
              </button>
            </div>
            {referenceImageUrl && (
              <div className="mt-2">
                <p className="text-secondary text-sm mb-1">Preview:</p>
                <a href={referenceImageUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                  <img src={referenceImageUrl} alt="Reference" className="h-24 w-auto rounded-bento border border-[var(--divider)] object-contain" />
                </a>
              </div>
            )}
          </div>
          <PackSections
            payload={pack.payload}
            imageUrls={pack.imageUrls}
            onCopy={copyText}
            onOpenTab={openShareUrl}
            onGenerateImage={generateImageForSlot}
            imageGenLoading={imageGenLoading}
            referenceImageUrl={referenceImageUrl}
            onCreateReelVideo={handleCreateReelVideo}
            createReelVideoLoading={videoLoading}
            lastReelVideoUrl={lastReelVideoUrl}
          />
          <div className="mt-6 pt-4 border-t border-[var(--divider)]">
            <button
              type="button"
              onClick={handleSavePack}
              disabled={saveLoading || !pack.packId}
              className="btn-primary px-6 py-2.5 text-base disabled:opacity-50"
            >
              {saveLoading ? "Saving…" : "Save"}
            </button>
          </div>
        </AdminCard>
      )}
    </div>
  );
}

type ReelShot = { visual?: string; on_screen_text?: string };
type ReelPayload = { shots?: ReelShot[]; caption_hinglish?: string; hashtags?: string[]; cta_line?: string };
type PostPayload = { caption_hinglish?: string; hashtags?: string[]; cta_line?: string; image_prompt?: string };
type CarouselSlide = { slide_no?: number; title?: string; body?: string; on_screen_caption?: string };
type CarouselPayload = { slides?: CarouselSlide[]; cover?: unknown; design?: unknown };

function PackSections({
  payload,
  imageUrls,
  onCopy,
  onOpenTab,
  onGenerateImage,
  imageGenLoading,
  referenceImageUrl,
  onCreateReelVideo,
  createReelVideoLoading,
  lastReelVideoUrl,
}: {
  payload: Record<string, unknown>;
  imageUrls: Record<string, string>;
  onCopy: (t: string) => void;
  onOpenTab: (platform: string, text: string) => void;
  onGenerateImage: (slot: string, prompt: string, options?: { aspectRatio?: string; referenceImageUrl?: string }) => void;
  imageGenLoading: string | null;
  referenceImageUrl: string;
  onCreateReelVideo?: (imageUrls: string[]) => void;
  createReelVideoLoading?: boolean;
  lastReelVideoUrl?: string | null;
}) {
  const [openPreview, setOpenPreview] = useState<string | null>(null);

  const meta = (payload.meta as { topic?: string; content_angle?: string }) || {};
  const topic = meta.topic || meta.content_angle || "Social";

  // --- Reel ---
  const instagram = (payload.instagram || {}) as { reel?: ReelPayload; post?: PostPayload; carousel?: CarouselPayload };
  const reel = instagram.reel || {};
  const reelShots = reel.shots || [];
  const reelCaption = [reel.caption_hinglish, (reel.hashtags || []).join(" "), reel.cta_line].filter(Boolean).join(" ");

  // --- Post ---
  const post = instagram.post || {};
  const postCaption = [post.caption_hinglish, (post.hashtags || []).join(" "), post.cta_line].filter(Boolean).join(" ");
  const postImagePrompt = post.image_prompt || `${topic} Instagram post image`;

  // --- Carousel ---
  const carousel = instagram.carousel || {};
  const carouselSlides = carousel.slides || [];
  const carouselCaption = (carouselSlides[0]?.body ? carouselSlides.map((s) => s.body).join(" ") : "") || JSON.stringify(carousel);

  // --- Twitter / LinkedIn / Reddit / Pinterest ---
  const twitterPost = (payload.twitter as { post?: { text?: string } })?.post?.text || "";
  const twitterImagePrompt = (payload.twitter as { image_prompt?: string })?.image_prompt || `${topic} Twitter share image`;
  const linkedinPost = (payload.linkedin as { post?: { text?: string } })?.post?.text || "";
  const linkedinImagePrompt = (payload.linkedin as { image_prompt?: string })?.image_prompt || `${topic} LinkedIn share image`;
  const redditPost = (payload.reddit as { post?: { title?: string; body?: string } })?.post;
  const redditText = redditPost ? `${redditPost.title || ""}\n\n${redditPost.body || ""}`.trim() : "";
  const redditImagePrompt = (payload.reddit as { post?: { image_prompt?: string } })?.post?.image_prompt || `${topic} Reddit post image`;
  const pinterestPin = (payload.pinterest as { pin?: { title?: string; description?: string; image_prompt?: string } })?.pin;
  const pinterestText = pinterestPin ? `${pinterestPin.title || ""}\n${pinterestPin.description || ""}`.trim() : "";
  const pinterestImagePrompt = pinterestPin?.image_prompt || `${topic} Pinterest pin image`;

  function SectionBox({
    sectionKey,
    label,
    sectionData,
    actions,
    children,
  }: {
    sectionKey: string;
    label: string;
    sectionData: unknown;
    textToCopy: string;
    actions: React.ReactNode;
    children?: React.ReactNode;
  }) {
    const showPreview = openPreview === sectionKey;
    return (
      <div className="border border-[var(--divider)] rounded-bento p-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span className="font-medium text-charcoal">{label}</span>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setOpenPreview(showPreview ? null : sectionKey)}
              className="text-sm text-primary hover:underline"
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
            {actions}
          </div>
        </div>
        {showPreview && (
          <pre className="text-secondary text-xs overflow-auto max-h-48 whitespace-pre-wrap break-words bg-[var(--base)] p-2 rounded-bento mb-2">
            {JSON.stringify(sectionData, null, 2)}
          </pre>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Instagram Reel */}
      <SectionBox
        sectionKey="instagram_reel"
        label="Instagram Reel"
        sectionData={reel}
        textToCopy={reelCaption}
        actions={
          <>
            <button type="button" onClick={() => onCopy(reelCaption)} className="text-sm text-primary hover:underline">Copy</button>
          </>
        }
      >
        <textarea
          readOnly
          value={reelCaption}
          className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm mb-3 min-h-[80px]"
          rows={3}
        />
        <div className="space-y-2">
          {reelShots.map((shot, i) => {
            const slot = `instagram_reel_${i}`;
            const prompt = shot.visual || shot.on_screen_text || "";
            const url = imageUrls[slot];
            return (
              <div key={i} className="flex items-center gap-2 flex-wrap border border-[var(--divider)] rounded-bento p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-secondary truncate">{prompt || `Shot ${i + 1}`}</p>
                </div>
                {url && (
                  <>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline shrink-0">Preview</a>
                    <img src={url} alt="" className="h-16 w-auto rounded-bento object-cover" />
                  </>
                )}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onGenerateImage(slot, prompt, { aspectRatio: "9:16", referenceImageUrl })}
                    disabled={imageGenLoading === slot || !prompt}
                    className="text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    {imageGenLoading === slot ? "…" : "Generate image"}
                  </button>
                </div>
              </div>
            );
          })}
          {reelShots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  for (let i = 0; i < reelShots.length; i++) {
                    const shot = reelShots[i];
                    const prompt = shot.visual || shot.on_screen_text || "";
                    if (prompt) await onGenerateImage(`instagram_reel_${i}`, prompt, { aspectRatio: "9:16", referenceImageUrl });
                  }
                }}
                disabled={!!imageGenLoading}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {imageGenLoading ? "Generating…" : "Generate all"}
              </button>
              {onCreateReelVideo && (
                <button
                  type="button"
                  onClick={() => {
                    const urls = reelShots.map((_, i) => imageUrls[`instagram_reel_${i}`]).filter(Boolean);
                    onCreateReelVideo(urls);
                  }}
                  disabled={createReelVideoLoading || reelShots.every((_, i) => !imageUrls[`instagram_reel_${i}`])}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  {createReelVideoLoading ? "Creating video…" : "Create video (Reel)"}
                </button>
              )}
            </div>
          )}
          {lastReelVideoUrl && (
            <div className="mt-4 p-3 bg-[var(--base)] rounded-bento border border-[var(--divider)]">
              <p className="text-sm font-medium text-charcoal mb-2">Created reel video</p>
              <video
                src={lastReelVideoUrl}
                controls
                className="max-h-64 w-auto rounded-bento border border-[var(--divider)] bg-black"
                playsInline
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <a href={lastReelVideoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  Open in new tab
                </a>
                <button type="button" onClick={() => onCopy(lastReelVideoUrl)} className="text-sm text-primary hover:underline">
                  Copy URL
                </button>
              </div>
              <p className="text-secondary text-xs mt-1 break-all">{lastReelVideoUrl}</p>
            </div>
          )}
        </div>
      </SectionBox>

      {/* Instagram Post */}
      <SectionBox
        sectionKey="instagram_post"
        label="Instagram Post"
        sectionData={post}
        textToCopy={postCaption}
        actions={
          <>
            <button type="button" onClick={() => onCopy(postCaption)} className="text-sm text-primary hover:underline">Copy</button>
            <button
              type="button"
              onClick={() => onGenerateImage("instagram_post", postImagePrompt, { aspectRatio: "1:1", referenceImageUrl })}
              disabled={imageGenLoading === "instagram_post"}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {imageGenLoading === "instagram_post" ? "Generating…" : imageUrls.instagram_post ? "Regenerate image" : "Generate image"}
            </button>
          </>
        }
      >
        <textarea readOnly value={postCaption} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm mb-2 min-h-[60px]" rows={2} />
        {imageUrls.instagram_post && (
          <a href={imageUrls.instagram_post} target="_blank" rel="noopener noreferrer" className="inline-block">
            <img src={imageUrls.instagram_post} alt="" className="max-h-32 rounded-bento border border-[var(--divider)]" />
          </a>
        )}
      </SectionBox>

      {/* Instagram Carousel */}
      <SectionBox
        sectionKey="instagram_carousel"
        label="Instagram Carousel"
        sectionData={carousel}
        textToCopy={carouselCaption}
        actions={
          <>
            <button type="button" onClick={() => onCopy(carouselCaption)} className="text-sm text-primary hover:underline">Copy</button>
          </>
        }
      >
        <textarea readOnly value={carouselCaption} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm mb-3 min-h-[60px]" rows={2} />
        <div className="space-y-2">
          {(carouselSlides as CarouselSlide[]).slice(0, 10).map((slide, i) => {
            const slot = `instagram_carousel_${i}`;
            const prompt = slide.on_screen_caption || slide.body || slide.title || "";
            const url = imageUrls[slot];
            return (
              <div key={i} className="flex items-center gap-2 flex-wrap border border-[var(--divider)] rounded-bento p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-secondary truncate">{prompt || `Slide ${i + 1}`}</p>
                </div>
                {url && (
                  <>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline shrink-0">Preview</a>
                    <img src={url} alt="" className="h-16 w-auto rounded-bento object-cover" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onGenerateImage(slot, prompt, { aspectRatio: "1:1", referenceImageUrl })}
                  disabled={imageGenLoading === slot || !prompt}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  {imageGenLoading === slot ? "…" : "Generate image"}
                </button>
              </div>
            );
          })}
          {carouselSlides.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                for (let i = 0; i < Math.min(10, carouselSlides.length); i++) {
                  const slide = carouselSlides[i];
                  const prompt = slide.on_screen_caption || slide.body || slide.title || "";
                  if (prompt) await onGenerateImage(`instagram_carousel_${i}`, prompt, { aspectRatio: "1:1", referenceImageUrl });
                }
              }}
              disabled={!!imageGenLoading}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {imageGenLoading ? "Generating…" : "Generate all"}
            </button>
          )}
        </div>
      </SectionBox>

      {/* Twitter */}
      <SectionBox
        sectionKey="twitter"
        label="Twitter"
        sectionData={payload.twitter || {}}
        textToCopy={twitterPost}
        actions={
          <>
            {twitterPost && (
              <button type="button" onClick={() => onOpenTab("twitter", twitterPost)} className="text-sm text-primary hover:underline">Open in new tab</button>
            )}
            <button type="button" onClick={() => onCopy(twitterPost)} className="text-sm text-primary hover:underline">Copy</button>
            <button
              type="button"
              onClick={() => onGenerateImage("twitter_image", twitterImagePrompt, { aspectRatio: "1:1", referenceImageUrl })}
              disabled={imageGenLoading === "twitter_image"}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {imageGenLoading === "twitter_image" ? "Generating…" : imageUrls.twitter_image ? "Regenerate image" : "Generate image"}
            </button>
          </>
        }
      >
        <pre className="text-secondary text-sm whitespace-pre-wrap break-words">{twitterPost || "—"}</pre>
        {imageUrls.twitter_image && (
          <a href={imageUrls.twitter_image} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
            <img src={imageUrls.twitter_image} alt="" className="max-h-32 rounded-bento border border-[var(--divider)]" />
          </a>
        )}
      </SectionBox>

      {/* LinkedIn */}
      <SectionBox
        sectionKey="linkedin"
        label="LinkedIn"
        sectionData={payload.linkedin || {}}
        textToCopy={linkedinPost}
        actions={
          <>
            {linkedinPost && (
              <button type="button" onClick={() => onOpenTab("linkedin", linkedinPost)} className="text-sm text-primary hover:underline">Open in new tab</button>
            )}
            <button type="button" onClick={() => onCopy(linkedinPost)} className="text-sm text-primary hover:underline">Copy</button>
            <button
              type="button"
              onClick={() => onGenerateImage("linkedin_image", linkedinImagePrompt, { aspectRatio: "1:1", referenceImageUrl })}
              disabled={imageGenLoading === "linkedin_image"}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {imageGenLoading === "linkedin_image" ? "Generating…" : imageUrls.linkedin_image ? "Regenerate image" : "Generate image"}
            </button>
          </>
        }
      >
        <pre className="text-secondary text-sm whitespace-pre-wrap break-words">{linkedinPost || "—"}</pre>
        {imageUrls.linkedin_image && (
          <a href={imageUrls.linkedin_image} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
            <img src={imageUrls.linkedin_image} alt="" className="max-h-32 rounded-bento border border-[var(--divider)]" />
          </a>
        )}
      </SectionBox>

      {/* Reddit */}
      <SectionBox
        sectionKey="reddit"
        label="Reddit"
        sectionData={payload.reddit || {}}
        textToCopy={redditText}
        actions={
          <>
            {redditText && (
              <a
                href={`https://www.reddit.com/submit?title=${encodeURIComponent(redditPost?.title || "")}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Open in new tab
              </a>
            )}
            <button type="button" onClick={() => onCopy(redditText)} className="text-sm text-primary hover:underline">Copy</button>
            <button
              type="button"
              onClick={() => onGenerateImage("reddit_image", redditImagePrompt, { aspectRatio: "1:1", referenceImageUrl })}
              disabled={imageGenLoading === "reddit_image"}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {imageGenLoading === "reddit_image" ? "Generating…" : imageUrls.reddit_image ? "Regenerate image" : "Generate image"}
            </button>
          </>
        }
      >
        <pre className="text-secondary text-sm whitespace-pre-wrap break-words">{redditText || "—"}</pre>
        {imageUrls.reddit_image && (
          <a href={imageUrls.reddit_image} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
            <img src={imageUrls.reddit_image} alt="" className="max-h-32 rounded-bento border border-[var(--divider)]" />
          </a>
        )}
      </SectionBox>

      {/* Pinterest */}
      <SectionBox
        sectionKey="pinterest"
        label="Pinterest"
        sectionData={payload.pinterest || {}}
        textToCopy={pinterestText}
        actions={
          <>
            <button type="button" onClick={() => onCopy(pinterestText)} className="text-sm text-primary hover:underline">Copy</button>
            <button
              type="button"
              onClick={() => onGenerateImage("pinterest_image", pinterestImagePrompt, { aspectRatio: "1:1", referenceImageUrl })}
              disabled={imageGenLoading === "pinterest_image"}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {imageGenLoading === "pinterest_image" ? "Generating…" : imageUrls.pinterest_image ? "Regenerate image" : "Generate image"}
            </button>
          </>
        }
      >
        <pre className="text-secondary text-sm whitespace-pre-wrap break-words">{pinterestText || "—"}</pre>
        {imageUrls.pinterest_image && (
          <a href={imageUrls.pinterest_image} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
            <img src={imageUrls.pinterest_image} alt="" className="max-h-32 rounded-bento border border-[var(--divider)]" />
          </a>
        )}
      </SectionBox>
    </div>
  );
}
