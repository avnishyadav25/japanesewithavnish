"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FaqItem = { q: string; a: string };

interface ProductForEdit {
  id: string;
  name: string;
  slug: string;
  badge: string | null;
  jlpt_level: string | null;
  preview_url: string | null;
  who_its_for: string | null;
  outcome: string | null;
  whats_included: string[] | null;
  faq: FaqItem[] | null;
  no_refunds_note: string | null;
}

export function ProductEditForm({ product }: { product: ProductForEdit }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [badge, setBadge] = useState(product.badge ?? "");
  const [jlptLevel, setJlptLevel] = useState(product.jlpt_level ?? "");
  const [previewUrl, setPreviewUrl] = useState(product.preview_url ?? "");
  const [whoItsFor, setWhoItsFor] = useState(product.who_its_for ?? "");
  const [outcome, setOutcome] = useState(product.outcome ?? "");
  const [whatsIncludedRaw, setWhatsIncludedRaw] = useState(
    (product.whats_included || []).join("\n")
  );
  const [faqRaw, setFaqRaw] = useState(
    (product.faq || [])
      .map((item) => `${item.q} | ${item.a}`)
      .join("\n")
  );
  const [noRefundsNote, setNoRefundsNote] = useState(
    product.no_refunds_note ?? ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const whats_included = whatsIncludedRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const faq: FaqItem[] = faqRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [q, a] = line.split("|").map((part) => part.trim());
          return { q, a: a || "" };
        });

      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badge: badge || null,
          jlpt_level: jlptLevel || null,
          preview_url: previewUrl || null,
          who_its_for: whoItsFor || null,
          outcome: outcome || null,
          whats_included: whats_included.length ? whats_included : null,
          faq: faq.length ? faq : null,
          no_refunds_note: noRefundsNote || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save product");
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-charcoal mb-2">
          Product meta
        </h2>
        <p className="text-secondary text-sm">
          These fields power the Store grid, product detail layout, and
          checkout/FAQ copy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Badge
          </label>
          <select
            className="w-full px-3 py-2 border-2 border-[var(--divider)] rounded-bento text-sm"
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
          >
            <option value="">None</option>
            <option value="offer">Offer</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            JLPT level
          </label>
          <select
            className="w-full px-3 py-2 border-2 border-[var(--divider)] rounded-bento text-sm"
            value={jlptLevel}
            onChange={(e) => setJlptLevel(e.target.value)}
          >
            <option value="">None</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
            <option value="N3">N3</option>
            <option value="N2">N2</option>
            <option value="N1">N1</option>
            <option value="Mega">Mega</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Preview URL
          </label>
          <input
            type="url"
            className="w-full px-3 py-2 border-2 border-[var(--divider)] rounded-bento text-sm"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-secondary mt-1">
            Optional link to sample PDF or preview content.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            No refunds note
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border-2 border-[var(--divider)] rounded-bento text-sm"
            value={noRefundsNote}
            onChange={(e) => setNoRefundsNote(e.target.value)}
            placeholder="No refunds for digital products..."
          />
          <p className="text-xs text-secondary mt-1">
            Short line shown on the product page under FAQ.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Who it&apos;s for
        </label>
        <textarea
          className="w-full px-3 py-2 border-2 border-[var(--divider)] rounded-bento text-sm min-h-[80px]"
          value={whoItsFor}
          onChange={(e) => setWhoItsFor(e.target.value)}
        />
        <p className="text-xs text-secondary mt-1">
          2–3 short bullets or sentences about the ideal learner.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Outcome
        </label>
        <textarea
          className="w-full px-3 py-2 border-2 border-[var(--divider)] rounded-bento text-sm min-h-[80px]"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        />
        <p className="text-xs text-secondary mt-1">
          What the learner will be able to do after finishing this bundle.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          What&apos;s included (one per line)
        </label>
        <textarea
          className="w-full px-3 py-2 border-2 border-[var(--divider)] rounded-bento text-sm min-h-[120px]"
          value={whatsIncludedRaw}
          onChange={(e) => setWhatsIncludedRaw(e.target.value)}
          placeholder={"Kanji workbook\nVocabulary workbook\nMock tests (x5)"}
        />
        <p className="text-xs text-secondary mt-1">
          Each line becomes one bullet in the &quot;What&apos;s included&quot;
          list.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Product FAQ (one per line as &quot;Question | Answer&quot;)
        </label>
        <textarea
          className="w-full px-3 py-2 border-2 border-[var(--divider)] rounded-bento text-sm min-h-[140px]"
          value={faqRaw}
          onChange={(e) => setFaqRaw(e.target.value)}
          placeholder={
            "How do I access after payment? | You will receive an email with a magic link to your library.\nCan I study on mobile? | Yes, you can download PDFs and audio to your phone or tablet."
          }
        />
        <p className="text-xs text-secondary mt-1">
          Used on the product detail page FAQ section.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="btn-primary"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save product"}
        </button>
        {success && (
          <span className="text-xs text-emerald-600">
            Saved. Refresh the product page to see changes.
          </span>
        )}
        {error && <span className="text-xs text-primary">{error}</span>}
      </div>
    </form>
  );
}

