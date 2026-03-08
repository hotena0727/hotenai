"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchAllAttempts, type QuizAttemptRow } from "@/lib/attempts";
import {
  isKanjiAttempt,
  isTalkAttempt,
  isWordAttempt,
} from "@/lib/labels";

type HomeProfile = {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  is_admin: boolean;
};

type DayBucket = {
  key: string;
  label: string;
  count: number;
};

const DAILY_GOAL_SETS = 3;

function calcCount(
  attempts: QuizAttemptRow[],
  fn: (posMode?: string) => boolean
) {
  return attempts.filter((item) => fn(item.pos_mode)).length;
}

function calcAvg(
  attempts: QuizAttemptRow[],
  fn: (posMode?: string) => boolean
) {
  const filtered = attempts.filter((item) => fn(item.pos_mode));
  const valid = filtered.filter((item) => Number(item.quiz_len || 0) > 0);
  if (valid.length === 0) return 0;

  return Math.round(
    valid.reduce((sum, item) => {
      const quizLen = Number(item.quiz_len || 0);
      const score = Number(item.score || 0);
      return sum + (score / quizLen) * 100;
    }, 0) / valid.length
  );
}

function getTodayMessage(totalAttempts: number, totalWrong: number) {
  if (totalAttempts === 0) {
    return "오늘의 첫 루틴부터 가볍게 시작해봅시다.";
  }
  if (totalWrong === 0) {
    return "좋아요. 오늘 흐름이 아주 좋습니다.";
  }
  if (totalWrong <= 3) {
    return "조금 틀려도 괜찮습니다. 오늘 루틴은 잘 이어가고 있어요.";
  }
  return "꾸준함은 재능을 이깁니다. 오늘도 한 세트 더 가봅시다.";
}

function toDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildLast7Days(attempts: QuizAttemptRow[]): DayBucket[] {
  const today = new Date();
  const map = new Map<string, number>();

  attempts.forEach((item) => {
    const d = toDate(item.created_at);
    if (!d) return;
    const key = formatDayKey(d);
    map.set(key, (map.get(key) || 0) + 1);
  });

  const days: DayBucket[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(today.getDate() - i);

    const key = formatDayKey(d);
    const label = i === 0 ? "오늘" : `${d.getMonth() + 1}/${d.getDate()}`;

    days.push({
      key,
      label,
      count: map.get(key) || 0,
    });
  }

  return days;
}

function calcStreak(days: DayBucket[]) {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].count > 0) streak += 1;
    else break;
  }
  return streak;
}

function buildLevelProgress(attempts: QuizAttemptRow[]) {
  const levels = ["N5", "N4", "N3", "N2", "N1"];
  const counts = new Map<string, number>();

  levels.forEach((lv) => counts.set(lv, 0));

  attempts.forEach((item) => {
    const raw = String(item.level || "").trim().toUpperCase();
    if (counts.has(raw)) {
      counts.set(raw, (counts.get(raw) || 0) + 1);
    }
  });

  const max = Math.max(...levels.map((lv) => counts.get(lv) || 0), 1);

  return levels.map((lv) => ({
    level: lv,
    count: counts.get(lv) || 0,
    widthPct: Math.round(((counts.get(lv) || 0) / max) * 100),
  }));
}

function calcGoalPercent(totalTodaySets: number) {
  return Math.min(100, Math.round((totalTodaySets / DAILY_GOAL_SETS) * 100));
}

function getTodayAttemptCount(attempts: QuizAttemptRow[]) {
  const todayKey = formatDayKey(new Date());
  return attempts.filter((item) => {
    const d = toDate(item.created_at);
    return d ? formatDayKey(d) === todayKey : false;
  }).length;
}

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const loadHome = async () => {
      setLoading(true);
      setErrorMsg("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error(sessionError);
          setErrorMsg("세션을 확인하지 못했습니다.");
          setLoading(false);
          return;
        }

        if (!session?.user) {
          setErrorMsg("로그인이 필요합니다.");
          setLoading(false);
          return;
        }

        const user = session.user;

        const googleName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.user_name ||
          "";

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, plan, is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
          setErrorMsg("profiles 정보를 불러오지 못했습니다.");
          setLoading(false);
          return;
        }

        setProfile({
          id: user.id,
          email: user.email ?? "",
          full_name: profileRow?.full_name || googleName || "",
          plan: String(profileRow?.plan || "FREE").toUpperCase(),
          is_admin: Boolean(profileRow?.is_admin),
        });

        const all = await fetchAllAttempts(user.id, 300);
        setAttempts(all);
      } catch (error) {
        console.error(error);
        setErrorMsg("홈 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void loadHome();
  }, []);

  useEffect(() => {
    if (errorMsg === "로그인이 필요합니다.") {
      router.replace("/login");
    }
  }, [errorMsg, router]);

  const stats = useMemo(() => {
    const totalAttempts = attempts.length;
    const totalWrong = attempts.reduce(
      (sum, item) => sum + Number(item.wrong_count || 0),
      0
    );

    const wordCount = calcCount(attempts, isWordAttempt);
    const kanjiCount = calcCount(attempts, isKanjiAttempt);
    const talkCount = calcCount(attempts, isTalkAttempt);

    const wordAvg = calcAvg(attempts, isWordAttempt);
    const kanjiAvg = calcAvg(attempts, isKanjiAttempt);
    const talkAvg = calcAvg(attempts, isTalkAttempt);

    const recent7Days = buildLast7Days(attempts);
    const streak = calcStreak(recent7Days);
    const todayCount = getTodayAttemptCount(attempts);
    const goalPercent = calcGoalPercent(todayCount);
    const levelProgress = buildLevelProgress(attempts);

    return {
      totalAttempts,
      totalWrong,
      wordCount,
      kanjiCount,
      talkCount,
      wordAvg,
      kanjiAvg,
      talkAvg,
      recent7Days,
      streak,
      todayCount,
      goalPercent,
      levelProgress,
    };
  }, [attempts]);

  const todayMessage = useMemo(
    () => getTodayMessage(stats.totalAttempts, stats.totalWrong),
    [stats.totalAttempts, stats.totalWrong]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg === "로그인이 필요합니다.") {
    return null;
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-sm text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mt-4">
          <p className="text-3xl font-bold">
            {profile?.full_name ? `${profile.full_name}님,` : "하테나일본어"}
          </p>

          <div className="mt-4 inline-flex rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-base font-medium text-gray-900">
            • {todayMessage}
          </div>

          <p className="mt-3 text-base text-gray-600">
            오늘의 성취율을 확인하고, 바로 이어가세요.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6">
          <div className="flex flex-col items-center">
            <div
              className="flex h-44 w-44 items-center justify-center rounded-full bg-[conic-gradient(#3b82f6_var(--p),#e5e7eb_0)] shadow-sm"
              style={{ ["--p" as string]: `${(stats.goalPercent / 100) * 360}deg` }}
            >
              <div className="flex h-30 w-30 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                <p className="text-3xl font-bold">{stats.goalPercent}%</p>
                <p className="mt-1 text-sm text-gray-600">오늘 목표</p>
              </div>
            </div>

            <div className="mt-5 rounded-full border border-gray-200 bg-white px-5 py-2 text-lg font-semibold">
              🔥 {stats.streak}일
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">이번 주 루틴</p>
            <p className="text-2xl font-semibold text-gray-500">
              {stats.todayCount}/7일
            </p>
          </div>
          <p className="mt-2 text-lg text-gray-600">최근 7일 (오늘 포함)</p>

          <div className="mt-5 grid grid-cols-7 gap-3">
            {stats.recent7Days.map((day, idx) => {
              const active = day.count > 0;
              const isToday = idx === stats.recent7Days.length - 1;

              return (
                <div key={day.key} className="text-center">
                  <div
                    className={
                      active
                        ? isToday
                          ? "h-5 rounded-full border border-blue-400 bg-blue-300"
                          : "h-5 rounded-full border border-blue-200 bg-blue-100"
                        : "h-5 rounded-full border border-gray-300 bg-white"
                    }
                  />
                  <p className="mt-3 text-sm text-gray-500">{day.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold">📊 레벨 진행</p>
            <p className="text-sm text-gray-500">최근 학습 기준</p>
          </div>

          <div className="mt-5 space-y-4">
            {stats.levelProgress.map((item) => (
              <div
                key={item.level}
                className="grid grid-cols-[48px_1fr_32px] items-center gap-3"
              >
                <p className="font-semibold text-gray-700">{item.level}</p>
                <div className="h-3 rounded-full bg-gray-100">
                  <div
                    className="h-3 rounded-full bg-blue-400"
                    style={{ width: `${item.widthPct}%` }}
                  />
                </div>
                <p className="text-right text-sm text-gray-600">{item.count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4">
          <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold">📝 단어</p>
                <p className="mt-2 text-sm text-gray-600">
                  기본 어휘를 문제와 패턴 카드로 익혀보세요.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{stats.wordCount}</p>
                <p className="text-xs text-gray-500">학습 횟수</p>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-sm text-gray-500">평균 점수</p>
                <p className="mt-1 text-2xl font-bold">{stats.wordAvg}%</p>
              </div>
              <a
                href="/word"
                className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm text-gray-800"
              >
                단어 시작
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-green-200 bg-gradient-to-r from-green-50 to-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold">🈯 한자</p>
                <p className="mt-2 text-sm text-gray-600">
                  레벨별 한자 문제를 풀며 읽기와 뜻을 익혀보세요.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{stats.kanjiCount}</p>
                <p className="text-xs text-gray-500">학습 횟수</p>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-sm text-gray-500">평균 점수</p>
                <p className="mt-1 text-2xl font-bold">{stats.kanjiAvg}%</p>
              </div>
              <a
                href="/kanji"
                className="rounded-2xl border border-green-200 bg-white px-4 py-2 text-sm text-gray-800"
              >
                한자 시작
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-purple-200 bg-gradient-to-r from-purple-50 to-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold">🗣️ 회화</p>
                <p className="mt-2 text-sm text-gray-600">
                  실제 대화형 문제로 말문을 자연스럽게 열어보세요.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{stats.talkCount}</p>
                <p className="text-xs text-gray-500">학습 횟수</p>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-sm text-gray-500">평균 점수</p>
                <p className="mt-1 text-2xl font-bold">{stats.talkAvg}%</p>
              </div>
              <a
                href="/talk"
                className="rounded-2xl border border-purple-200 bg-white px-4 py-2 text-sm text-gray-800"
              >
                회화 시작
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
          <p className="text-lg font-semibold">오늘의 추천 루틴</p>
          <p className="mt-2 text-sm text-gray-600">
            오늘 목표 달성에 가장 가볍게 이어가기 좋은 루틴부터 시작해보세요.
          </p>

          <div className="mt-5 rounded-2xl border border-gray-200 p-4">
            <p className="text-base font-medium">
              {stats.goalPercent >= 100
                ? "오늘 목표 달성! 내일도 1세트부터 가볍게 이어가요."
                : "오늘은 회화 1세트부터 가볍게 이어가보세요."}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href="/talk"
              className="rounded-2xl border border-gray-300 px-5 py-4 text-center text-base font-semibold text-gray-900"
            >
              🗣️ 회화 시작
            </a>

            <a
              href="/mypage/wrong-talk"
              className="rounded-2xl border border-gray-300 px-5 py-4 text-center text-base font-semibold text-gray-900"
            >
              ↪️ 반복오답 루틴
            </a>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">최근 학습 요약</p>
              <p className="mt-2 text-sm text-gray-600">
                최근 저장된 학습 결과를 빠르게 확인하세요.
              </p>
            </div>
            <a
              href="/mypage"
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              MY 보기
            </a>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">총 학습 횟수</p>
              <p className="mt-2 text-2xl font-bold">{stats.totalAttempts}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">총 오답 수</p>
              <p className="mt-2 text-2xl font-bold">{stats.totalWrong}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">단어 + 한자</p>
              <p className="mt-2 text-2xl font-bold">
                {stats.wordCount + stats.kanjiCount}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">회화</p>
              <p className="mt-2 text-2xl font-bold">{stats.talkCount}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}