"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MyProfile = {
  id: string;
  email: string;
  full_name?: string | null;
  plan?: string | null;
};

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

type EnrollmentRow = {
  course_id: string;
  progress: number;
  last_lesson_title?: string | null;
  last_studied_at?: string | null;
  is_completed: boolean;
};

type CourseCard = {
  id: string;
  title: string;
  level: string;
  description: string;
  progress: number;
  status: "continue" | "ready" | "coming" | "completed";
  ctaLabel: string;
  href: string;
  lastLessonTitle?: string | null;
  lastStudiedAt?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function ClassroomPage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [courseRows, setCourseRows] = useState<CourseRow[]>([]);
  const [enrollmentRows, setEnrollmentRows] = useState<EnrollmentRow[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const [{ data: profileData }, { data: enrollmentsData, error: enrollmentsError }] =
            await Promise.all([
              supabase
                .from("profiles")
                .select("id, email, full_name, plan")
                .eq("id", user.id)
                .maybeSingle(),
              supabase
                .from("course_enrollments")
                .select("course_id, progress, last_lesson_title, last_studied_at, is_completed")
                .eq("user_id", user.id)
                .order("last_studied_at", { ascending: false }),
            ]);

          if (enrollmentsError) {
            throw enrollmentsError;
          }

          if (mounted) {
            setProfile({
              id: user.id,
              email: user.email ?? "",
              full_name: profileData?.full_name ?? "",
              plan: profileData?.plan ?? "FREE",
            });
            setEnrollmentRows((enrollmentsData as EnrollmentRow[] | null) ?? []);
          }
        }

        const { data: coursesData, error: coursesFetchError } = await supabase
          .from("courses")
          .select("id, slug, title, level, description, status, sort_order, thumbnail_url, is_visible")
          .eq("is_visible", true)
          .neq("status", "draft")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (coursesFetchError) {
          throw coursesFetchError;
        }

        if (mounted) {
          setCourseRows((coursesData as CourseRow[] | null) ?? []);
          setCoursesError("");
        }
      } catch (error) {
        console.error(error);
        if (mounted) {
          setCoursesError("강의실 데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setCoursesLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const displayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    if (profile?.email?.trim()) return profile.email.split("@")[0];
    return "회원";
  }, [profile]);

  const enrollmentMap = useMemo(() => {
    return new Map(enrollmentRows.map((row) => [row.course_id, row]));
  }, [enrollmentRows]);

  const courses: CourseCard[] = useMemo(() => {
    const mapped = courseRows.map((course) => {
      const enrollment = enrollmentMap.get(course.id);

      if (course.status === "coming") {
        return {
          id: course.id,
          title: course.title,
          level: course.level,
          description: course.description,
          progress: 0,
          status: "coming" as const,
          ctaLabel: "곧 공개",
          href: "/classroom",
          lastLessonTitle: null,
          lastStudiedAt: null,
        };
      }

      if (enrollment?.is_completed || enrollment?.progress === 100) {
        return {
          id: course.id,
          title: course.title,
          level: course.level,
          description: course.description,
          progress: 100,
          status: "completed" as const,
          ctaLabel: "복습하러 가기",
          href: `/classroom/${course.slug}`,
          lastLessonTitle: enrollment.last_lesson_title ?? "완료한 강의",
          lastStudiedAt: enrollment.last_studied_at ?? null,
        };
      }

      if (enrollment && enrollment.progress > 0) {
        return {
          id: course.id,
          title: course.title,
          level: course.level,
          description: course.description,
          progress: enrollment.progress,
          status: "continue" as const,
          ctaLabel: "이어서 학습",
          href: `/classroom/${course.slug}`,
          lastLessonTitle: enrollment.last_lesson_title ?? "최근 학습 기록",
          lastStudiedAt: enrollment.last_studied_at ?? null,
        };
      }

      return {
        id: course.id,
        title: course.title,
        level: course.level,
        description: course.description,
        progress: 0,
        status: "ready" as const,
        ctaLabel: "강의 보기",
        href: `/classroom/${course.slug}`,
        lastLessonTitle: null,
        lastStudiedAt: null,
      };
    });

    const priority = {
      continue: 0,
      ready: 1,
      completed: 2,
      coming: 3,
    } as const;

    return mapped.sort((a, b) => priority[a.status] - priority[b.status]);
  }, [courseRows, enrollmentMap]);

  const continueCourse = courses.find((course) => course.status === "continue") ?? null;
  const openCoursesCount = courseRows.filter((course) => course.status === "open").length;
  const enrolledCoursesCount = enrollmentRows.length;
  const completedCoursesCount = enrollmentRows.filter(
    (row) => row.is_completed || row.progress === 100
  ).length;
  const planLabel = (profile?.plan ?? "FREE").toUpperCase();

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 pb-12 pt-6 text-gray-900 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                나의 강의실
              </div>

              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {loading ? "강의실을 불러오는 중입니다." : `${displayName}님의 학습 공간입니다.`}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                이제 강의실은 공개 강의 목록뿐 아니라, 회원님의 진도와 최근 학습 기록까지 함께 보여주는 구조로
                바뀌었습니다.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  현재 플랜 {planLabel}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  공개 강의 {openCoursesCount}개
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  수강 기록 {enrolledCoursesCount}개
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  완료 강의 {completedCoursesCount}개
                </span>
              </div>
            </div>

            <div className="grid min-w-[260px] gap-3 sm:grid-cols-2 lg:w-[340px] lg:grid-cols-1">
              <Link
                href={continueCourse?.href ?? "/classroom"}
                className="rounded-2xl bg-black px-5 py-4 text-center text-base font-semibold text-white transition hover:opacity-90"
              >
                {continueCourse ? "▶ 이어서 학습" : "강의 목록 보기"}
              </Link>
              <Link
                href="/mypage"
                className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-center text-base font-semibold text-gray-900 transition hover:bg-gray-50"
              >
                마이페이지로 돌아가기
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">이어서 보기</p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {continueCourse ? continueCourse.title : "아직 이어볼 강의가 없습니다."}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {continueCourse
                ? `${continueCourse.progress}% 진행 중 · ${continueCourse.lastLessonTitle ?? "최근 기록"}`
                : "수강 기록이 생기면 이곳에 가장 먼저 이어볼 강의가 표시됩니다."}
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">최근 학습일</p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {continueCourse?.lastStudiedAt ? formatDateTime(continueCourse.lastStudiedAt) : "기록 없음"}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              실제 학습 버튼과 연결하면 마지막 학습 시점이 자동으로 더 정확하게 반영됩니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">강의실 운영 상태</p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {coursesLoading ? "불러오는 중" : coursesError ? "점검 필요" : "진도 연결 완료"}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {coursesError || "이제 course_enrollments 테이블을 통해 사용자별 진도를 표시합니다."}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">강의 목록</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">사용자 진도 연동형 카드 레이아웃</h2>
            </div>
            <p className="text-sm text-gray-500">내 수강 기록에 따라 카드 상태가 달라집니다.</p>
          </div>

          {coursesLoading ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              강의 목록을 불러오는 중입니다.
            </div>
          ) : coursesError ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              {coursesError}
            </div>
          ) : courses.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              아직 표시할 강의가 없습니다. courses 테이블에 공개 강의를 추가해 주세요.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              {courses.map((course) => (
                <article
                  key={course.id}
                  className="rounded-[24px] border border-gray-200 bg-gray-50 p-5 transition hover:border-gray-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                        {course.level}
                      </span>
                      <h3 className="mt-3 text-xl font-bold text-gray-900">{course.title}</h3>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        course.status === "continue"
                          ? "bg-black text-white"
                          : course.status === "ready"
                          ? "bg-gray-200 text-gray-800"
                          : course.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-white text-gray-500 ring-1 ring-gray-200"
                      }`}
                    >
                      {course.status === "continue"
                        ? "학습 중"
                        : course.status === "ready"
                        ? "시작 가능"
                        : course.status === "completed"
                        ? "완료"
                        : "공개 예정"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-gray-600">{course.description}</p>

                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                    <p className="text-xs font-semibold text-gray-500">최근 학습</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {course.lastLessonTitle ?? "아직 학습 기록이 없습니다."}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {course.lastStudiedAt ? formatDateTime(course.lastStudiedAt) : "기록 없음"}
                    </p>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-600">
                      <span>진도율</span>
                      <span>{course.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white ring-1 ring-gray-200">
                      <div
                        className="h-2 rounded-full bg-black transition-all"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <Link
                      href={course.href}
                      className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        course.status === "continue"
                          ? "bg-black text-white hover:opacity-90"
                          : course.status === "ready"
                          ? "border border-gray-300 bg-white text-gray-900 hover:bg-gray-100"
                          : course.status === "completed"
                          ? "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border border-gray-200 bg-white text-gray-500"
                      }`}
                    >
                      {course.ctaLabel}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
