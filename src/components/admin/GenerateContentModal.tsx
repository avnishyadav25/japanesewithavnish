"use client";

import { useState, useEffect } from "react";
import { getPrompt, type ContentType, type PromptContext } from "@/lib/ai/prompts";

export type SectionImagePrompt = {
  placeholder: string;
  section: string;
  prompt: string;
};

export type BlogGeneratedFields = {
  content: string;
  title?: string;
  slug?: string;
  tags?: string;
  jlpt_level?: string;
  seo_title?: string;
  seo_description?: string;
  image_prompt?: string;
  section_image_prompts?: SectionImagePrompt[];
};

type GenerateContentModalProps = {
  open: boolean;
  onClose: () => void;
  contentType: ContentType;
  initialContext: PromptContext;
  onGenerated: (content: string | BlogGeneratedFields) => void;
};

export function GenerateContentModal({
  open,
  onClose,
  contentType,
  initialContext,
  onGenerated,
}: GenerateContentModalProps) {
  const [topic, setTopic] = useState(initialContext.topic ?? "");
  const [tags, setTags] = useState(initialContext.tags ?? "");
  const [description, setDescription] = useState(initialContext.description ?? "");
  const [customPrompt, setCustomPrompt] = useState("");
  const [contentLLM, setContentLLM] = useState<"deepseek" | "gemini">("deepseek");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTopic(initialContext.topic ?? "");
      setTags(initialContext.tags ?? "");
      setDescription(initialContext.description ?? "");
      setCustomPrompt("");
    }
  }, [open, initialContext.topic, initialContext.tags, initialContext.description]);

  const context: PromptContext = {
    ...initialContext,
    topic: topic || undefined,
    tags: tags || undefined,
    description: description || undefined,
  };
  const previewPrompt = getPrompt(contentType, context);
  const promptToSend = customPrompt.trim() || previewPrompt;

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, context, customPrompt: promptToSend, content_llm: contentLLM }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (contentType === "blog" && typeof data.content === "string" && typeof data.title === "string") {
        // Blog: structured JSON with content, title, slug, etc.
        onGenerated(data as BlogGeneratedFields);
        onClose();
      } else if (contentType === "product") {
        // Product: structured JSON without a 'content' key
        onGenerated(data);
        onClose();
      } else if (typeof data.content === "string") {
        // All other types: plain text content
        onGenerated(data.content);
        onClose();
      }
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
            Generate content with AI
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
              placeholder="Brief description or summary"
              rows={2}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Content model
            </label>
            <select
              value={contentLLM}
              onChange={(e) => setContentLLM(e.target.value as "deepseek" | "gemini")}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal bg-white"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Prompt (editable)
            </label>
            <textarea
              value={customPrompt || previewPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={8}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm font-mono"
              placeholder={previewPrompt}
            />
            <p className="text-xs text-secondary mt-1">Edit the prompt above if needed, then click Generate.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Generating…" : "Generate"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
