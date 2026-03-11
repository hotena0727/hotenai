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

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) setLoading(false);
          return;
        }

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
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
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

  const courses: CourseCard[] = [
    {
      id: "starter-patterns",
      title: "기초 패턴 코스",
      level: "입문",
      description: "자주 쓰는 문형과 표현을 짧고 가볍게 익히는 과정입니다.",
      progress: 0,
      status: "ready",
      ctaLabel: "수강 준비 중",
      href: "/mypage",
    },
    {
      id: "daily-speaking",
      title: "일상 회화 트레이닝",
      level: "초중급",
      description: "실제 회화에서 바로 쓰는 문장을 중심으로 연습합니다.",
      progress: 35,
      status: "continue",
      ctaLabel: "이어서 학습",
      href: "/talk",
    },
    {
      id: "jlpt-bridge",
      title: "JLPT 브릿지 클래스",
      level: "N3~N2",
      description: "문법·어휘·독해를 자연스럽게 연결하는 강의입니다.",
      progress: 0,
      status: "coming",
      ctaLabel: "곧 공개",
      href: "/mypage",
    },
  ];

  const continueCourse = courses.find((course) => course.status === "continue") ?? null;
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
                지금은 강의실의 기본 화면입니다. 수강 중 강의, 이어보기, 준비 중인 강의를 한눈에 볼 수 있게
                먼저 구성해 두었습니다. 나중에 강의 공개를 시작하면 이 공간을 중심으로 확장할 수 있습니다.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  현재 플랜 {planLabel}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  수강 예정 {courses.length}개
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  현재는 베타 준비 단계
                </span>
              </div>
            </div>

            <div className="grid min-w-[260px] gap-3 sm:grid-cols-2 lg:w-[340px] lg:grid-cols-1">
              <Link
                href={continueCourse?.href ?? "/mypage"}
                className="rounded-2xl bg-black px-5 py-4 text-center text-base font-semibold text-white transition hover:opacity-90"
              >
                {continueCourse ? "▶ 이어서 학습" : "강의 준비 보기"}
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
                ? `${continueCourse.progress}%까지 진행했습니다. 오늘도 흐름을 끊지 않고 이어가 보세요.`
                : "강의가 공개되면 이곳에 가장 먼저 이어볼 강의가 표시됩니다."}
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">강의실 운영 상태</p>
            <p className="mt-2 text-lg font-bold text-gray-900">비공개 준비 중</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              관리자에서 공개 스위치를 켜기 전까지는 마이페이지에서만 제한적으로 노출할 수 있도록 설계되어 있습니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">다음 확장 포인트</p>
            <p className="mt-2 text-lg font-bold text-gray-900">진도 · 자료 · 공지</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              이후에는 강의 상세 페이지, 수강 진도 저장, 자료실, 공지 영역까지 자연스럽게 붙일 수 있습니다.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">강의 목록</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">기본 카드형 레이아웃</h2>
            </div>
            <p className="text-sm text-gray-500">지금은 기본형 예시 데이터로 먼저 구성했습니다.</p>
          </div>

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
                      ? "준비 완료"
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
        </section>

        <section className="mt-6 rounded-[28px] border border-dashed border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-gray-500">운영 메모</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">지금 단계에서 추천하는 다음 작업</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-sm font-bold text-gray-900">1. 상세 페이지 연결</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                강의 카드 클릭 시 챕터와 강의 설명이 보이는 상세 화면으로 이어지게 하면 흐름이 더 단단해집니다.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-sm font-bold text-gray-900">2. 실제 데이터 연결</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Supabase에 강의 테이블과 수강 진도 테이블을 만들면 사용자별 강의실이 완성됩니다.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-sm font-bold text-gray-900">3. 공개 시점 제어</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                이미 만든 관리자 스위치와 연결해서 준비가 끝난 시점에만 단계적으로 오픈하면 됩니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
