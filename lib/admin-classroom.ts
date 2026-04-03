import type { PlanCode } from "@/lib/plans";

export type EnrollmentProfileOption = {
  id: string;
  email: string;
  full_name?: string;
  plan: PlanCode;
};

export type ClassroomCourse = {
  id: string;
  slug: string;
  title: string;
  level: string;
  description: string;
  status: "draft" | "open" | "coming";
  sort_order: number;
  is_visible: boolean;
  thumbnail_url?: string | null;
};

export type ClassroomLesson = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  sort_order: number;
  is_preview: boolean;
  is_visible: boolean;
  video_source: "youtube" | "vimeo" | "server" | null;
  video_url?: string | null;
  video_embed_url?: string | null;
  video_seconds?: number | null;
  attachment_url?: string | null;
  audio_url?: string | null;
  poster_url?: string | null;
};

export type LessonDraft = {
  title: string;
  description: string;
  sort_order: number;
  is_preview: boolean;
  is_visible: boolean;
  video_source: "youtube" | "vimeo" | "server" | null;
  video_url: string;
  video_embed_url: string;
  video_seconds: number;
  attachment_url: string;
  audio_url: string;
  poster_url: string;
};

export type CourseDraft = {
  title: string;
  slug: string;
  level: string;
  description: string;
  status: "draft" | "open" | "coming";
  thumbnail_url: string;
};

export type CourseEnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number;
  last_lesson_title?: string | null;
  last_studied_at?: string | null;
  is_completed: boolean;
};

export type CourseCsvRow = {
  title?: string;
  slug?: string;
  level?: string;
  description?: string;
  status?: string;
  sort_order?: string | number;
  thumbnail_url?: string;
  is_visible?: string | boolean;
};

export type LessonCsvRow = {
  title?: string;
  description?: string;
  sort_order?: string | number;
  is_preview?: string | boolean;
  is_visible?: string | boolean;
  video_source?: string;
  video_url?: string;
  video_embed_url?: string;
  video_seconds?: string | number;
  attachment_url?: string;
  audio_url?: string;
  poster_url?: string;
};

export type CourseCsvPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: Array<{
    title: string;
    slug: string;
    level: string;
    status: "draft" | "open" | "coming";
    sort_order: number;
  }>;
  invalidDetails: string[];
};

export type LessonCsvPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: Array<{
    title: string;
    sort_order: number;
    video_source: "youtube" | "vimeo" | "server";
    is_preview: boolean;
  }>;
  invalidDetails: string[];
};

export type LessonDraftKey =
  | "title"
  | "description"
  | "sort_order"
  | "is_preview"
  | "video_source"
  | "video_url"
  | "video_embed_url"
  | "video_seconds"
  | "attachment_url"
  | "audio_url"
  | "poster_url";
