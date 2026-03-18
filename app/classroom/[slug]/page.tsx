"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  level: string;
  description: string;
  status: "draft" | "open" | "coming";
  thumbnail_url?: string | null;
  is_visible: boolean;
};

type EnrollmentRow = {
  course_id: string;
  progress: number;
  last_lesson_title?: string | null;
  last_studied_at?: string | null;
  is_completed: boolean;
};

type LessonRow = {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  is_preview: boolean;
  is_visible: boolean;
  attachment_url?: string | null;
  video_seconds?: number | null;
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

function getStatusLabel(status: "draft" | "open" | "coming") {
  if (status === "open") return "공개 중";
  if (status === "coming") return "공개 예정";
  return "비공개";
}

function getProgressTone(progress: number, isCompleted: boolean) {
  if (isCompleted || progress >= 100) {
    return {
      badge: "완료",
      badgeClass: "bg-green-100 text-green-700",
      buttonLabel: "복습 시작하기",
      buttonClass:
        "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
    };
  }

  if (progress > 0) {
    return {
      badge: "학습 중",
      badgeClass: "bg-black text-white",
      buttonLabel: "이어서 학습",
      buttonClass: "bg-black text-white hover:opacity-90",
    };
  }

  return {
    badge: "시작 가능",
    badgeClass: "bg-gray-200 text-gray-800",
    buttonLabel: "학습 시작하기",
    buttonClass: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-100",
  };
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

function CourseHeroThumbnail({
  src,
  title,
}: {
  src?: string | null;
  title: string;
}) {
  if (src) {
    return (
      <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
        <img
          src={src}
          alt={title}
          className="h-[220px] w-full object-cover sm:h-[280px]"
        />
      </div>
    );
  }

  return (
    <div className="flex h-[220px] w-full items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white text-gray-400 shadow-sm sm:h-[280px]">
      <div className="text-center">
        <p className="text-4xl">🎓</p>
        <p className="mt-3 text-sm font-semibold">강의 썸네일 준비 중</p>
      </div>
    </div>
  );
}

export default function ClassroomCourseDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? "";

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [lessonRows, setLessonRows] = useState<LessonRow[]>([]);
  const [notFoundState, setNotFoundState] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setNotFoundState(false);
        setActionMessage("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("id, slug, title, level, description, status, thumbnail_url, is_visible")
          .eq("slug", slug)
          .eq("is_visible", true)
          .maybeSingle();

        if (courseError) throw courseError;

        if (!courseData || courseData.status === "draft") {
          if (mounted) {
            setNotFoundState(true);
            setCourse(null);
            setEnrollment(null);
            setLessonRows([]);
          }
          return;
        }

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

        const { data: lessonsData, error: lessonError } = await supabase
          .from("course_lessons")
          .select(
            "id, title, description, sort_order, is_preview, is_visible, attachment_url, video_seconds"
          )
          .eq("course_id", courseData.id)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (lessonError) throw lessonError;

        if (!mounted) return;

        setCourse(courseData as CourseRow);
        setEnrollment(enrollmentData);
        setLessonRows((lessonsData as LessonRow[] | null) ?? []);
      } catch (error) {
        console.error(error);
        if (mounted) {
          setActionMessage("상세 강의 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (slug) {
      void load();
    }

    return () => {
      mounted = false;
    };
  }, [slug]);

  const lessons: LessonWithState[] = useMemo(() => {
    const progress = enrollment?.progress ?? 0;

    return lessonRows.map((lesson, index, arr) => {
      const targetProgress =
        arr.length > 0 ? Math.round(((index + 1) / arr.length) * 100) : 0;

      return {
        ...lesson,
        state: getLessonState(index, arr.length, progress),
        targetProgress,
      };
    });
  }, [lessonRows, enrollment]);

  const progress = enrollment?.progress ?? 0;
  const isCompleted = enrollment?.is_completed ?? false;
  const tone = getProgressTone(progress, isCompleted);

  const primaryHref = useMemo(() => {
    if (!course) return "/classroom";
    const firstOpenLesson =
      lessons.find((item) => item.state === "doing") ??
      lessons.find((item) => item.state === "done") ??
      lessons[0] ??
      null;

    return firstOpenLesson
      ? `/classroom/${course.slug}/lesson?lessonId=${firstOpenLesson.id}`
      : `/classroom/${course.slug}/lesson`;
  }, [course, lessons]);

  if (notFoundState) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
        <div className="mx-auto w-full max-w-6xl rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">강의실</p>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            해당 강의를 찾을 수 없습니다.
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            비공개 상태이거나 존재하지 않는 강의일 수 있습니다.
          </p>

          <div className="mt-5">
            <Link
              href="/classroom"
              className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              강의실로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (loading || !course) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
        <div className="mx-auto w-full max-w-6xl rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">강의실</p>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            강의 정보를 불러오는 중입니다.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            <div>
              <CourseHeroThumbnail src={course.thumbnail_url} title={course.title} />
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    {course.level}
                  </span>
                  <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                    {getStatusLabel(course.status)}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badgeClass}`}>
                    {tone.badge}
                  </span>
                </div>

                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                  {course.title}
                </h1>

                <p className="mt-4 text-sm leading-7 text-gray-600 sm:text-base">
                  {course.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                    진도율 {progress}%
                  </span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                    최근 학습 {formatDate(enrollment?.last_studied_at)}
                  </span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                    최근 기록 {enrollment?.last_lesson_title ?? "아직 학습 기록이 없습니다."}
                  </span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                    레슨 수 {lessons.length}개
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/classroom"
                  className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-center text-base font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  나의 강의실
                </Link>

                <Link
                  href={primaryHref}
                  className={`rounded-2xl px-5 py-4 text-center text-base font-semibold transition ${tone.buttonClass}`}
                >
                  {tone.buttonLabel}
                </Link>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-600">
                  <span>전체 진행도</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-3 rounded-full bg-gray-100">
                  <div
                    className="h-3 rounded-full bg-black transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {actionMessage ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {actionMessage}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">수강 상태</p>
            <p className="mt-2 text-lg font-bold text-gray-900">{tone.badge}</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              현재 수강 중인 강의와 최근 학습 내용을 한눈에 확인할 수 있습니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">최근 학습 내용</p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {enrollment?.last_lesson_title ?? "아직 기록이 없습니다."}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              학습을 시작하면 최근 학습일이 자동으로 업데이트됩니다.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">레슨 목록</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">
                현재 수강 중인 강의
              </h2>
            </div>
            <p className="text-sm text-gray-500">재생 또는 자료 버튼으로 바로 이동할 수 있습니다.</p>
          </div>

          {lessons.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              아직 연결된 레슨이 없습니다.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {lessons.map((lesson, index) => {
                const badgeLabel =
                  lesson.state === "done"
                    ? "완료"
                    : lesson.state === "doing"
                    ? "학습 가능"
                    : "잠금";

                const badgeClass =
                  lesson.state === "done"
                    ? "bg-green-100 text-green-700"
                    : lesson.state === "doing"
                    ? "bg-black text-white"
                    : "bg-white text-gray-500 ring-1 ring-gray-200";

                const playHref = `/classroom/${course.slug}/lesson?lessonId=${lesson.id}`;
                const hasAttachment = Boolean(lesson.attachment_url);

                return (
                  <article
                    key={lesson.id}
                    className={`rounded-[24px] border p-5 transition ${
                      lesson.state === "doing"
                        ? "border-black bg-white shadow-sm"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500">
                            Lesson {index + 1}
                          </span>
                          {lesson.is_preview ? (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                              미리보기
                            </span>
                          ) : null}
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-bold text-gray-900">{lesson.title}</h3>

                        <p className="mt-2 text-sm text-gray-500">
                          {formatSeconds(lesson.video_seconds)}
                        </p>

                        <p className="mt-3 text-sm leading-6 text-gray-600">
                          {lesson.description}
                        </p>
                      </div>

                      <div className="flex min-w-[220px] flex-col gap-3">
                        {lesson.state === "locked" ? (
                          <button
                            type="button"
                            disabled
                            className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-400"
                          >
                            잠금
                          </button>
                        ) : (
                          <Link
                            href={playHref}
                            className="rounded-2xl bg-black px-4 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
                          >
                            재생
                          </Link>
                        )}

                        {hasAttachment ? (
                          <a
                            href={lesson.attachment_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                          >
                            자료
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-400"
                          >
                            자료 없음
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}