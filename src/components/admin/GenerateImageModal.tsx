"use client";

import { useState, useEffect } from "react";
import {
  getImagePrompt,
  type ImageType,
  type ImageContext,
} from "@/lib/ai/image-prompts";

type GenerateImageModalProps = {
  open: boolean;
  onClose: () => void;
  imageType: ImageType;
  initialContext: ImageContext;
  initialPrompt?: string;
  onGenerated: (urlOrPrompt: string) => void;
};

export function GenerateImageModal({
  open,
  onClose,
  imageType,
  initialContext,
  initialPrompt,
  onGenerated,
}: GenerateImageModalProps) {
  const [topic, setTopic] = useState(initialContext.topic ?? initialContext.title ?? "");
  const [tags, setTags] = useState(initialContext.tags ?? "");
  const [description, setDescription] = useState(initialContext.description ?? "");
  const [customPrompt, setCustomPrompt] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTopic(initialContext.topic ?? initialContext.title ?? "");
      setTags(initialContext.tags ?? "");
      setDescription(initialContext.description ?? "");
      setCustomPrompt(initialPrompt ?? "");
      setError(null);
      setPreviewUrl(null);
    }
  }, [
    open,
    initialContext.topic,
    initialContext.title,
    initialContext.tags,
    initialContext.description,
    initialPrompt,
  ]);

  const context: ImageContext = {
    ...initialContext,
    topic: topic || undefined,
    title: topic || undefined,
    tags: tags || undefined,
    description: description || undefined,
  };
  const builtPrompt = getImagePrompt(imageType, context);
  const previewPrompt = customPrompt.trim() || builtPrompt;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPreviewUrl(null);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageType, context, prompt: previewPrompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Image generation failed");
        return;
      }

      if (data.imageUrl) {
        setPreviewUrl(data.imageUrl);
        onGenerated(data.imageUrl);
        // Don't auto-close so user can see preview; they can close manually
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("No image returned. Try a different prompt or check model support.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg bg-white rounded-bento shadow-xl border border-[var(--divider)] max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-charcoal text-lg">
            Generate image with AI
          </h2>
          <p className="text-sm text-secondary">
            Fill in or edit the fields below. The prompt will update as you type.
          </p>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Japanese particles"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. grammar, vocabulary"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description for the image"
              rows={2}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Image prompt (editable; used for generation)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={builtPrompt}
              rows={3}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
            />
            <p className="text-xs text-secondary mt-1">
              Pre-filled from AI content generation or built from topic/tags. Edit as needed.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-bento text-red-700 text-sm">
              {error}
            </div>
          )}

          {previewUrl && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Preview</label>
              <div className="relative rounded-bento overflow-hidden border border-[var(--divider)] bg-[var(--base)]">
                <img
                  src={previewUrl}
                  alt="Generated"
                  className="w-full max-h-48 object-contain object-top"
                />
              </div>
              <p className="text-xs text-emerald-600 mt-1">Image saved. URL copied to OG image field.</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Generating…" : "Generate"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              {previewUrl ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
