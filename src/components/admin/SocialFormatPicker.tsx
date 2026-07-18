"use client";

import { SOCIAL_IMAGE_FORMATS, type SocialFormatId } from "@/lib/ai/social-formats";

/** Reusable format-picker row for image generation UIs — one shared source of truth for
 * social/feature-image aspect ratios instead of each editor hardcoding its own. */
export function SocialFormatPicker({
  value,
  onChange,
}: {
  value: SocialFormatId;
  onChange: (id: SocialFormatId) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-charcoal mb-1.5">Image format</label>
      <div className="flex flex-wrap gap-1.5">
        {SOCIAL_IMAGE_FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            title={f.description}
            className={`px-3 py-1.5 rounded-bento text-xs font-medium border transition ${
              value === f.id
                ? "bg-primary text-white border-primary"
                : "bg-white text-charcoal border-[var(--divider)] hover:border-primary/40"
            }`}
          >
            {f.label} <span className="opacity-70">({f.aspectRatio})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
