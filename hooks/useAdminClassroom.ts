"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import type {
  ClassroomCourse,
  ClassroomLesson,
  CourseDraft,
  CourseEnrollmentRow,
  CourseCsvPreview,
  CourseCsvRow,
  EnrollmentProfileOption,
  LessonCsvPreview,
  LessonCsvRow,
  LessonDraft,
  LessonDraftKey,
} from "@/lib/admin-classroom";
import { supabase } from "@/lib/supabase";

function readCsvFile<T = Record<string, unknown>>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors?.length) {
          reject(new Error(results.errors[0].message));
          return;
        }
        resolve(results.data || []);
      },
      error: (error) => reject(error),
    });
  });
}

function parseBooleanLike(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;

  const raw = String(value ?? "").trim().toLowerCase();

  if (["true", "1", "y", "yes", "예", "on"].includes(raw)) return true;
  if (["false", "0", "n", "no", "아니오", "off"].includes(raw)) return false;

  return fallback;
}

function parseNumberLike(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeVideoSource(value: unknown): "youtube" | "vimeo" | "server" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "vimeo") return "vimeo";
  if (raw === "server") return "server";
  return "youtube";
}

function slugifyKoreanSafe(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();

  return raw
    .replace(/[^a-z0-9가-힣\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeUniqueSlug(base: string, used: Set<string>) {
  const seed = slugifyKoreanSafe(base) || `course-${Date.now()}`;
  let next = seed;
  let i = 2;

  while (used.has(next)) {
    next = `${seed}-${i}`;
    i += 1;
  }

  used.add(next);
  return next;
}

function normalizeSequentialSortOrder<T extends { sort_order?: number | null }>(
  rows: T[]
) {
  return rows.map((row, index) => ({
    ...row,
    sort_order: index + 1,
  }));
}

function downloadCsvFile(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function useAdminClassroom({
  tab,
  profiles,
}: {
  tab: string;
  profiles: EnrollmentProfileOption[];
}) {
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [lessons, setLessons] = useState<ClassroomLesson[]>([]);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomMessage, setClassroomMessage] = useState("");
  const [classroomSavingCourseId, setClassroomSavingCourseId] = useState("");

  const [editingCourseId, setEditingCourseId] = useState("");
  const [savingCourseId, setSavingCourseId] = useState("");
  const [courseDrafts, setCourseDrafts] = useState<Record<string, CourseDraft>>(
    {}
  );

  const [editingLessonId, setEditingLessonId] = useState("");
  const [savingLessonId, setSavingLessonId] = useState("");
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, LessonDraft>>(
    {}
  );

  const [deleteConfirmLessonId, setDeleteConfirmLessonId] = useState("");
  const [deletingLessonId, setDeletingLessonId] = useState("");

  const [deleteConfirmCourseId, setDeleteConfirmCourseId] = useState("");
  const [deletingCourseId, setDeletingCourseId] = useState("");

  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseSlug, setNewCourseSlug] = useState("");
  const [newCourseLevel, setNewCourseLevel] = useState("입문");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseStatus, setNewCourseStatus] = useState<
    "draft" | "open" | "coming"
  >("draft");
  const [newCourseThumbnailUrl, setNewCourseThumbnailUrl] = useState("");

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");
  const [newLessonSortOrder, setNewLessonSortOrder] = useState(1);
  const [newLessonPreview, setNewLessonPreview] = useState(false);
  const [newLessonVideoSource, setNewLessonVideoSource] = useState<
    "youtube" | "vimeo" | "server"
  >("youtube");
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState("");
  const [newLessonEmbedUrl, setNewLessonEmbedUrl] = useState("");
  const [newLessonVideoSeconds, setNewLessonVideoSeconds] = useState(600);
  const [newLessonAttachmentUrl, setNewLessonAttachmentUrl] = useState("");
  const [newLessonAudioUrl, setNewLessonAudioUrl] = useState("");
  const [newLessonPosterUrl, setNewLessonPosterUrl] = useState("");

  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState("");
  const [memberCourseQuery, setMemberCourseQuery] = useState("");
  const [selectedEnrollmentUserId, setSelectedEnrollmentUserId] = useState("");
  const [userEnrollments, setUserEnrollments] = useState<CourseEnrollmentRow[]>(
    []
  );
  const [assigningCourseId, setAssigningCourseId] = useState("");
  const [removingEnrollmentId, setRemovingEnrollmentId] = useState("");

  const [courseCsvBusy, setCourseCsvBusy] = useState(false);
  const [courseCsvFile, setCourseCsvFile] = useState<File | null>(null);
  const [courseCsvPreview, setCourseCsvPreview] =
    useState<CourseCsvPreview | null>(null);

  const [lessonCsvBusy, setLessonCsvBusy] = useState(false);
  const [lessonCsvFile, setLessonCsvFile] = useState<File | null>(null);
  const [lessonCsvPreview, setLessonCsvPreview] =
    useState<LessonCsvPreview | null>(null);

  const filteredEnrollmentProfiles = useMemo(() => {
    const q = memberCourseQuery.trim().toLowerCase();
    const base = profiles.filter((item) => !!item.email);
    if (!q) return base.slice(0, 100);

    return base
      .filter((item) => {
        return (
          item.email.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          String(item.full_name || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 100);
  }, [profiles, memberCourseQuery]);

  const selectedEnrollmentMember = useMemo(
    () => profiles.find((item) => item.id === selectedEnrollmentUserId) || null,
    [profiles, selectedEnrollmentUserId]
  );

  const selectedCourse = useMemo(
    () => courses.find((item) => item.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const enrolledCourseMap = useMemo(() => {
    return new Map(userEnrollments.map((item) => [item.course_id, item]));
  }, [userEnrollments]);

  const loadCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select(
        "id, slug, title, level, description, status, sort_order, is_visible, thumbnail_url"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (data || []) as ClassroomCourse[];
    setCourses(rows);

    setCourseDrafts(
      Object.fromEntries(
        rows.map((course) => [
          course.id,
          {
            title: course.title || "",
            slug: course.slug || "",
            level: course.level || "",
            description: course.description || "",
            status: course.status,
            thumbnail_url: course.thumbnail_url || "",
          },
        ])
      )
    );

    if (rows.length === 0) {
      setSelectedCourseId("");
      setLessons([]);
      return;
    }

    setSelectedCourseId((prev) => {
      const exists = rows.some((course) => course.id === prev);
      return exists ? prev : rows[0].id;
    });
  };

  const loadLessons = async (courseId: string) => {
    if (!courseId) {
      setLessons([]);
      return;
    }

    const { data, error } = await supabase
      .from("course_lessons")
      .select(`
        id,
        course_id,
        title,
        description,
        sort_order,
        is_preview,
        is_visible,
        video_source,
        video_url,
        video_embed_url,
        video_seconds,
        attachment_url,
        audio_url,
        poster_url
      `)
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (data || []) as ClassroomLesson[];
    setLessons(rows);
    setNewLessonSortOrder(rows.length + 1);

    setLessonDrafts(
      Object.fromEntries(
        rows.map((lesson) => [
          lesson.id,
          {
            title: lesson.title || "",
            description: lesson.description || "",
            sort_order: lesson.sort_order || 1,
            is_preview: Boolean(lesson.is_preview),
            is_visible: Boolean(lesson.is_visible),
            video_source: lesson.video_source || "youtube",
            video_url: lesson.video_url || "",
            video_embed_url: lesson.video_embed_url || "",
            video_seconds: Number(lesson.video_seconds || 0),
            attachment_url: lesson.attachment_url || "",
            audio_url: lesson.audio_url || "",
            poster_url: lesson.poster_url || "",
          },
        ])
      )
    );
  };

  const loadUserEnrollments = async (userId: string) => {
    if (!userId) {
      setUserEnrollments([]);
      return;
    }

    const { data, error } = await supabase
      .from("course_enrollments")
      .select(
        "id, user_id, course_id, progress, last_lesson_title, last_studied_at, is_completed"
      )
      .eq("user_id", userId)
      .order("last_studied_at", { ascending: false });

    if (error) throw error;

    setUserEnrollments((data || []) as CourseEnrollmentRow[]);
  };

  const handleDownloadCourseCsvSample = () => {
    const header =
      "title,slug,level,description,status,sort_order,thumbnail_url,is_visible";
    const rows = [
      '일본어 입문 코스,starter-japanese,입문,처음 시작하는 학습자를 위한 코스,open,1,https://example.com/course1.jpg,true',
      '패턴 회화 코스,pattern-speaking,N3~N2,자주 쓰는 패턴 중심 회화,coming,2,https://example.com/course2.jpg,true',
    ];

    downloadCsvFile("courses_sample.csv", [header, ...rows].join("\n"));
  };

  const handleDownloadLessonCsvSample = () => {
    const header =
      "title,description,sort_order,is_preview,is_visible,video_source,video_url,video_embed_url,video_seconds,attachment_url,audio_url,poster_url";
    const rows = [
      '1강 인사 표현,기본 인사와 자기소개,1,true,true,youtube,https://youtube.com/watch?v=aaa,https://www.youtube.com/embed/aaa,600,https://example.com/lesson1.pdf,https://example.com/lesson1.mp3,https://example.com/poster1.jpg',
      '2강 기본 회화,자주 쓰는 회화 패턴,2,false,true,youtube,https://youtube.com/watch?v=bbb,https://www.youtube.com/embed/bbb,720,https://example.com/lesson2.pdf,https://example.com/lesson2.mp3,https://example.com/poster2.jpg',
    ];

    downloadCsvFile("lessons_sample.csv", [header, ...rows].join("\n"));
  };

  const handlePreviewCoursesCsv = async (file: File) => {
    try {
      setCourseCsvBusy(true);
      setClassroomMessage("");
      setCourseCsvFile(file);
      setCourseCsvPreview(null);

      const rows = await readCsvFile<CourseCsvRow>(file);

      const existingSlugSet = new Set(
        courses.map((course) => String(course.slug || "").trim().toLowerCase())
      );

      const invalidDetails: string[] = [];

      const cleaned = rows.map((row, index) => {
        const title = String(row.title ?? "").trim();
        const rawSlug = String(row.slug ?? "").trim();
        const level = String(row.level ?? "").trim() || "입문";
        const description = String(row.description ?? "").trim();

        const rawStatus = String(row.status ?? "").trim().toLowerCase();
        const status =
          rawStatus === "open" ||
          rawStatus === "coming" ||
          rawStatus === "draft"
            ? rawStatus
            : "draft";

        if (!title) {
          invalidDetails.push(`${index + 1}행: title 없음`);
          return null;
        }

        const slug = makeUniqueSlug(rawSlug || title, existingSlugSet);

        return {
          title,
          slug,
          level,
          description,
          status: status as "draft" | "open" | "coming",
          sort_order: parseNumberLike(row.sort_order, index + 1),
          thumbnail_url: String(row.thumbnail_url ?? "").trim() || null,
          is_visible: parseBooleanLike(row.is_visible, true),
        };
      });

      const valid = cleaned.filter(Boolean) as Array<{
        title: string;
        slug: string;
        level: string;
        description: string;
        status: "draft" | "open" | "coming";
        sort_order: number;
        thumbnail_url: string | null;
        is_visible: boolean;
      }>;

      const normalized = normalizeSequentialSortOrder(
        valid.sort((a, b) => a.sort_order - b.sort_order)
      );

      setCourseCsvPreview({
        totalRows: rows.length,
        validRows: normalized.length,
        invalidRows: rows.length - normalized.length,
        rows: normalized.slice(0, 10).map((row) => ({
          title: row.title,
          slug: row.slug,
          level: row.level,
          status: row.status,
          sort_order: row.sort_order,
        })),
        invalidDetails: invalidDetails.slice(0, 10),
      });

      setClassroomMessage(
        `강의 CSV 미리보기 완료 · 전체 ${rows.length}행 / 유효 ${normalized.length}행 / 제외 ${rows.length - normalized.length}행`
      );
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 CSV 분석 중 오류가 발생했습니다."
      );
    } finally {
      setCourseCsvBusy(false);
    }
  };

  const handleImportCoursesCsv = async () => {
    if (!courseCsvFile) {
      setClassroomMessage("강의 CSV 파일을 먼저 선택해 주세요.");
      return;
    }

    try {
      setCourseCsvBusy(true);
      setClassroomMessage("");

      const rows = await readCsvFile<CourseCsvRow>(courseCsvFile);

      const existingSlugSet = new Set(
        courses.map((course) => String(course.slug || "").trim().toLowerCase())
      );

      const cleaned = rows
        .map((row, index) => {
          const title = String(row.title ?? "").trim();
          if (!title) return null;

          const rawSlug = String(row.slug ?? "").trim();
          const rawStatus = String(row.status ?? "").trim().toLowerCase();

          const status =
            rawStatus === "open" ||
            rawStatus === "coming" ||
            rawStatus === "draft"
              ? rawStatus
              : "draft";

          return {
            title,
            slug: makeUniqueSlug(rawSlug || title, existingSlugSet),
            level: String(row.level ?? "").trim() || "입문",
            description: String(row.description ?? "").trim(),
            status: status as "draft" | "open" | "coming",
            sort_order: parseNumberLike(row.sort_order, index + 1),
            thumbnail_url: String(row.thumbnail_url ?? "").trim() || null,
            is_visible: parseBooleanLike(row.is_visible, true),
          };
        })
        .filter(Boolean) as Array<{
        title: string;
        slug: string;
        level: string;
        description: string;
        status: "draft" | "open" | "coming";
        sort_order: number;
        thumbnail_url: string | null;
        is_visible: boolean;
      }>;

      const normalized = normalizeSequentialSortOrder(
        cleaned.sort((a, b) => a.sort_order - b.sort_order)
      );

      if (normalized.length === 0) {
        setClassroomMessage("업로드 가능한 강의 데이터가 없습니다.");
        return;
      }

      const { error } = await supabase.from("courses").insert(normalized);
      if (error) throw error;

      await loadCourses();
      setCourseCsvFile(null);
      setCourseCsvPreview(null);
      setClassroomMessage(`강의 CSV 업로드 완료 · ${normalized.length}건 추가`);
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 CSV 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setCourseCsvBusy(false);
    }
  };

  const handlePreviewLessonsCsv = async (file: File) => {
    if (!selectedCourseId) {
      setClassroomMessage("먼저 강의를 선택해 주세요.");
      return;
    }

    try {
      setLessonCsvBusy(true);
      setClassroomMessage("");
      setLessonCsvFile(file);
      setLessonCsvPreview(null);

      const rows = await readCsvFile<LessonCsvRow>(file);
      const invalidDetails: string[] = [];

      const cleaned = rows.map((row, index) => {
        const title = String(row.title ?? "").trim();

        if (!title) {
          invalidDetails.push(`${index + 1}행: title 없음`);
          return null;
        }

        return {
          title,
          description: String(row.description ?? "").trim(),
          sort_order: parseNumberLike(row.sort_order, index + 1),
          is_preview: parseBooleanLike(row.is_preview, false),
          is_visible: parseBooleanLike(row.is_visible, true),
          video_source: normalizeVideoSource(row.video_source),
          video_url: String(row.video_url ?? "").trim() || null,
          video_embed_url: String(row.video_embed_url ?? "").trim() || null,
          video_seconds: parseNumberLike(row.video_seconds, 0) || null,
          attachment_url: String(row.attachment_url ?? "").trim() || null,
          audio_url: String(row.audio_url ?? "").trim() || null,
          poster_url: String(row.poster_url ?? "").trim() || null,
        };
      });

      const valid = cleaned.filter(Boolean) as Array<{
        title: string;
        description: string;
        sort_order: number;
        is_preview: boolean;
        is_visible: boolean;
        video_source: "youtube" | "vimeo" | "server";
        video_url: string | null;
        video_embed_url: string | null;
        video_seconds: number | null;
        attachment_url: string | null;
        audio_url: string | null;
        poster_url: string | null;
      }>;

      const normalized = normalizeSequentialSortOrder(
        valid.sort((a, b) => a.sort_order - b.sort_order)
      );

      setLessonCsvPreview({
        totalRows: rows.length,
        validRows: normalized.length,
        invalidRows: rows.length - normalized.length,
        rows: normalized.slice(0, 10).map((row) => ({
          title: row.title,
          sort_order: row.sort_order,
          video_source: row.video_source,
          is_preview: row.is_preview,
        })),
        invalidDetails: invalidDetails.slice(0, 10),
      });

      setClassroomMessage(
        `레슨 CSV 미리보기 완료 · 전체 ${rows.length}행 / 유효 ${normalized.length}행 / 제외 ${rows.length - normalized.length}행`
      );
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 CSV 분석 중 오류가 발생했습니다."
      );
    } finally {
      setLessonCsvBusy(false);
    }
  };

  const handleImportLessonsCsv = async () => {
    if (!lessonCsvFile) {
      setClassroomMessage("레슨 CSV 파일을 먼저 선택해 주세요.");
      return;
    }

    if (!selectedCourseId) {
      setClassroomMessage("먼저 강의를 선택해 주세요.");
      return;
    }

    try {
      setLessonCsvBusy(true);
      setClassroomMessage("");

      const rows = await readCsvFile<LessonCsvRow>(lessonCsvFile);

      const cleaned = rows
        .map((row, index) => {
          const title = String(row.title ?? "").trim();
          if (!title) return null;

          return {
            course_id: selectedCourseId,
            title,
            description: String(row.description ?? "").trim(),
            sort_order: parseNumberLike(row.sort_order, index + 1),
            is_preview: parseBooleanLike(row.is_preview, false),
            is_visible: parseBooleanLike(row.is_visible, true),
            video_source: normalizeVideoSource(row.video_source),
            video_url: String(row.video_url ?? "").trim() || null,
            video_embed_url: String(row.video_embed_url ?? "").trim() || null,
            video_seconds: parseNumberLike(row.video_seconds, 0) || null,
            attachment_url: String(row.attachment_url ?? "").trim() || null,
            audio_url: String(row.audio_url ?? "").trim() || null,
            poster_url: String(row.poster_url ?? "").trim() || null,
          };
        })
        .filter(Boolean) as Array<{
        course_id: string;
        title: string;
        description: string;
        sort_order: number;
        is_preview: boolean;
        is_visible: boolean;
        video_source: "youtube" | "vimeo" | "server";
        video_url: string | null;
        video_embed_url: string | null;
        video_seconds: number | null;
        attachment_url: string | null;
        audio_url: string | null;
        poster_url: string | null;
      }>;

      const normalized = normalizeSequentialSortOrder(
        cleaned.sort((a, b) => a.sort_order - b.sort_order)
      );

      if (normalized.length === 0) {
        setClassroomMessage("업로드 가능한 레슨 데이터가 없습니다.");
        return;
      }

      const { error } = await supabase.from("course_lessons").insert(normalized);
      if (error) throw error;

      await loadLessons(selectedCourseId);
      setLessonCsvFile(null);
      setLessonCsvPreview(null);
      setClassroomMessage(`레슨 CSV 업로드 완료 · ${normalized.length}건 추가`);
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 CSV 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setLessonCsvBusy(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim() || !newCourseSlug.trim()) {
      setClassroomMessage("강의 제목과 slug를 입력해 주세요.");
      return;
    }

    try {
      setClassroomLoading(true);
      setClassroomMessage("");

      const { error } = await supabase.from("courses").insert({
        title: newCourseTitle.trim(),
        slug: newCourseSlug.trim(),
        level: newCourseLevel.trim() || "입문",
        description: newCourseDescription.trim(),
        status: newCourseStatus,
        sort_order: courses.length + 1,
        is_visible: true,
        thumbnail_url: newCourseThumbnailUrl.trim() || null,
      });

      if (error) throw error;

      setNewCourseTitle("");
      setNewCourseSlug("");
      setNewCourseLevel("입문");
      setNewCourseDescription("");
      setNewCourseStatus("draft");
      setNewCourseThumbnailUrl("");

      await loadCourses();
      setClassroomMessage("강의를 추가했습니다.");
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error ? error.message : "강의 추가 중 오류가 발생했습니다."
      );
    } finally {
      setClassroomLoading(false);
    }
  };

  const handleCreateLesson = async () => {
    if (!selectedCourseId) {
      setClassroomMessage("먼저 강의를 선택해 주세요.");
      return;
    }

    if (!newLessonTitle.trim()) {
      setClassroomMessage("레슨 제목을 입력해 주세요.");
      return;
    }

    try {
      setClassroomLoading(true);
      setClassroomMessage("");

      const { error } = await supabase.from("course_lessons").insert({
        course_id: selectedCourseId,
        title: newLessonTitle.trim(),
        description: newLessonDescription.trim(),
        sort_order: newLessonSortOrder,
        is_preview: newLessonPreview,
        is_visible: true,
        video_source: newLessonVideoSource,
        video_url: newLessonVideoUrl.trim() || null,
        video_embed_url: newLessonEmbedUrl.trim() || null,
        video_seconds: newLessonVideoSeconds || null,
        attachment_url: newLessonAttachmentUrl.trim() || null,
        audio_url: newLessonAudioUrl.trim() || null,
        poster_url: newLessonPosterUrl.trim() || null,
      });

      if (error) throw error;

      setNewLessonTitle("");
      setNewLessonDescription("");
      setNewLessonSortOrder(lessons.length + 1);
      setNewLessonPreview(false);
      setNewLessonVideoSource("youtube");
      setNewLessonVideoUrl("");
      setNewLessonEmbedUrl("");
      setNewLessonVideoSeconds(600);
      setNewLessonAttachmentUrl("");
      setNewLessonAudioUrl("");
      setNewLessonPosterUrl("");

      await loadLessons(selectedCourseId);
      setClassroomMessage("레슨을 추가했습니다.");
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error ? error.message : "레슨 추가 중 오류가 발생했습니다."
      );
    } finally {
      setClassroomLoading(false);
    }
  };

  const handleAssignCourseToUser = async (courseId: string) => {
    if (!selectedEnrollmentUserId) {
      setEnrollmentMessage("먼저 회원을 선택해 주세요.");
      return;
    }

    try {
      setAssigningCourseId(courseId);
      setEnrollmentMessage("");

      const alreadyAssigned = userEnrollments.some(
        (item) => item.course_id === courseId
      );
      if (alreadyAssigned) {
        setEnrollmentMessage("이미 배정된 강의입니다.");
        return;
      }

      const { error } = await supabase.from("course_enrollments").insert({
        user_id: selectedEnrollmentUserId,
        course_id: courseId,
        progress: 0,
        is_completed: false,
        last_lesson_title: null,
        last_studied_at: null,
      });

      if (error) throw error;

      await loadUserEnrollments(selectedEnrollmentUserId);
      setEnrollmentMessage("강의를 회원에게 배정했습니다.");
    } catch (error) {
      console.error(error);
      setEnrollmentMessage(
        error instanceof Error ? error.message : "강의 배정 중 오류가 발생했습니다."
      );
    } finally {
      setAssigningCourseId("");
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    try {
      setRemovingEnrollmentId(enrollmentId);
      setEnrollmentMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const res = await fetch("/api/admin/course-enrollment/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ enrollmentId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "강의 배정 해제 중 오류가 발생했습니다.");
      }

      if (selectedEnrollmentUserId) {
        await loadUserEnrollments(selectedEnrollmentUserId);
      }

      setEnrollmentMessage("강의 배정을 해제했습니다.");
    } catch (error) {
      console.error(error);
      setEnrollmentMessage(
        error instanceof Error
          ? error.message
          : "강의 배정 해제 중 오류가 발생했습니다."
      );
    } finally {
      setRemovingEnrollmentId("");
    }
  };

  const handleUpdateCourseStatus = async (
    courseId: string,
    nextStatus: "draft" | "open" | "coming"
  ) => {
    try {
      setClassroomSavingCourseId(courseId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", courseId);

      if (error) throw error;

      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId ? { ...course, status: nextStatus } : course
        )
      );

      setCourseDrafts((prev) => ({
        ...prev,
        [courseId]: {
          ...prev[courseId],
          status: nextStatus,
        },
      }));

      setClassroomMessage(`강의 상태를 ${nextStatus}로 변경했습니다.`);
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 상태 변경 중 오류가 발생했습니다."
      );
    } finally {
      setClassroomSavingCourseId("");
    }
  };

  const handleCourseDraftChange = (
    courseId: string,
    key: keyof CourseDraft,
    value: string
  ) => {
    setCourseDrafts((prev) => ({
      ...prev,
      [courseId]: {
        ...prev[courseId],
        [key]: value,
      },
    }));
  };

  const handleSaveCourse = async (courseId: string) => {
    const draft = courseDrafts[courseId];
    if (!draft) return;

    if (!draft.title.trim() || !draft.slug.trim()) {
      setClassroomMessage("강의 제목과 slug는 비워둘 수 없습니다.");
      return;
    }

    try {
      setSavingCourseId(courseId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          title: draft.title.trim(),
          slug: draft.slug.trim(),
          level: draft.level.trim() || "입문",
          description: draft.description.trim(),
          status: draft.status,
          thumbnail_url: draft.thumbnail_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", courseId);

      if (error) throw error;

      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId
            ? {
                ...course,
                title: draft.title.trim(),
                slug: draft.slug.trim(),
                level: draft.level.trim() || "입문",
                description: draft.description.trim(),
                status: draft.status,
                thumbnail_url: draft.thumbnail_url.trim() || null,
              }
            : course
        )
      );

      setEditingCourseId("");
      setClassroomMessage("강의 정보를 저장했습니다.");

      await loadCourses();
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSavingCourseId("");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      setDeletingCourseId(courseId);
      setClassroomMessage("");

      const { error: lessonDeleteError } = await supabase
        .from("course_lessons")
        .delete()
        .eq("course_id", courseId);

      if (lessonDeleteError) throw lessonDeleteError;

      const { error: enrollmentDeleteError } = await supabase
        .from("course_enrollments")
        .delete()
        .eq("course_id", courseId);

      if (enrollmentDeleteError) throw enrollmentDeleteError;

      const { error: courseDeleteError } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);

      if (courseDeleteError) throw courseDeleteError;

      setCourses((prev) => prev.filter((course) => course.id !== courseId));

      setCourseDrafts((prev) => {
        const next = { ...prev };
        delete next[courseId];
        return next;
      });

      if (selectedCourseId === courseId) {
        const remainCourses = courses.filter((course) => course.id !== courseId);
        setSelectedCourseId(remainCourses[0]?.id || "");
        setLessons([]);
      }

      if (editingCourseId === courseId) {
        setEditingCourseId("");
      }

      if (deleteConfirmCourseId === courseId) {
        setDeleteConfirmCourseId("");
      }

      setClassroomMessage("강의를 삭제했습니다.");

      await loadCourses();
      if (selectedEnrollmentUserId) {
        await loadUserEnrollments(selectedEnrollmentUserId);
      }
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setDeletingCourseId("");
    }
  };

  const handleLessonDraftChange = (
    lessonId: string,
    key: LessonDraftKey,
    value: string | number | boolean | null
  ) => {
    setLessonDrafts((prev) => ({
      ...prev,
      [lessonId]: {
        ...prev[lessonId],
        [key]: value,
      },
    }));
  };

  const handleSaveLesson = async (lessonId: string) => {
    const draft = lessonDrafts[lessonId];
    if (!draft) return;

    if (!draft.title.trim()) {
      setClassroomMessage("레슨 제목은 비워둘 수 없습니다.");
      return;
    }

    try {
      setSavingLessonId(lessonId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("course_lessons")
        .update({
          title: draft.title.trim(),
          description: draft.description.trim(),
          sort_order: Number(draft.sort_order || 1),
          is_preview: Boolean(draft.is_preview),
          video_source: draft.video_source,
          video_url: draft.video_url.trim() || null,
          video_embed_url: draft.video_embed_url.trim() || null,
          video_seconds: Number(draft.video_seconds || 0) || null,
          attachment_url: draft.attachment_url.trim() || null,
          audio_url: draft.audio_url.trim() || null,
          poster_url: draft.poster_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lessonId);

      if (error) throw error;

      setLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === lessonId
            ? {
                ...lesson,
                title: draft.title.trim(),
                description: draft.description.trim(),
                sort_order: Number(draft.sort_order || 1),
                is_preview: Boolean(draft.is_preview),
                video_source: draft.video_source,
                video_url: draft.video_url.trim() || null,
                video_embed_url: draft.video_embed_url.trim() || null,
                video_seconds: Number(draft.video_seconds || 0) || null,
                attachment_url: draft.attachment_url.trim() || null,
                audio_url: draft.audio_url.trim() || null,
                poster_url: draft.poster_url.trim() || null,
              }
            : lesson
        )
      );

      setEditingLessonId("");
      setClassroomMessage("레슨 정보를 저장했습니다.");

      if (selectedCourseId) {
        await loadLessons(selectedCourseId);
      }
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSavingLessonId("");
    }
  };

  const handleToggleLessonVisibility = async (
    lessonId: string,
    nextVisible: boolean
  ) => {
    try {
      setSavingLessonId(lessonId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("course_lessons")
        .update({
          is_visible: nextVisible,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lessonId);

      if (error) throw error;

      setLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === lessonId
            ? {
                ...lesson,
                is_visible: nextVisible,
              }
            : lesson
        )
      );

      setLessonDrafts((prev) => ({
        ...prev,
        [lessonId]: {
          ...prev[lessonId],
          is_visible: nextVisible,
        },
      }));

      setClassroomMessage(
        nextVisible
          ? "레슨을 표시 상태로 변경했습니다."
          : "레슨을 숨김 상태로 변경했습니다."
      );

      if (selectedCourseId) {
        await loadLessons(selectedCourseId);
      }
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 표시 상태 변경 중 오류가 발생했습니다."
      );
    } finally {
      setSavingLessonId("");
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      setDeletingLessonId(lessonId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("course_lessons")
        .delete()
        .eq("id", lessonId);

      if (error) throw error;

      setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));

      setLessonDrafts((prev) => {
        const next = { ...prev };
        delete next[lessonId];
        return next;
      });

      if (editingLessonId === lessonId) {
        setEditingLessonId("");
      }

      if (deleteConfirmLessonId === lessonId) {
        setDeleteConfirmLessonId("");
      }

      setClassroomMessage("레슨을 삭제했습니다.");

      if (selectedCourseId) {
        await loadLessons(selectedCourseId);
      }
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setDeletingLessonId("");
    }
  };

  useEffect(() => {
    if (profiles.length === 0) {
      setSelectedEnrollmentUserId("");
      return;
    }

    setSelectedEnrollmentUserId((prev) => {
      if (prev && profiles.some((item) => item.id === prev)) {
        return prev;
      }
      return profiles[0].id;
    });
  }, [profiles]);

  useEffect(() => {
    if (tab !== "classroom") return;

    const run = async () => {
      try {
        setClassroomLoading(true);
        setClassroomMessage("");
        await loadCourses();
      } catch (error) {
        console.error(error);
        setClassroomMessage("강의 목록을 불러오지 못했습니다.");
      } finally {
        setClassroomLoading(false);
      }
    };

    void run();
  }, [tab]);

  useEffect(() => {
    if (tab !== "classroom") return;
    if (!selectedCourseId) return;

    const run = async () => {
      try {
        setClassroomLoading(true);
        await loadLessons(selectedCourseId);
      } catch (error) {
        console.error(error);
        setClassroomMessage("레슨 목록을 불러오지 못했습니다.");
      } finally {
        setClassroomLoading(false);
      }
    };

    void run();
  }, [tab, selectedCourseId]);

  useEffect(() => {
    if (tab !== "classroom") return;
    if (!selectedEnrollmentUserId) {
      setUserEnrollments([]);
      return;
    }

    const run = async () => {
      try {
        setEnrollmentsLoading(true);
        setEnrollmentMessage("");
        await loadUserEnrollments(selectedEnrollmentUserId);
      } catch (error) {
        console.error(error);
        setEnrollmentMessage("회원의 수강 강의 목록을 불러오지 못했습니다.");
      } finally {
        setEnrollmentsLoading(false);
      }
    };

    void run();
  }, [tab, selectedEnrollmentUserId]);

  return {
    classroomMessage,
    memberCourseQuery,
    selectedEnrollmentUserId,
    filteredEnrollmentProfiles,
    selectedEnrollmentMember,
    enrollmentMessage,
    enrollmentsLoading,
    userEnrollments,
    courses,
    enrolledCourseMap,
    assigningCourseId,
    removingEnrollmentId,
    classroomLoading,
    newCourseTitle,
    newCourseSlug,
    newCourseLevel,
    newCourseDescription,
    newCourseThumbnailUrl,
    newCourseStatus,
    courseCsvFile,
    courseCsvPreview,
    courseCsvBusy,
    selectedCourseId,
    selectedCourse,
    editingCourseId,
    savingCourseId,
    deleteConfirmCourseId,
    deletingCourseId,
    classroomSavingCourseId,
    courseDrafts,
    newLessonTitle,
    newLessonSortOrder,
    newLessonDescription,
    newLessonVideoSource,
    newLessonVideoUrl,
    newLessonEmbedUrl,
    newLessonVideoSeconds,
    newLessonAttachmentUrl,
    newLessonAudioUrl,
    newLessonPosterUrl,
    newLessonPreview,
    lessonCsvFile,
    lessonCsvPreview,
    lessonCsvBusy,
    lessons,
    lessonDrafts,
    editingLessonId,
    savingLessonId,
    deleteConfirmLessonId,
    deletingLessonId,
    onMemberCourseQueryChange: (value: string) => {
      setMemberCourseQuery(value);
      setEnrollmentMessage("");
    },
    onSelectedEnrollmentUserIdChange: (value: string) => {
      setSelectedEnrollmentUserId(value);
      setEnrollmentMessage("");
    },
    onRemoveEnrollment: handleRemoveEnrollment,
    onAssignCourseToUser: handleAssignCourseToUser,
    onNewCourseTitleChange: setNewCourseTitle,
    onNewCourseSlugChange: setNewCourseSlug,
    onNewCourseLevelChange: setNewCourseLevel,
    onNewCourseDescriptionChange: setNewCourseDescription,
    onNewCourseThumbnailUrlChange: setNewCourseThumbnailUrl,
    onNewCourseStatusChange: setNewCourseStatus,
    onCreateCourse: handleCreateCourse,
    onDownloadCourseCsvSample: handleDownloadCourseCsvSample,
    onPreviewCoursesCsv: handlePreviewCoursesCsv,
    onImportCoursesCsv: handleImportCoursesCsv,
    onResetCourseCsv: () => {
      setCourseCsvFile(null);
      setCourseCsvPreview(null);
    },
    onSelectCourse: setSelectedCourseId,
    onCourseDraftChange: handleCourseDraftChange,
    onEditCourse: (courseId: string) => {
      setEditingCourseId(courseId);
      setDeleteConfirmCourseId("");
    },
    onCancelEditCourse: () => setEditingCourseId(""),
    onSaveCourse: handleSaveCourse,
    onConfirmDeleteCourse: setDeleteConfirmCourseId,
    onDeleteCourse: handleDeleteCourse,
    onUpdateCourseStatus: handleUpdateCourseStatus,
    onNewLessonTitleChange: setNewLessonTitle,
    onNewLessonSortOrderChange: setNewLessonSortOrder,
    onNewLessonDescriptionChange: setNewLessonDescription,
    onNewLessonVideoSourceChange: setNewLessonVideoSource,
    onNewLessonVideoUrlChange: setNewLessonVideoUrl,
    onNewLessonEmbedUrlChange: setNewLessonEmbedUrl,
    onNewLessonVideoSecondsChange: setNewLessonVideoSeconds,
    onNewLessonAttachmentUrlChange: setNewLessonAttachmentUrl,
    onNewLessonAudioUrlChange: setNewLessonAudioUrl,
    onNewLessonPosterUrlChange: setNewLessonPosterUrl,
    onNewLessonPreviewChange: setNewLessonPreview,
    onCreateLesson: handleCreateLesson,
    onDownloadLessonCsvSample: handleDownloadLessonCsvSample,
    onPreviewLessonsCsv: handlePreviewLessonsCsv,
    onImportLessonsCsv: handleImportLessonsCsv,
    onResetLessonCsv: () => {
      setLessonCsvFile(null);
      setLessonCsvPreview(null);
    },
    onLessonDraftChange: handleLessonDraftChange,
    onEditLesson: (lessonId: string) => {
      setEditingLessonId(lessonId);
      setDeleteConfirmLessonId("");
    },
    onCancelEditLesson: () => setEditingLessonId(""),
    onSaveLesson: handleSaveLesson,
    onConfirmDeleteLesson: setDeleteConfirmLessonId,
    onDeleteLesson: handleDeleteLesson,
    onToggleLessonVisibility: handleToggleLessonVisibility,
  };
}
