export type AccessType = "free" | "premium";
export type ContentType = "grammar" | "vocabulary" | "kanji" | "reading" | "listening" | "mock_test";
export type PracticeType = "writing_canvas" | "mcq" | "fill_blank" | "roleplay" | "listening" | "shadowing";

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
