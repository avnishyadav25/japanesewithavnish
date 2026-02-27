"use client";

import { useState } from "react";
import { GenerateContentModal, type BlogGeneratedFields } from "./GenerateContentModal";
import type { ContentType } from "@/lib/ai/prompts";
import type { PromptContext } from "@/lib/ai/prompts";

interface GenerateContentButtonProps {
  contentType: ContentType;
  context?: Partial<PromptContext>;
  onGenerated: (content: string | BlogGeneratedFields) => void;
  className?: string;
}

export function GenerateContentButton({
  contentType,
  context = {},
  onGenerated,
  className = "",
}: GenerateContentButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const initialContext: PromptContext = {
    topic: context.topic,
    jlptLevel: context.jlptLevel,
    tags: context.tags,
    description: context.description,
    word: context.word,
    pattern: context.pattern,
    character: context.character,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`text-sm text-primary hover:underline ${className}`.trim()}
      >
        Generate with AI
      </button>
      <GenerateContentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contentType={contentType}
        initialContext={initialContext}
        onGenerated={onGenerated}
      />
    </>
  );
}
