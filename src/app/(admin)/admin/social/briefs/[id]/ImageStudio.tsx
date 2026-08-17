"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { SOCIAL_IMAGE_SIZES, backgroundFit, type ImageSize } from "@/lib/social/imageSizes";

/**
 * Thumbnails and feature images for a brief.
 *
 * THE TEXT IS DRAWN IN THE BROWSER, and that is the whole design decision. Two things ruled out
 * the obvious alternatives:
 *
 *   - Image models cannot spell. A generated thumbnail with a garbled headline is unusable, and a
 *     headline is most of what a thumbnail does. So the model draws only the illustration.
 *   - `sharp` on the server silently ignores an embedded @font-face and falls back to system
 *     fonts — verified: a nonexistent font-family rendered identically to an embedded one. On a
 *     serverless function that means no DM Sans and no CJK font, so 猫 would come out as a box.
 *
 * This page already has DM Sans loaded by next/font and a CJK font from the operating system, so a
 * canvas here renders exactly what the site renders. It is also WYSIWYG: you see the real thing
 * before saving, and can retype the headline until it fits.
 */
interface Background {
  url: string;
  prompt: string;
}

const THEME = {
  ink: "#1A1A1A",
  paper: "#FAF8F5",
  accent: "#E11D2E",
  muted: "#6B6B6B",
};

export function ImageStudio({
  briefId,
  defaultHeadline,
  jlptLevel,
  hasPost,
}: {
  briefId: string;
  defaultHeadline: string;
  jlptLevel: string | null;
  hasPost: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [chosen, setChosen] = useState(0);
  const [headline, setHeadline] = useState(defaultHeadline.slice(0, 60));
  const [eyebrow, setEyebrow] = useState(jlptLevel ?? "");
  const [textSide, setTextSide] = useState<"left" | "right" | "bottom">("left");
  const [generating, setGenerating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(SOCIAL_IMAGE_SIZES.map((s) => s.key));

  const canvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const bgImages = useRef<Map<string, HTMLImageElement>>(new Map());

  /** One request per candidate: a Gemini image measured 8.6s, so three in one call would time out. */
  async function generate(count = 3) {
    setError(null);
    setNotice(null);
    setGenerating(count);
    const made: Background[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const res = await fetch(`/api/admin/social/briefs/${briefId}/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "background", textSide }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        made.push({ url: data.url, prompt: data.prompt });
        setBackgrounds((prev) => [...prev, { url: data.url, prompt: data.prompt }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed");
        break;
      } finally {
        setGenerating((n) => n - 1);
      }
    }
    if (made.length > 0) setNotice(`${made.length} background${made.length === 1 ? "" : "s"} generated. Pick one.`);
  }

  /**
   * Draws one size.
   *
   * The background is cover-fitted rather than stretched: Gemini returns 1024x1024 whatever aspect
   * ratio the prompt asks for, so every target needs cropping and a squashed illustration would be
   * obvious. A scrim behind the text keeps a light headline legible over a light illustration —
   * without it, contrast depends on whatever the model happened to draw.
   */
  const draw = useCallback(
    (size: ImageSize, canvas: HTMLCanvasElement, img: HTMLImageElement | null) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width: W, height: H } = size;
      canvas.width = W;
      canvas.height = H;

      ctx.fillStyle = THEME.paper;
      ctx.fillRect(0, 0, W, H);

      // Gemini returns a square whatever the prompt asks for. Cover-fitting that into 1280x720
      // cuts the top and bottom off and ruins the composition, so wide formats get the image as a
      // PANEL on one side with the headline on flat colour beside it — no crop, and contrast that
      // does not depend on what the model happened to draw.
      const fit = backgroundFit(size);
      const panelSide = textSide === "right" ? "left" : "right";
      let panelX = 0;
      let panelW = 0;

      if (img && img.complete && img.naturalWidth > 0) {
        if (fit === "panel") {
          panelW = Math.round(W * 0.55);
          panelX = panelSide === "right" ? W - panelW : 0;
          const scale = Math.max(panelW / img.naturalWidth, H / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          ctx.save();
          ctx.beginPath();
          ctx.rect(panelX, 0, panelW, H);
          ctx.clip();
          ctx.drawImage(img, panelX + (panelW - dw) / 2, (H - dh) / 2, dw, dh);
          ctx.restore();
        } else {
          const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        }
      }

      const pad = Math.round(W * 0.06);
      const isBottom = fit === "cover" && (textSide === "bottom" || H > W * 1.2);
      const boxW =
        fit === "panel" ? W - panelW - pad * 2 : isBottom ? W - pad * 2 : Math.round(W * 0.52);
      const boxX =
        fit === "panel"
          ? panelSide === "right"
            ? pad
            : panelW + pad
          : isBottom
            ? pad
            : textSide === "right"
              ? W - boxW - pad
              : pad;

      // Wrap by measured width, not by character count — a CJK headline and a Latin one of the
      // same length are wildly different widths.
      const titleSize = Math.round(isBottom ? W * 0.075 : W * 0.085);
      ctx.font = `700 ${titleSize}px "DM Sans", var(--font-sans), system-ui, sans-serif`;
      const words = headline.trim().split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > boxW && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      // No headline is a legitimate choice for a purely illustrative image.
      if (lines.length === 0) return;

      const lineHeight = Math.round(titleSize * 1.18);
      const eyebrowSize = Math.round(titleSize * 0.34);
      const blockH = lines.length * lineHeight + (eyebrow ? eyebrowSize * 2 : 0);
      const blockY = isBottom ? H - pad - blockH : Math.round((H - blockH) / 2);

      // Scrim only over the illustration. In panel mode the text already sits on flat paper, and
      // a translucent box on a solid background reads as a rendering bug.
      const scrimPad = Math.round(titleSize * 0.5);
      if (fit === "panel") {
        ctx.fillStyle = "rgba(0,0,0,0)";
      } else {
        ctx.fillStyle = "rgba(250,248,245,0.9)";
      }
      const radius = Math.round(W * 0.02);
      const sx = boxX - scrimPad;
      const sy = blockY - scrimPad;
      const sw = boxW + scrimPad * 2;
      const sh = blockH + scrimPad * 2;
      ctx.beginPath();
      ctx.moveTo(sx + radius, sy);
      ctx.arcTo(sx + sw, sy, sx + sw, sy + sh, radius);
      ctx.arcTo(sx + sw, sy + sh, sx, sy + sh, radius);
      ctx.arcTo(sx, sy + sh, sx, sy, radius);
      ctx.arcTo(sx, sy, sx + sw, sy, radius);
      ctx.closePath();
      ctx.fill();

      let y = blockY;
      if (eyebrow) {
        ctx.font = `700 ${eyebrowSize}px "DM Sans", system-ui, sans-serif`;
        ctx.fillStyle = THEME.accent;
        ctx.textBaseline = "top";
        ctx.fillText(eyebrow.toUpperCase(), boxX, y);
        y += eyebrowSize * 2;
      }
      ctx.font = `700 ${titleSize}px "DM Sans", var(--font-sans), system-ui, sans-serif`;
      ctx.fillStyle = THEME.ink;
      ctx.textBaseline = "top";
      for (const l of lines) {
        ctx.fillText(l, boxX, y);
        y += lineHeight;
      }
    },
    [headline, eyebrow, textSide]
  );

  // Redraw whenever anything visible changes. Waiting for document.fonts means the first paint is
  // in DM Sans rather than a fallback that then shifts.
  useEffect(() => {
    const bg = backgrounds[chosen];
    let cancelled = false;

    async function run() {
      await document.fonts.ready;
      let img: HTMLImageElement | null = null;
      if (bg) {
        img = bgImages.current.get(bg.url) ?? null;
        if (!img) {
          img = new Image();
          // Required to read the canvas back after drawing a cross-origin R2 image; without it
          // toDataURL throws a security error and the save silently cannot work.
          img.crossOrigin = "anonymous";
          img.src = bg.url;
          bgImages.current.set(bg.url, img);
          await img.decode().catch(() => undefined);
        }
      }
      if (cancelled) return;
      for (const size of SOCIAL_IMAGE_SIZES) {
        const canvas = canvases.current.get(size.key);
        if (canvas) draw(size, canvas, img);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [backgrounds, chosen, draw]);

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const images = SOCIAL_IMAGE_SIZES.filter((s) => selectedSizes.includes(s.key))
        .map((size) => {
          const canvas = canvases.current.get(size.key);
          if (!canvas) return null;
          // JPEG at 0.9: a 1280x720 PNG of a flat illustration is several MB and every platform
          // re-encodes it anyway.
          return { sizeKey: size.key, dataUrl: canvas.toDataURL("image/jpeg", 0.9), surfaces: size.surfaces };
        })
        .filter(Boolean);

      const res = await fetch(`/api/admin/social/briefs/${briefId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setNotice(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminCard className="mb-6">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <span>
          <span className="text-sm font-semibold text-charcoal">Thumbnail &amp; feature images</span>
          <span className="block text-xs text-secondary mt-0.5">
            AI illustration, headline drawn here so it spells correctly. {SOCIAL_IMAGE_SIZES.length} sizes.
          </span>
        </span>
        <span className="text-xs text-secondary">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-semibold text-charcoal">Headline</span>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={60}
                className="mt-1 w-full border border-[var(--divider)] rounded-button px-3 py-2 text-sm"
              />
              <span className="text-xs text-secondary">{headline.length}/60 — four words or fewer reads best at phone size.</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-semibold text-charcoal">Eyebrow</span>
                <input
                  type="text"
                  value={eyebrow}
                  onChange={(e) => setEyebrow(e.target.value)}
                  maxLength={16}
                  placeholder="JLPT N5"
                  className="mt-1 w-full border border-[var(--divider)] rounded-button px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-charcoal">Text side</span>
                <select
                  value={textSide}
                  onChange={(e) => setTextSide(e.target.value as "left" | "right" | "bottom")}
                  className="mt-1 w-full border border-[var(--divider)] rounded-button px-2 py-2 text-sm"
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => generate(3)}
              disabled={generating > 0}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {generating > 0 ? `Drawing… ${generating} left` : backgrounds.length > 0 ? "Generate 3 more" : "Generate 3 backgrounds"}
            </button>
            <span className="text-xs text-secondary">~9s each. The model is told never to draw text.</span>
          </div>

          {backgrounds.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {backgrounds.map((bg, i) => (
                <button
                  key={bg.url}
                  type="button"
                  onClick={() => setChosen(i)}
                  className={`w-20 h-20 rounded-card overflow-hidden border-2 transition ${
                    chosen === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bg.url} alt={`Background ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SOCIAL_IMAGE_SIZES.map((size) => (
              <div key={size.key} className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedSizes.includes(size.key)}
                    onChange={() =>
                      setSelectedSizes((prev) =>
                        prev.includes(size.key) ? prev.filter((k) => k !== size.key) : [...prev, size.key]
                      )
                    }
                  />
                  <span className="font-semibold text-charcoal">{size.label}</span>
                  <span className="text-secondary">
                    {size.width}×{size.height}
                  </span>
                </label>
                <canvas
                  ref={(el) => {
                    if (el) canvases.current.set(size.key, el);
                  }}
                  className="w-full rounded-card border border-[var(--divider)] bg-base"
                  style={{ aspectRatio: `${size.width} / ${size.height}` }}
                />
                <p className="text-[11px] text-secondary leading-snug">{size.note}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={save}
              disabled={saving || selectedSizes.length === 0}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : `Save ${selectedSizes.length} image${selectedSizes.length === 1 ? "" : "s"}`}
            </button>
            {hasPost && (
              <span className="text-xs text-secondary">
                The link-preview size also becomes this post&rsquo;s og:image, if it has none.
              </span>
            )}
          </div>

          {notice && <p className="text-xs text-emerald-700">{notice}</p>}
          {error && <p className="text-xs text-primary">{error}</p>}
        </div>
      )}
    </AdminCard>
  );
}
