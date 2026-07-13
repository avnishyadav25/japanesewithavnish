export type AccessType = "free" | "premium";
export type AccessPolicy = "always_free" | "daily_free_eligible" | "premium_only" | "trial_only" | "admin_granted";
export type ContentType =
  | "grammar" | "vocabulary" | "kanji" | "reading" | "listening" | "mock_test"
  | "orientation" | "pronunciation" | "speaking" | "culture" | "strategy" | "kana" | "writing" | "conversation" | "review" | "mixed";
export type PracticeType =
  | "writing_canvas" | "mcq" | "fill_blank" | "roleplay" | "listening" | "shadowing"
  | "module_checkpoint" | "level_assessment";

export type PracticeEntry = {
  title: string;
  description: string;
  practice_type: PracticeType;
  estimated_minutes?: number;
};

export type LessonEntry = {
  code: string;
  title: string;
  description: string;
  content_type: ContentType;
  access_type: AccessType;
  /** Real gating policy (src/lib/auth/access.ts). Optional: omit to use the column's DB default
   * and never overwrite a value an admin has hand-tuned via the admin UI (see seed-full-curriculum.ts). */
  access_policy?: AccessPolicy;
  estimated_minutes?: number;
  practices: PracticeEntry[];
};

export type SubmoduleEntry = {
  code: string;
  title: string;
  lessons: LessonEntry[];
};

export type ModuleEntry = {
  code: string;
  title: string;
  submodules: SubmoduleEntry[];
};
