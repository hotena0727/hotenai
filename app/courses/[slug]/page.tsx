"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  level: string;
  description: string;
  status: "draft" | "open" | "coming";
  sort_order: number;
  thumbnail_url?: string | null;
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
  video_source: "youtube" | "vimeo" | "server" | null;
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

function formatSeconds(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}시간 ${m}분`;
  }
  if (m > 0) {
    return `${m}분 ${s > 0 ? `${s}초` : ""}`.trim();
  }
  return `${s}초`;
}

function getCourseActionState(
  course: CourseRow | null,
  enrollment: EnrollmentRow | null
) {
  if (!course) {
    return {
      badgeLabel: "정보 없음",
      badgeClass: "bg-gray-100 text-gray-600",
      buttonLabel: "목록으로",
      buttonHref: "/courses",
      buttonClass:
        "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
      disabled: false,
    };
  }

  if (course.status === "coming") {
    return {
      badgeLabel: "공개 예정",
      badgeClass: "bg-white text-gray-500 ring-1 ring-gray-200",
      buttonLabel: "곧 공개",
      buttonHref: "/courses",
      buttonClass:
        "border border-gray-200 bg-white text-gray-500 pointer-events-none",
      disabled: true,
    };
  }

  if (enrollment?.is_completed || enrollment?.progress === 100) {
    return {
      badgeLabel: "수강 완료",
      badgeClass: "bg-green-100 text-green-700",
      buttonLabel: "복습하러 가기",
      buttonHref: `/classroom/${course.slug}`,
      buttonClass:
        "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
      disabled: false,
    };
  }

  if (enrollment && enrollment.progress > 0) {
    return {
      badgeLabel: "수강 중",
      badgeClass: "bg-black text-white",
      buttonLabel: "이어서 학습",
      buttonHref: `/classroom/${course.slug}`,
      buttonClass: "bg-black text-white hover:opacity-90",
      disabled: false,
    };
  }

  return {
    badgeLabel: "수강 가능",
    badgeClass: "bg-gray-200 text-gray-800",
    buttonLabel: "강의실로 이동",
    buttonHref: `/classroom/${course.slug}`,
    buttonClass:
      "border border-gray-300 bg-white text-gray-900 hover:bg-gray-100",
    disabled: false,
  };
}

function Thumbnail({
  src,
  title,
}: {
  src?: string | null;
  title: string;
}) {
  if (src) {
    return (
      <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white">
        <img src={src} alt={title} className="h-64 w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-64 items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white text-gray-400">
      <div className="text-center">
        <p className="text-4xl">🎓</p>
        <p className="mt-3 text-sm font-semibold">썸네일 준비 중</p>
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? "";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [course, setCourse] = useState<CourseRow | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        if (!slug) {
          if (mounted) {
            setCourse(null);
            setLessons([]);
            setEnrollment(null);
            setErrorMsg("강의 정보를 찾을 수 없습니다.");
          }
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select(
            "id, slug, title, level, description, status, sort_order, thumbnail_url, is_visible"
          )
          .eq("slug", slug)
          .eq("is_visible", true)
          .neq("status", "draft")
          .maybeSingle();

        if (courseError) {
          throw courseError;
        }

        if (!courseData) {
          if (mounted) {
            setErrorMsg("해당 강의를 찾을 수 없습니다.");
            setCourse(null);
            setLessons([]);
            setEnrollment(null);
          }
          return;
        }

        const courseRow = courseData as CourseRow;

        const [lessonsResult, enrollmentResult] = await Promise.all([
          supabase
            .from("course_lessons")
            .select(
              `
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
            `
            )
            .eq("course_id", courseRow.id)
            .eq("is_visible", true)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          user
            ? supabase
                .from("course_enrollments")
                .select(
                  "course_id, progress, last_lesson_title, last_studied_at, is_completed"
                )
                .eq("user_id", user.id)
                .eq("course_id", courseRow.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (lessonsResult.error) {
          throw lessonsResult.error;
        }

        if ("error" in enrollmentResult && enrollmentResult.error) {
          throw enrollmentResult.error;
        }

        if (mounted) {
          setCourse(courseRow);
          setLessons((lessonsResult.data as LessonRow[] | null) ?? []);
          setEnrollment(
            ((enrollmentResult as { data: EnrollmentRow | null }).data ??
              null) as EnrollmentRow | null
          );
        }
      } catch (error) {
        console.error(error);
        if (mounted) {
          setErrorMsg("강의 상세 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const action = useMemo(() => {
    return getCourseActionState(course, enrollment);
  }, [course, enrollment]);

  const previewLessonsCount = useMemo(() => {
    return lessons.filter((lesson) => lesson.is_preview).length;
  }, [lessons]);

  const totalDurationText = useMemo(() => {
    const total = lessons.reduce(
      (sum, lesson) => sum + Number(lesson.video_seconds || 0),
      0
    );
    return formatSeconds(total);
  }, [lessons]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-gray-600">강의 정보를 불러오는 중입니다.</p>
          </div>
        </div>
      </main>
    );
  }

  if (errorMsg || !course) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="rounded-[28px] border border-red-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-red-600">
              {errorMsg || "강의를 찾을 수 없습니다."}
            </p>

            <div className="mt-5">
              <Link
                href="/courses"
                className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                강의 카탈로그로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                강의 상세
              </div>

              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                {course.title}
              </h1>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  {course.level}
                </span>

                <span
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${action.badgeClass}`}
                >
                  {action.badgeLabel}
                </span>

                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  레슨 {lessons.length}개
                </span>

                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  미리보기 {previewLessonsCount}개
                </span>
              </div>

              <p className="mt-5 text-sm leading-7 text-gray-600 sm:text-base">
                {course.description || "강의 설명이 아직 등록되지 않았습니다."}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-500">진도율</p>
                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {enrollment ? `${enrollment.progress}%` : "미시작"}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {enrollment?.last_lesson_title || "아직 학습 기록이 없습니다."}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-500">최근 학습일</p>
                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {formatDate(enrollment?.last_studied_at)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    총 예상 학습 시간 {totalDurationText}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={action.buttonHref}
                  className={`inline-flex items-center justify-center rounded-2xl px-5 py-4 text-base font-semibold transition ${action.buttonClass}`}
                >
                  {action.buttonLabel}
                </Link>

                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center rounded-2xl border border-gray-300 bg-white px-5 py-4 text-base font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  카탈로그로 돌아가기
                </Link>
              </div>
            </div>

            <div>
              <Thumbnail src={course.thumbnail_url} title={course.title} />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">강의 상태</p>
            <p className="mt-2 text-lg font-bold text-gray-900">{action.badgeLabel}</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              공개 상태와 내 수강 상태를 함께 기준으로 표시합니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">총 레슨 수</p>
            <p className="mt-2 text-lg font-bold text-gray-900">{lessons.length}개</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              공개된 레슨만 기준으로 보여줍니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">예상 학습 시간</p>
            <p className="mt-2 text-lg font-bold text-gray-900">{totalDurationText}</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              등록된 영상 길이 기준 합계입니다.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">커리큘럼</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">강의 레슨 목록</h2>
            </div>
            <p className="text-sm text-gray-500">
              미리보기 가능 여부와 함께 표시됩니다.
            </p>
          </div>

          {lessons.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              아직 등록된 레슨이 없습니다.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {lessons.map((lesson, index) => (
                <article
                  key={lesson.id}
                  className="rounded-[24px] border border-gray-200 bg-gray-50 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                          Lesson {index + 1}
                        </span>

                        {lesson.is_preview ? (
                          <span className="inline-flex rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                            미리보기
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
                            일반 레슨
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-xl font-bold text-gray-900">
                        {lesson.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {lesson.description || "레슨 설명이 아직 등록되지 않았습니다."}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                      <p>영상 길이</p>
                      <p className="mt-1 font-semibold text-gray-900">
                        {formatSeconds(lesson.video_seconds)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">다음 단계</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">
                강의실에서 바로 시작해 보세요
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={action.buttonHref}
                className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${action.buttonClass}`}
              >
                {action.buttonLabel}
              </Link>

              <Link
                href="/classroom"
                className="inline-flex items-center justify-center rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
              >
                나의 강의실
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}