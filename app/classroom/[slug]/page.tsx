"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
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
};

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
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

export default async function ClassroomCourseDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, slug, title, level, description, status, thumbnail_url, is_visible")
    .eq("slug", slug)
    .eq("is_visible", true)
    .maybeSingle();

  if (courseError) {
    console.error(courseError);
  }

  if (!course || course.status === "draft") {
    notFound();
  }

  let enrollment: EnrollmentRow | null = null;

  if (user) {
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select("course_id, progress, last_lesson_title, last_studied_at, is_completed")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle();

    if (enrollmentError) {
      console.error(enrollmentError);
    } else {
      enrollment = enrollmentData as EnrollmentRow | null;
    }
  }

  const { data: lessonRows, error: lessonError } = await supabase
    .from("course_lessons")
    .select("id, title, description, sort_order, is_preview, is_visible")
    .eq("course_id", course.id)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (lessonError) {
    console.error(lessonError);
  }

  const lessons = ((lessonRows as LessonRow[] | null) ?? []).map((lesson, index, arr) => ({
    ...lesson,
    state: getLessonState(index, arr.length, enrollment?.progress ?? 0),
  }));

  const progress = enrollment?.progress ?? 0;
  const isCompleted = enrollment?.is_completed ?? false;
  const tone = getProgressTone(progress, isCompleted);

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
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

            <div className="grid min-w-[280px] gap-3 sm:grid-cols-2 lg:w-[340px] lg:grid-cols-1">
              <Link
                href="/classroom"
                className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-center text-base font-semibold text-gray-900 transition hover:bg-gray-50"
              >
                강의실로 돌아가기
              </Link>
              <Link
                href="/talk"
                className={`rounded-2xl px-5 py-4 text-center text-base font-semibold transition ${tone.buttonClass}`}
              >
                {tone.buttonLabel}
              </Link>
            </div>
          </div>

          <div className="mt-6">
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
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">학습 상태</p>
            <p className="mt-2 text-lg font-bold text-gray-900">{tone.badge}</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              수강 기록이 있으면 자동으로 이어보기 상태가 반영되고, 100%에 도달하면 완료 상태로 바뀝니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">최근 학습 내용</p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {enrollment?.last_lesson_title ?? "아직 기록이 없습니다."}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              마지막 학습 시점은 {formatDate(enrollment?.last_studied_at)} 기준으로 표시됩니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">레슨 상태</p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {lessons.length > 0 ? `${lessons.length}개 레슨 연결 완료` : "레슨 준비 중"}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              이제 상세 페이지의 레슨 목록이 DB에서 직접 불러와집니다.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">레슨 구성</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">DB 연동 상세 페이지 레이아웃</h2>
            </div>
            <p className="text-sm text-gray-500">course_lessons 테이블 기준으로 표시합니다.</p>
          </div>

          {lessons.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              아직 연결된 레슨이 없습니다. course_lessons 테이블에 레슨을 추가해 주세요.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {lessons.map((lesson) => {
                const badgeLabel =
                  lesson.state === "done"
                    ? "학습 완료"
                    : lesson.state === "doing"
                    ? "학습 가능"
                    : "잠금";

                const badgeClass =
                  lesson.state === "done"
                    ? "bg-green-100 text-green-700"
                    : lesson.state === "doing"
                    ? "bg-black text-white"
                    : "bg-white text-gray-500 ring-1 ring-gray-200";

                return (
                  <article
                    key={lesson.id}
                    className="rounded-[24px] border border-gray-200 bg-gray-50 p-5 transition hover:border-gray-300"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {lesson.is_preview ? (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                              미리보기
                            </span>
                          ) : null}
                          <h3 className="text-lg font-bold text-gray-900">{lesson.title}</h3>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-600">{lesson.description}</p>
                      </div>

                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href="/talk"
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                          lesson.state === "locked"
                            ? "border border-gray-200 bg-white text-gray-400"
                            : "bg-black text-white hover:opacity-90"
                        }`}
                      >
                        {lesson.state === "locked" ? "준비 중" : "학습하러 가기"}
                      </Link>

                      <button
                        type="button"
                        className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                      >
                        학습 메모
                      </button>
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
