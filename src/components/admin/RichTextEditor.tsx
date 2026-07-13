"use client";

import { useEffect, useRef } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
};

const TOOLBAR_ACTIONS: { label: string; command: string; value?: string }[] = [
  { label: "B", command: "bold" },
  { label: "I", command: "italic" },
  { label: "U", command: "underline" },
  { label: "H2", command: "formatBlock", value: "h2" },
  { label: "H3", command: "formatBlock", value: "h3" },
  { label: "P", command: "formatBlock", value: "p" },
  { label: "• List", command: "insertUnorderedList" },
  { label: "1. List", command: "insertOrderedList" },
  { label: "Link", command: "createLink" },
];

/** Minimal contenteditable-based WYSIWYG (no external editor dependency) that produces HTML,
 * used for newsletter compose. Falls back gracefully — the underlying value is always plain HTML. */
export function RichTextEditor({ value, onChange, rows = 14 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
    isInternalUpdate.current = false;
  }, [value]);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    if (command === "createLink") {
      const url = window.prompt("Link URL:");
      if (!url) return;
      document.execCommand(command, false, url);
    } else {
      document.execCommand(command, false, value);
    }
    handleInput();
  }

  function handleInput() {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
  }

  return (
    <div className="border border-[var(--divider)] rounded-bento overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 bg-base border-b border-[var(--divider)]">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => exec(action.command, action.value)}
            className="px-2.5 py-1 text-xs font-semibold rounded border border-[var(--divider)] bg-white text-charcoal hover:bg-[var(--red-light)] hover:text-primary transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="px-4 py-3 text-charcoal text-sm focus:outline-none prose prose-sm max-w-none"
        style={{ minHeight: `${rows * 1.6}em` }}
      />
    </div>
  );
}
