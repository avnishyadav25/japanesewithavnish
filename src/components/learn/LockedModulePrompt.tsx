"use client";

import Link from "next/link";

interface LockedModulePromptProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export function LockedModulePrompt({
  isOpen,
  onClose,
  title = "Premium Curriculum Path",
  message = "This study module and its lessons are part of the structured premium path. Sign up for a free account or log in to unlock progress tracking, interactive quizzes, and writing practice canvases!",
}: LockedModulePromptProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-[var(--divider)] shadow-xl p-6 text-center animate-scaleUp">
        
        {/* Lock Icon Emblem */}
        <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        {/* Text Details */}
        <h3 className="font-heading text-lg font-bold text-charcoal mb-2">
          {title}
        </h3>
        <p className="text-secondary text-sm leading-relaxed mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="space-y-3">
          <Link
            href="/register"
            className="block w-full py-3 bg-primary hover:bg-primary/95 text-white font-bold text-sm rounded-xl transition duration-150 shadow-sm"
          >
            Create Free Account
          </Link>
          <Link
            href="/login"
            className="block w-full py-3 bg-white border border-[var(--divider)] hover:bg-[#FAF8F5] text-charcoal font-bold text-sm rounded-xl transition duration-150"
          >
            Log In
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="block w-full text-center text-xs font-semibold text-secondary hover:text-charcoal transition py-2"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
