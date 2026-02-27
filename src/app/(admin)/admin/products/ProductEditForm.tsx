"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { GenerateContentButton } from "@/components/admin/GenerateContentButton";
import { GenerateImageModal } from "@/components/admin/GenerateImageModal";

type FaqItem = { q: string; a: string };

interface ProductForEdit {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_paise: number;
  compare_price_paise: number | null;
  badge: string | null;
  jlpt_level: string | null;
  preview_url: string | null;
  who_its_for: string | null;
  outcome: string | null;
  whats_included: string[] | null;
  faq: FaqItem[] | null;
  no_refunds_note: string | null;
  is_mega: boolean;
  image_url: string | null;
  image_prompt: string | null;
  gallery_images: string[] | null;
}

const FIELD_LABEL = "block text-sm font-medium text-charcoal mb-1";
const INPUT = "w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function ProductEditForm({ product }: { product: ProductForEdit }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [imageModalField, setImageModalField] = useState<"feature" | number | null>(null);

  const [form, setForm] = useState({
    name: product.name ?? "",
    slug: product.slug ?? "",
    description: product.description ?? "",
    price_paise: product.price_paise ?? 0,
    compare_price_paise: product.compare_price_paise ?? "",
    badge: product.badge ?? "",
    jlpt_level: product.jlpt_level ?? "",
    preview_url: product.preview_url ?? "",
    who_its_for: product.who_its_for ?? "",
    outcome: product.outcome ?? "",
    whats_included: (product.whats_included || []).join("\n"),
    faq: (product.faq || []).map((f) => `${f.q} | ${f.a}`).join("\n"),
    no_refunds_note: product.no_refunds_note ?? "All digital purchases are final. No refunds.",
    is_mega: product.is_mega ?? false,
    image_url: product.image_url ?? "",
    image_prompt: product.image_prompt ?? "",
    gallery_images: product.gallery_images ?? [],
  });

  function update<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function updateGallery(index: number, url: string) {
    setForm((f) => {
      const imgs = [...f.gallery_images];
      imgs[index] = url;
      return { ...f, gallery_images: imgs };
    });
  }

  function addGallerySlot() {
    if (form.gallery_images.length >= 6) return;
    setForm((f) => ({ ...f, gallery_images: [...f.gallery_images, ""] }));
  }

  function removeGallery(index: number) {
    setForm((f) => ({ ...f, gallery_images: f.gallery_images.filter((_, i) => i !== index) }));
  }

  // Called when AI generates product copy
  function onAIGenerated(data: unknown) {
    if (typeof data === "string") return;
    const d = data as {
      description?: string;
      who_its_for?: string;
      outcome?: string;
      whats_included?: string[];
      faq?: FaqItem[];
      no_refunds_note?: string;
      image_prompt?: string;
    };
    if (d.description) update("description", d.description);
    if (d.who_its_for) update("who_its_for", d.who_its_for);
    if (d.outcome) update("outcome", d.outcome);
    if (d.whats_included) update("whats_included", d.whats_included.join("\n"));
    if (d.faq) update("faq", d.faq.map((f) => `${f.q} | ${f.a}`).join("\n"));
    if (d.no_refunds_note) update("no_refunds_note", d.no_refunds_note);
    if (d.image_prompt) update("image_prompt", d.image_prompt);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const whats_included = form.whats_included
      .split("\n").map((l) => l.trim()).filter(Boolean);
    const faq: FaqItem[] = form.faq
      .split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => {
        const [q, ...rest] = l.split("|");
        return { q: q.trim(), a: rest.join("|").trim() };
      });
    const gallery_images = form.gallery_images.filter(Boolean);

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description || null,
          price_paise: Number(form.price_paise),
          compare_price_paise: form.compare_price_paise ? Number(form.compare_price_paise) : null,
          badge: form.badge || null,
          jlpt_level: form.jlpt_level || null,
          preview_url: form.preview_url || null,
          who_its_for: form.who_its_for || null,
          outcome: form.outcome || null,
          whats_included: whats_included.length ? whats_included : null,
          faq: faq.length ? faq : null,
          no_refunds_note: form.no_refunds_note || null,
          is_mega: form.is_mega,
          image_url: form.image_url || null,
          image_prompt: form.image_prompt || null,
          gallery_images: gallery_images.length ? gallery_images : [],
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const aiContext = {
    topic: form.name,
    jlptLevel: form.jlpt_level || undefined,
    description: form.description || undefined,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section header with AI Generate */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-base font-bold text-charcoal">Product Editor</h2>
          <p className="text-secondary text-xs mt-0.5">Edit all fields, generate copy with AI, manage images.</p>
        </div>
        <GenerateContentButton
          contentType="product"
          context={aiContext}
          onGenerated={onAIGenerated}
          className="btn-secondary text-sm px-4 h-9"
        />
      </div>

      {/* 1 — Basic Info */}
      <AdminCard>
        <h3 className="font-heading font-semibold text-charcoal mb-4 text-sm flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">1</span>
          Basic Info
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={FIELD_LABEL}>Product name</label>
              <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} className={INPUT} required />
            </div>
            <div>
              <label className={FIELD_LABEL}>Slug <span className="text-secondary font-normal">(URL key)</span></label>
              <input type="text" value={form.slug} onChange={(e) => update("slug", e.target.value)} className={`${INPUT} font-mono`} required />
            </div>
          </div>

          <div>
            <label className={FIELD_LABEL}>Description <span className="text-secondary font-normal">(shown on store grid + meta)</span></label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder="2–3 sentence compelling product description…"
              className={INPUT}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer gap-2">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.is_mega}
                  onChange={(e) => update("is_mega", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-[var(--divider)] rounded-full peer peer-checked:bg-primary transition-colors" />
                <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
              </div>
              <span className="text-sm font-medium text-charcoal">Mega Bundle</span>
            </label>
            <span className="text-secondary text-xs">Mark this as the flagship bundle</span>
          </div>
        </div>
      </AdminCard>

      {/* 2 — Pricing */}
      <AdminCard>
        <h3 className="font-heading font-semibold text-charcoal mb-4 text-sm flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">2</span>
          Pricing
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={FIELD_LABEL}>Price (₹) <span className="text-secondary font-normal">— enter in Rupees</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">₹</span>
              <input
                type="number"
                min="0"
                value={Math.round(Number(form.price_paise) / 100)}
                onChange={(e) => update("price_paise", Math.round(Number(e.target.value) * 100))}
                className={`${INPUT} pl-7`}
                required
              />
            </div>
            <p className="text-xs text-secondary mt-1">Stored as {form.price_paise} paise</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Compare price (₹) <span className="text-secondary font-normal">— shown with strikethrough</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">₹</span>
              <input
                type="number"
                min="0"
                value={form.compare_price_paise ? Math.round(Number(form.compare_price_paise) / 100) : ""}
                onChange={(e) => update("compare_price_paise", e.target.value ? Math.round(Number(e.target.value) * 100) : "")}
                placeholder="Optional"
                className={`${INPUT} pl-7`}
              />
            </div>
          </div>
        </div>
      </AdminCard>

      {/* 3 — Classification */}
      <AdminCard>
        <h3 className="font-heading font-semibold text-charcoal mb-4 text-sm flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">3</span>
          Classification
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={FIELD_LABEL}>Badge</label>
            <select value={form.badge} onChange={(e) => update("badge", e.target.value)} className={INPUT}>
              <option value="">None</option>
              <option value="offer">Offer</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL}>JLPT Level</label>
            <select value={form.jlpt_level} onChange={(e) => update("jlpt_level", e.target.value)} className={INPUT}>
              <option value="">—</option>
              {["N5", "N4", "N3", "N2", "N1", "Mega"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL}>Preview URL</label>
            <input type="url" value={form.preview_url} onChange={(e) => update("preview_url", e.target.value)} placeholder="https://youtube.com/…" className={INPUT} />
            <p className="text-xs text-secondary mt-1">YouTube/PDF sample link</p>
          </div>
        </div>
      </AdminCard>

      {/* 4 — Product Copy */}
      <AdminCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-charcoal text-sm flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">4</span>
            Product Copy
          </h3>
          <GenerateContentButton
            contentType="product"
            context={aiContext}
            onGenerated={onAIGenerated}
            className="text-xs text-primary hover:underline"
          />
        </div>
        <div className="space-y-4">
          <div>
            <label className={FIELD_LABEL}>Who it&apos;s for</label>
            <textarea
              value={form.who_its_for}
              onChange={(e) => update("who_its_for", e.target.value)}
              rows={3}
              placeholder={"Students preparing for JLPT N5\nSelf-learners wanting structured offline resources\nLearners needing practice tests"}
              className={INPUT}
            />
            <p className="text-xs text-secondary mt-1">One bullet per line, no symbols needed</p>
          </div>

          <div>
            <label className={FIELD_LABEL}>Outcome</label>
            <textarea
              value={form.outcome}
              onChange={(e) => update("outcome", e.target.value)}
              rows={2}
              placeholder="What the learner will be able to do after completing this bundle."
              className={INPUT}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>What&apos;s included <span className="text-secondary font-normal">(one item per line)</span></label>
            <textarea
              value={form.whats_included}
              onChange={(e) => update("whats_included", e.target.value)}
              rows={6}
              placeholder={"Kanji Mastery Guide: 100 essential kanji\nVocabulary Workbook: 800+ beginner words\nMock Tests ×5: full-length practice papers"}
              className={`${INPUT} font-mono`}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>FAQ <span className="text-secondary font-normal">(one per line as &quot;Question | Answer&quot;)</span></label>
            <textarea
              value={form.faq}
              onChange={(e) => update("faq", e.target.value)}
              rows={5}
              placeholder={"How do I access after purchase? | You will receive a magic link by email.\nCan I study offline? | Yes, all PDFs and audio can be downloaded."}
              className={`${INPUT} font-mono text-xs`}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>No refunds note</label>
            <input
              type="text"
              value={form.no_refunds_note}
              onChange={(e) => update("no_refunds_note", e.target.value)}
              className={INPUT}
              placeholder="All digital purchases are final. No refunds."
            />
            <p className="text-xs text-secondary mt-1">Shown on product page under FAQ</p>
          </div>
        </div>
      </AdminCard>

      {/* 5 — Images */}
      <AdminCard>
        <h3 className="font-heading font-semibold text-charcoal mb-4 text-sm flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">5</span>
          Images
        </h3>

        {/* Feature image */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <label className={`${FIELD_LABEL} mb-0`}>Feature / Hero Image</label>
            <button
              type="button"
              onClick={() => setImageModalField("feature")}
              className="text-xs text-primary hover:underline"
            >
              {form.image_url ? "Regenerate with AI" : "Generate with AI"}
            </button>
          </div>
          <input
            type="url"
            value={form.image_url}
            onChange={(e) => update("image_url", e.target.value)}
            placeholder="https://…"
            className={INPUT}
          />
          {form.image_url && (
            <div className="mt-2 rounded-bento overflow-hidden border border-[var(--divider)] max-w-sm aspect-video relative bg-[var(--base)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.image_url} alt="Feature preview" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="mt-3">
            <label className={FIELD_LABEL}>Image prompt <span className="text-secondary font-normal">(for AI image generation)</span></label>
            <textarea
              value={form.image_prompt}
              onChange={(e) => update("image_prompt", e.target.value)}
              rows={2}
              placeholder="Detailed description for AI image generation…"
              className={`${INPUT} font-mono text-xs`}
            />
          </div>
        </div>

        {/* Gallery images */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className={`${FIELD_LABEL} mb-0`}>Gallery Images <span className="text-secondary font-normal">({form.gallery_images.length}/6)</span></label>
            {form.gallery_images.length < 6 && (
              <button type="button" onClick={addGallerySlot} className="text-xs text-primary hover:underline">
                + Add image
              </button>
            )}
          </div>

          {form.gallery_images.length === 0 ? (
            <button
              type="button"
              onClick={addGallerySlot}
              className="w-full border-2 border-dashed border-[var(--divider)] rounded-bento py-6 text-secondary text-sm hover:border-primary/40 hover:text-primary transition-colors"
            >
              + Add first gallery image
            </button>
          ) : (
            <div className="space-y-3">
              {form.gallery_images.map((url, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-secondary text-xs w-5">{i + 1}.</span>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateGallery(i, e.target.value)}
                      placeholder="https://…"
                      className={`${INPUT} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => setImageModalField(i)}
                      className="text-xs text-primary hover:underline whitespace-nowrap"
                    >
                      AI
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGallery(i)}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline"
                    >
                      ✕
                    </button>
                  </div>
                  {url && (
                    <div className="ml-7 rounded-bento overflow-hidden border border-[var(--divider)] w-32 h-20 relative bg-[var(--base)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminCard>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save product"}
        </button>
        <a href={`/product/${form.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-secondary hover:text-primary hover:underline transition">
          View on site ↗
        </a>
        {success && <span className="text-sm text-green-600">✓ Saved successfully</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* Image generation modal — feature */}
      {imageModalField === "feature" && (
        <GenerateImageModal
          open={true}
          onClose={() => setImageModalField(null)}
          imageType="product"
          initialContext={{
            topic: form.name,
            title: form.name,
            jlptLevel: form.jlpt_level || undefined,
            description: form.description || undefined,
          }}
          initialPrompt={form.image_prompt || undefined}
          onGenerated={(result) => {
            if (result.startsWith("http://") || result.startsWith("https://")) {
              update("image_url", result);
            }
            setImageModalField(null);
          }}
        />
      )}

      {/* Image generation modal — gallery */}
      {typeof imageModalField === "number" && (
        <GenerateImageModal
          open={true}
          onClose={() => setImageModalField(null)}
          imageType="product"
          initialContext={{
            topic: `${form.name} — gallery image ${imageModalField + 1}`,
            title: form.name,
            jlptLevel: form.jlpt_level || undefined,
          }}
          onGenerated={(result) => {
            if (result.startsWith("http://") || result.startsWith("https://")) {
              updateGallery(imageModalField as number, result);
            }
            setImageModalField(null);
          }}
        />
      )}
    </form>
  );
}
