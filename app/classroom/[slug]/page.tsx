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

  const progress = enrollment?.progress ?? 0;
  const isCompleted = enrollment?.is_completed ?? false;
  const tone = getProgressTone(progress, isCompleted);

  const lessons = [
    {
      id: 1,
      title: "1강. 핵심 표현 익히기",
      desc: "강의의 핵심 문형과 분위기를 먼저 익히는 파트입니다.",
      state: progress >= 1 ? "done" : "ready",
    },
    {
      id: 2,
      title: "2강. 예문으로 패턴 확장하기",
      desc: "짧은 예문을 통해 실제 사용 장면으로 확장합니다.",
      state: progress >= 35 ? "doing" : "locked",
    },
    {
      id: 3,
      title: "3강. 응용 회화 연결",
      desc: "문형을 회화 상황에 넣어 자연스럽게 연결합니다.",
      state: progress >= 70 ? "doing" : "locked",
    },
    {
      id: 4,
      title: "4강. 마무리 복습",
      desc: "배운 표현을 한 번 더 정리하고 복습합니다.",
      state: progress >= 100 ? "done" : "locked",
    },
  ];

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
            <p className="text-sm font-semibold text-gray-500">다음 확장 포인트</p>
            <p className="mt-2 text-lg font-bold text-gray-900">레슨 DB 연결</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              다음에는 course_lessons 테이블을 붙여서 각 강의의 레슨 목록과 잠금 상태를 실제 데이터로 바꾸면 됩니다.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">레슨 구성</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">기본 상세 페이지 레이아웃</h2>
            </div>
            <p className="text-sm text-gray-500">지금은 더미 레슨 목록으로 먼저 구조를 잡아두었습니다.</p>
          </div>

          <div className="mt-6 grid gap-4">
            {lessons.map((lesson) => {
              const badgeLabel =
                lesson.state === "done"
                  ? "학습 완료"
                  : lesson.state === "doing"
                  ? "학습 가능"
                  : lesson.state === "ready"
                  ? "시작 가능"
                  : "잠금";

              const badgeClass =
                lesson.state === "done"
                  ? "bg-green-100 text-green-700"
                  : lesson.state === "doing"
                  ? "bg-black text-white"
                  : lesson.state === "ready"
                  ? "bg-gray-200 text-gray-800"
                  : "bg-white text-gray-500 ring-1 ring-gray-200";

              return (
                <article
                  key={lesson.id}
                  className="rounded-[24px] border border-gray-200 bg-gray-50 p-5 transition hover:border-gray-300"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{lesson.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{lesson.desc}</p>
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
        </section>
      </div>
    </main>
  );
}