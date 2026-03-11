"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  level: string;
  description: string;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  sort_order: number;
  is_preview: boolean;
  is_visible: boolean;
  video_source?: "youtube" | "vimeo" | "server" | null;
  video_url?: string | null;
  video_embed_url?: string | null;
  video_seconds?: number | null;
  attachment_url?: string | null;
  poster_url?: string | null;
};

type EnrollmentRow = {
  course_id: string;
  progress: number;
  last_lesson_title?: string | null;
  last_studied_at?: string | null;
  is_completed: boolean;
};

type LessonWithState = LessonRow & {
  state: "done" | "doing" | "locked";
  targetProgress: number;
};

function formatDate(value?: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatSeconds(totalSeconds?: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return "길이 미정";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${seconds.toString().padStart(2, "0")}초`;
}

function getLessonState(index: number, total: number, progress: number) {
  if (total <= 0) return "locked" as const;
  const unit = 100 / total;
  const thresholdDone = unit * (index + 1);
  const thresholdOpen = unit * index;

  if (progress >= thresholdDone) return "done" as const;
  if (progress > thresholdOpen || index === 0) return "doing" as const;
  return "locked" as const;
}

function getEmbedUrl(lesson: LessonRow | null) {
  if (!lesson?.video_embed_url) return "";
  return lesson.video_embed_url;
}

function getVideoBadge(source?: string | null) {
  if (source === "youtube") return "YouTube";
  if (source === "vimeo") return "Vimeo";
  if (source === "server") return "서버 영상";
  return "영상 준비 중";
}

export default function LessonVideoPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? "";

  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [lessons, setLessons] = useState<LessonWithState[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("id, slug, title, level, description, status, is_visible")
          .eq("slug", slug)
          .eq("is_visible", true)
          .maybeSingle();

        if (courseError) throw courseError;
        if (!courseData || courseData.status === "draft") {
          if (mounted) setNotFoundState(true);
          return;
        }

        const { data: lessonRows, error: lessonError } = await supabase
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
            poster_url
          `)
          .eq("course_id", courseData.id)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (lessonError) throw lessonError;

        let enrollmentData: EnrollmentRow | null = null;
        if (user) {
          const { data, error } = await supabase
            .from("course_enrollments")
            .select("course_id, progress, last_lesson_title, last_studied_at, is_completed")
            .eq("user_id", user.id)
            .eq("course_id", courseData.id)
            .maybeSingle();

          if (error) throw error;
          enrollmentData = (data as EnrollmentRow | null) ?? null;
        }

        const baseLessons = ((lessonRows as LessonRow[] | null) ?? []).map((lesson, index, arr) => {
          const targetProgress = Math.round(((index + 1) / arr.length) * 100);
          return {
            ...lesson,
            state: getLessonState(index, arr.length, enrollmentData?.progress ?? 0),
            targetProgress,
          } as LessonWithState;
        });

        if (!mounted) return;

        setCourse(courseData as CourseRow);
        setEnrollment(enrollmentData);
        setLessons(baseLessons);

        const firstOpen = baseLessons.find((lesson) => lesson.state !== "locked");
        setSelectedLessonId(firstOpen?.id ?? baseLessons[0]?.id ?? "");
        setMessage("");
      } catch (error) {
        console.error(error);
        if (mounted) {
          setMessage("레슨 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (slug) load();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0] ?? null,
    [lessons, selectedLessonId]
  );

  const handleCompleteLesson = async () => {
    if (!course || !selectedLesson || selectedLesson.state === "locked") return;

    try {
      setSaving(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("로그인 후 이용할 수 있습니다.");
        return;
      }

      const { error } = await supabase.rpc("upsert_course_progress", {
        p_course_id: course.id,
        p_progress: selectedLesson.targetProgress,
        p_last_lesson_title: selectedLesson.title,
        p_is_completed: selectedLesson.targetProgress >= 100,
      });

      if (error) throw error;

      const nextProgress = Math.max(enrollment?.progress ?? 0, selectedLesson.targetProgress);

      setEnrollment({
        course_id: course.id,
        progress: nextProgress,
        last_lesson_title: selectedLesson.title,
        last_studied_at: new Date().toISOString(),
        is_completed: nextProgress >= 100 || enrollment?.is_completed === true,
      });

      setLessons((prev) =>
        prev.map((lesson, index, arr) => ({
          ...lesson,
          state: getLessonState(index, arr.length, nextProgress),
        }))
      );

      setMessage(`"${selectedLesson.title}" 학습 완료로 기록했습니다.`);
    } catch (error) {
      console.error(error);
      setMessage("학습 완료 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (notFoundState) {
    notFound();
  }

  if (loading || !course) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
        <div className="mx-auto w-full max-w-6xl rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">레슨 영상</p>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">레슨을 불러오는 중입니다.</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
          <aside className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-500">강의 레슨</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">{course.title}</h2>
              </div>
              <Link
                href={`/classroom/${course.slug}`}
                className="rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800"
              >
                상세로
              </Link>
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">최근 학습</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {enrollment?.last_lesson_title ?? "아직 기록 없음"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(enrollment?.last_studied_at)}
              </p>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-600">
                <span>전체 진행도</span>
                <span>{enrollment?.progress ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-black transition-all"
                  style={{ width: `${enrollment?.progress ?? 0}%` }}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setSelectedLessonId(lesson.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedLesson?.id === lesson.id
                      ? "border-black bg-gray-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{lesson.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatSeconds(lesson.video_seconds)}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        lesson.state === "done"
                          ? "bg-green-100 text-green-700"
                          : lesson.state === "doing"
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {lesson.state === "done" ? "완료" : lesson.state === "doing" ? "학습 가능" : "잠금"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            {selectedLesson ? (
              <>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        {course.level}
                      </span>
                      <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                        {getVideoBadge(selectedLesson.video_source)}
                      </span>
                      {selectedLesson.is_preview ? (
                        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                          미리보기
                        </span>
                      ) : null}
                    </div>

                    <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                      {selectedLesson.title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 sm:text-base">
                      {selectedLesson.description}
                    </p>
                  </div>

                  <div className="grid min-w-[240px] gap-3 sm:grid-cols-2 lg:w-[300px] lg:grid-cols-1">
                    <button
                      type="button"
                      onClick={handleCompleteLesson}
                      disabled={selectedLesson.state === "locked" || saving}
                      className={`rounded-2xl px-5 py-4 text-center text-base font-semibold transition disabled:opacity-60 ${
                        selectedLesson.state === "locked"
                          ? "border border-gray-200 bg-white text-gray-400"
                          : "bg-black text-white hover:opacity-90"
                      }`}
                    >
                      {saving ? "저장 중..." : "이 레슨 완료 처리"}
                    </button>

                    {selectedLesson.video_url ? (
                      <a
                        href={selectedLesson.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-center text-base font-semibold text-gray-900 transition hover:bg-gray-50"
                      >
                        원본 링크 열기
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-[24px] border border-gray-200 bg-black">
                  {selectedLesson.video_source === "server" ? (
                    <video
                      controls
                      className="aspect-video w-full bg-black"
                      poster={selectedLesson.poster_url || undefined}
                      src={selectedLesson.video_embed_url || selectedLesson.video_url || undefined}
                    />
                  ) : getEmbedUrl(selectedLesson) ? (
                    <iframe
                      src={getEmbedUrl(selectedLesson)}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      title={selectedLesson.title}
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-gray-900 text-sm text-gray-300">
                      아직 연결된 영상이 없습니다.
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500">영상 소스</p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {getVideoBadge(selectedLesson.video_source)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500">영상 길이</p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {formatSeconds(selectedLesson.video_seconds)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500">완료 시 목표 진도</p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {selectedLesson.targetProgress}%
                    </p>
                  </div>
                </div>

                {selectedLesson.attachment_url ? (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-sm font-semibold text-gray-500">첨부 자료</p>
                    <a
                      href={selectedLesson.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900"
                    >
                      자료 열기
                    </a>
                  </div>
                ) : null}

                {message ? (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    {message}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
                표시할 레슨이 없습니다.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}