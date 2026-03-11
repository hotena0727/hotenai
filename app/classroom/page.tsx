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

type CourseCard = {
  id: string;
  title: string;
  level: string;
  description: string;
  progress: number;
  status: "continue" | "ready" | "coming";
  ctaLabel: string;
  href: string;
};

export default function ClassroomPage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [courseRows, setCourseRows] = useState<CourseRow[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("id, email, full_name, plan")
            .eq("id", user.id)
            .maybeSingle();

          if (mounted) {
            setProfile({
              id: user.id,
              email: user.email ?? "",
              full_name: data?.full_name ?? "",
              plan: data?.plan ?? "FREE",
            });
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
          setCoursesError("강의 목록을 불러오지 못했습니다.");
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

  const courses: CourseCard[] = useMemo(() => {
    return courseRows.map((course, index) => {
      const isOpen = course.status === "open";
      const isContinue = isOpen && index === 0;

      return {
        id: course.id,
        title: course.title,
        level: course.level,
        description: course.description,
        progress: isContinue ? 35 : 0,
        status: isContinue ? "continue" : isOpen ? "ready" : "coming",
        ctaLabel: isContinue ? "이어서 학습" : isOpen ? "강의 보기" : "곧 공개",
        href: isOpen ? `/classroom/${course.slug}` : "/classroom",
      };
    });
  }, [courseRows]);

  const continueCourse = courses.find((course) => course.status === "continue") ?? null;
  const openCoursesCount = courseRows.filter((course) => course.status === "open").length;
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
                이제 강의실은 예시 카드가 아니라 실제 강의 데이터 기반으로 보이도록 연결해 두었습니다.
                공개 강의와 공개 예정 강의를 이 화면에서 함께 관리할 수 있습니다.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  현재 플랜 {planLabel}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  공개 강의 {openCoursesCount}개
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  전체 노출 강의 {courseRows.length}개
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
            <p className="text-sm font-semibold text-gray-500">이어보기</p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {continueCourse ? continueCourse.title : "아직 이어볼 강의가 없습니다."}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {continueCourse
                ? `${continueCourse.progress}%까지 진행된 것으로 표시했습니다. 이후에는 실제 진도 테이블과 연결하면 됩니다.`
                : "공개된 강의가 생기면 이곳에 가장 먼저 이어볼 강의가 표시됩니다."}
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">강의실 운영 상태</p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {coursesLoading ? "불러오는 중" : coursesError ? "점검 필요" : "DB 연결 완료"}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {coursesError || "이제 courses 테이블만 수정해도 강의 카드가 함께 바뀝니다."}
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">다음 확장 포인트</p>
            <p className="mt-2 text-lg font-bold text-gray-900">수강 진도 연결</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              다음에는 course_enrollments 테이블을 붙여서 사용자별 이어보기와 완료율을 진짜 데이터로 바꾸면 됩니다.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">강의 목록</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">DB 연결형 카드 레이아웃</h2>
            </div>
            <p className="text-sm text-gray-500">courses 테이블의 공개 강의와 공개 예정 강의를 표시합니다.</p>
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
                          : "bg-white text-gray-500 ring-1 ring-gray-200"
                      }`}
                    >
                      {course.status === "continue"
                        ? "학습 중"
                        : course.status === "ready"
                        ? "공개 중"
                        : "공개 예정"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-gray-600">{course.description}</p>

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
