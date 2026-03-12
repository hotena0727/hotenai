"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { fetchAllAttempts, type QuizAttemptRow } from "@/lib/attempts";
import {
  isKanjiAttempt,
  isKatsuyouAttempt,
  isTalkAttempt,
  isWordAttempt,
} from "@/lib/labels";
import {
  getPlanBadge,
  getPlanTheme,
  hasPlan,
  normalizePlan,
  type PlanCode,
} from "@/lib/plans";

type HomeProfile = {
  id: string;
  email: string;
  full_name: string;
  plan: PlanCode;
  is_admin: boolean;
  daily_goal_sets: number;
};

type MenuSettings = {
  show_home: boolean;
  show_word: boolean;
  show_kanji: boolean;
  show_katsuyou: boolean;
  show_talk: boolean;
  show_mypage: boolean;
  show_admin: boolean;

  home_min_plan: PlanCode;
  word_min_plan: PlanCode;
  kanji_min_plan: PlanCode;
  katsuyou_min_plan: PlanCode;
  talk_min_plan: PlanCode;
  mypage_min_plan: PlanCode;
  admin_min_plan: PlanCode;
};

type DayBucket = {
  key: string;
  label: string;
  count: number;
};

type BalanceItem = {
  subject: string;
  value: number;
};

function canAccess(
  userPlan: string | null | undefined,
  minPlan: PlanCode,
  show: boolean
): boolean {
  if (!show) return false;
  return hasPlan(userPlan, minPlan);
}

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

function calcGoalPercent(totalTodaySets: number, goalSets: number) {
  const safeGoal = Math.max(1, Number(goalSets || 1));
  return Math.min(100, Math.round((totalTodaySets / safeGoal) * 100));
}

function getTodayAttemptCount(attempts: QuizAttemptRow[]) {
  const todayKey = formatDayKey(new Date());
  return attempts.filter((item) => {
    const d = toDate(item.created_at);
    return d ? formatDayKey(d) === todayKey : false;
  }).length;
}

function getPlanProgressColors(plan: PlanCode) {
  switch (plan) {
    case "light":
      return { main: "#38bdf8", rest: "#e0f2fe" };
    case "standard":
      return { main: "#8b5cf6", rest: "#ede9fe" };
    case "pro":
      return { main: "#3b82f6", rest: "#dbeafe" };
    case "vip":
      return { main: "#f59e0b", rest: "#fef3c7" };
    case "free":
    default:
      return { main: "#6b7280", rest: "#e5e7eb" };
  }
}

function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function calcActiveDays(days: DayBucket[]) {
  return days.filter((d) => d.count > 0).length;
}

function calcReviewScore(
  totalWrong: number,
  todayCount: number,
  totalAttempts: number
) {
  if (totalAttempts === 0) return 0;

  const wrongRate = totalWrong / Math.max(1, totalAttempts);
  const routineBonus = Math.min(30, todayCount * 10);
  const base = 100 - wrongRate * 18 + routineBonus;

  return clampScore(base);
}

function calcConsistencyScore(
  streak: number,
  activeDays7: number,
  todayCount: number
) {
  const streakPart = Math.min(45, streak * 8);
  const activePart = Math.min(40, activeDays7 * 6);
  const todayPart = Math.min(15, todayCount * 5);

  return clampScore(streakPart + activePart + todayPart);
}

function buildBalanceData(stats: {
  wordAvg: number;
  kanjiAvg: number;
  katsuyouAvg: number;
  talkAvg: number;
  totalWrong: number;
  totalAttempts: number;
  streak: number;
  todayCount: number;
  recent7Days: DayBucket[];
}): BalanceItem[] {
  const activeDays7 = calcActiveDays(stats.recent7Days);

  return [
    { subject: "단어", value: clampScore(stats.wordAvg) },
    { subject: "한자", value: clampScore(stats.kanjiAvg) },
    { subject: "활용", value: clampScore(stats.katsuyouAvg) },
    { subject: "회화", value: clampScore(stats.talkAvg) },
    {
      subject: "복습",
      value: calcReviewScore(
        stats.totalWrong,
        stats.todayCount,
        stats.totalAttempts
      ),
    },
    {
      subject: "꾸준함",
      value: calcConsistencyScore(
        stats.streak,
        activeDays7,
        stats.todayCount
      ),
    },
  ];
}

function pickStrengthWeakness(balanceData: BalanceItem[]) {
  const sorted = [...balanceData].sort((a, b) => b.value - a.value);
  return {
    strengths: sorted.slice(0, 2).map((x) => x.subject),
    weaknesses: sorted.slice(-2).map((x) => x.subject),
  };
}

function getBalanceValue(data: BalanceItem[], subject: string) {
  return data.find((item) => item.subject === subject)?.value ?? 0;
}

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);
  const [showCoursesSection, setShowCoursesSection] = useState(false);

  const [menuSettings, setMenuSettings] = useState<MenuSettings>({
    show_home: true,
    show_word: true,
    show_kanji: true,
    show_katsuyou: true,
    show_talk: true,
    show_mypage: true,
    show_admin: true,

    home_min_plan: "free",
    word_min_plan: "free",
    kanji_min_plan: "free",
    katsuyou_min_plan: "free",
    talk_min_plan: "free",
    mypage_min_plan: "free",
    admin_min_plan: "pro",
  });

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
          .select("full_name, plan, is_admin, daily_goal_sets")
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
          plan: normalizePlan(profileRow?.plan),
          is_admin: Boolean(profileRow?.is_admin),
          daily_goal_sets: Math.max(1, Number(profileRow?.daily_goal_sets || 3)),
        });

        const { data: menuRow, error: menuError } = await supabase
          .from("app_menu_settings")
          .select(`
            show_home,
            show_word,
            show_kanji,
            show_katsuyou,
            show_talk,
            show_mypage,
            show_admin,
            home_min_plan,
            word_min_plan,
            kanji_min_plan,
            katsuyou_min_plan,
            talk_min_plan,
            mypage_min_plan,
            admin_min_plan
          `)
          .eq("id", 1)
          .maybeSingle();

        if (menuError) {
          console.error(menuError);
        } else if (menuRow) {
          setMenuSettings({
            show_home: Boolean(menuRow.show_home),
            show_word: Boolean(menuRow.show_word),
            show_kanji: Boolean(menuRow.show_kanji),
            show_katsuyou: Boolean(menuRow.show_katsuyou),
            show_talk: Boolean(menuRow.show_talk),
            show_mypage: Boolean(menuRow.show_mypage),
            show_admin: Boolean(menuRow.show_admin),

            home_min_plan: normalizePlan(menuRow.home_min_plan),
            word_min_plan: normalizePlan(menuRow.word_min_plan),
            kanji_min_plan: normalizePlan(menuRow.kanji_min_plan),
            katsuyou_min_plan: normalizePlan(menuRow.katsuyou_min_plan),
            talk_min_plan: normalizePlan(menuRow.talk_min_plan),
            mypage_min_plan: normalizePlan(menuRow.mypage_min_plan),
            admin_min_plan: normalizePlan(menuRow.admin_min_plan || "pro"),
          });
        }

        const { data: pageRow, error: pageError } = await supabase
          .from("app_page_settings")
          .select("show_courses_section")
          .eq("id", 1)
          .maybeSingle();

        if (pageError) {
          console.error(pageError);
        } else {
          setShowCoursesSection(Boolean(pageRow?.show_courses_section));
        }

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

  const goalSets = Math.max(1, Number(profile?.daily_goal_sets || 3));

  const stats = useMemo(() => {
    const totalAttempts = attempts.length;
    const totalWrong = attempts.reduce(
      (sum, item) => sum + Number(item.wrong_count || 0),
      0
    );

    const wordCount = calcCount(attempts, isWordAttempt);
    const kanjiCount = calcCount(attempts, isKanjiAttempt);
    const katsuyouCount = calcCount(attempts, isKatsuyouAttempt);
    const talkCount = calcCount(attempts, isTalkAttempt);

    const wordAvg = calcAvg(attempts, isWordAttempt);
    const kanjiAvg = calcAvg(attempts, isKanjiAttempt);
    const katsuyouAvg = calcAvg(attempts, isKatsuyouAttempt);
    const talkAvg = calcAvg(attempts, isTalkAttempt);

    const recent7Days = buildLast7Days(attempts);
    const streak = calcStreak(recent7Days);
    const todayCount = getTodayAttemptCount(attempts);
    const goalPercent = calcGoalPercent(todayCount, goalSets);
    const levelProgress = buildLevelProgress(attempts);
    const activeDays7 = calcActiveDays(recent7Days);

    return {
      totalAttempts,
      totalWrong,
      wordCount,
      kanjiCount,
      katsuyouCount,
      talkCount,
      wordAvg,
      kanjiAvg,
      katsuyouAvg,
      talkAvg,
      recent7Days,
      streak,
      todayCount,
      goalPercent,
      levelProgress,
      activeDays7,
    };
  }, [attempts, goalSets]);

  const todayMessage = useMemo(
    () => getTodayMessage(stats.totalAttempts, stats.totalWrong),
    [stats.totalAttempts, stats.totalWrong]
  );

  const balanceData = useMemo(
    () =>
      buildBalanceData({
        wordAvg: stats.wordAvg,
        kanjiAvg: stats.kanjiAvg,
        katsuyouAvg: stats.katsuyouAvg,
        talkAvg: stats.talkAvg,
        totalWrong: stats.totalWrong,
        totalAttempts: stats.totalAttempts,
        streak: stats.streak,
        todayCount: stats.todayCount,
        recent7Days: stats.recent7Days,
      }),
    [
      stats.wordAvg,
      stats.kanjiAvg,
      stats.katsuyouAvg,
      stats.talkAvg,
      stats.totalWrong,
      stats.totalAttempts,
      stats.streak,
      stats.todayCount,
      stats.recent7Days,
    ]
  );

  const balanceSummary = useMemo(
    () => pickStrengthWeakness(balanceData),
    [balanceData]
  );

  const balanceScores = useMemo(
    () => ({
      word: getBalanceValue(balanceData, "단어"),
      kanji: getBalanceValue(balanceData, "한자"),
      katsuyou: getBalanceValue(balanceData, "활용"),
      talk: getBalanceValue(balanceData, "회화"),
      review: getBalanceValue(balanceData, "복습"),
      streak: getBalanceValue(balanceData, "꾸준함"),
    }),
    [balanceData]
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

  const userPlan = profile?.plan || "free";
  const planTheme = getPlanTheme(userPlan);
  const progressColors = getPlanProgressColors(userPlan);

  const canWord = canAccess(
    userPlan,
    menuSettings.word_min_plan,
    menuSettings.show_word
  );
  const canKanji = canAccess(
    userPlan,
    menuSettings.kanji_min_plan,
    menuSettings.show_kanji
  );
  const canKatsuyou = canAccess(
    userPlan,
    menuSettings.katsuyou_min_plan,
    menuSettings.show_katsuyou
  );
  const canTalk = canAccess(
    userPlan,
    menuSettings.talk_min_plan,
    menuSettings.show_talk
  );
  const canMyPage = canAccess(
    userPlan,
    menuSettings.mypage_min_plan,
    menuSettings.show_mypage
  );

  const weakest = balanceSummary.weaknesses[0] || "";

  const recommendedMainHref =
    weakest === "회화" && canTalk
      ? "/talk"
      : weakest === "단어" && canWord
        ? "/word"
        : weakest === "한자" && canKanji
          ? "/kanji"
          : weakest === "활용" && canKatsuyou
            ? "/katsuyou"
            : weakest === "복습" && canMyPage
              ? canTalk
                ? "/mypage/wrong-talk"
                : canWord
                  ? "/mypage/wrong-word"
                  : canKanji
                    ? "/mypage/wrong-kanji"
                    : canKatsuyou
                      ? "/mypage/wrong-katsuyou"
                      : null
              : canTalk
                ? "/talk"
                : canWord
                  ? "/word"
                  : canKanji
                    ? "/kanji"
                    : canKatsuyou
                      ? "/katsuyou"
                      : null;

  const recommendedMainLabel =
    weakest === "회화" && canTalk
      ? "🗣️ 회화 시작"
      : weakest === "단어" && canWord
        ? "📝 단어 시작"
        : weakest === "한자" && canKanji
          ? "🈯 한자 시작"
          : weakest === "활용" && canKatsuyou
            ? "🔄 활용 시작"
            : weakest === "복습" && canMyPage
              ? "↪️ 오답 복습"
              : canTalk
                ? "🗣️ 회화 시작"
                : canWord
                  ? "📝 단어 시작"
                  : canKanji
                    ? "🈯 한자 시작"
                    : canKatsuyou
                      ? "🔄 활용 시작"
                      : null;

  const recommendedWrongHref = canMyPage
    ? canTalk
      ? "/mypage/wrong-talk"
      : canWord
        ? "/mypage/wrong-word"
        : canKanji
          ? "/mypage/wrong-kanji"
          : canKatsuyou
            ? "/mypage/wrong-katsuyou"
            : null
    : null;

  const recommendedWrongLabel = canMyPage
    ? canTalk
      ? "↪️ 반복오답 루틴"
      : canWord
        ? "↪️ 단어 오답 루틴"
        : canKanji
          ? "↪️ 한자 오답 루틴"
          : canKatsuyou
            ? "↪️ 활용 오답 루틴"
            : null;

  const recommendationText =
    stats.goalPercent >= 100
      ? "오늘 목표 달성! 내일도 1세트부터 가볍게 이어가요."
      : weakest === "회화"
        ? "오늘은 회화 1세트로 말문부터 가볍게 열어보세요."
        : weakest === "활용"
          ? "오늘은 활용 1세트로 문장 감각을 채워보세요."
          : weakest === "한자"
            ? "오늘은 한자 1세트로 읽기 감각을 보강해보세요."
            : weakest === "단어"
              ? "오늘은 단어 1세트로 기본 어휘를 단단히 다져보세요."
              : weakest === "복습"
                ? "오늘은 오답 복습부터 먼저 해보면 밸런스가 더 좋아집니다."
                : weakest === "꾸준함"
                  ? "오늘은 짧게라도 한 세트부터 시작해서 흐름을 이어가보세요."
                  : "오늘은 짧게라도 한 세트부터 시작해보세요.";

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mt-4">
          <p className="text-3xl font-bold">
            {profile?.full_name ? `${profile.full_name}님,` : "하테나일본어"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${planTheme.badge}`}
            >
              {getPlanBadge(userPlan)}
            </span>
          </div>

          <div
            className={`mt-4 inline-flex rounded-2xl border px-4 py-3 text-base font-medium ${planTheme.soft}`}
          >
            • {todayMessage}
          </div>

          <p className="mt-3 text-base text-gray-600">
            오늘의 밸런스를 보고, 필요한 루틴부터 이어가세요.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold">나의 일본어 밸런스</p>
              <p className="mt-2 text-sm text-gray-600">
                최근 학습 기록을 바탕으로 현재 상태를 한눈에 보여드려요.
              </p>
            </div>

            <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
              최근 30일 기준
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl bg-gray-50 p-3 sm:p-4">
              <div className="h-[340px] w-full sm:h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={balanceData} outerRadius="76%">
                    <PolarGrid stroke="#dbe1ea" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#374151", fontSize: 13, fontWeight: 700 }}
                    />
                    <Radar
                      dataKey="value"
                      stroke={progressColors.main}
                      strokeWidth={2.5}
                      fill={progressColors.main}
                      fillOpacity={0.24}
                      dot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: progressColors.main,
                        fill: "#ffffff",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-700">강점</p>
                  <p className="mt-1 text-base font-bold leading-6 text-gray-900">
                    {balanceSummary.strengths.join(", ")}
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-700">보완</p>
                  <p className="mt-1 text-base font-bold leading-6 text-gray-900">
                    {balanceSummary.weaknesses.join(", ")}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs font-semibold text-sky-700">
                  오늘의 한 줄 진단
                </p>
                <p className="mt-1 text-sm leading-6 text-gray-700">
                  {balanceSummary.weaknesses.join(", ")} 영역을 조금 더 보강하면
                  전체 흐름이 더 단단해집니다.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold text-gray-500">오늘 목표</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {stats.goalPercent}%
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {stats.todayCount}세트 / 목표 {goalSets}세트
                </p>

                <div className="mt-3 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.goalPercent}%`,
                      backgroundColor: progressColors.main,
                    }}
                  />
                </div>

                <div className="mt-4 inline-flex rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  🔥 연속 학습 {stats.streak}일
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">세부 점수</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800">
                    <span className="text-gray-500">단어</span>
                    <span className="font-bold text-gray-900">
                      {balanceScores.word}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800">
                    <span className="text-gray-500">한자</span>
                    <span className="font-bold text-gray-900">
                      {balanceScores.kanji}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800">
                    <span className="text-gray-500">활용</span>
                    <span className="font-bold text-gray-900">
                      {balanceScores.katsuyou}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800">
                    <span className="text-gray-500">회화</span>
                    <span className="font-bold text-gray-900">
                      {balanceScores.talk}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800">
                    <span className="text-gray-500">복습</span>
                    <span className="font-bold text-gray-900">
                      {balanceScores.review}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800">
                    <span className="text-gray-500">꾸준함</span>
                    <span className="font-bold text-gray-900">
                      {balanceScores.streak}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">이번 주 루틴</p>
            <p className="text-2xl font-semibold text-gray-500">
              {stats.activeDays7}/7일
            </p>
          </div>
          <p className="mt-2 text-lg text-gray-600">최근 7일 (오늘 포함)</p>

          <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-3">
            {stats.recent7Days.map((day, idx) => {
              const active = day.count > 0;
              const isToday = idx === stats.recent7Days.length - 1;

              return (
                <div key={day.key} className="text-center">
                  <div
                    className={
                      active
                        ? isToday
                          ? "h-6 rounded-full border border-blue-400 bg-blue-300"
                          : "h-6 rounded-full border border-blue-200 bg-blue-100"
                        : "h-6 rounded-full border border-gray-300 bg-white"
                    }
                  />
                  <p
                    className={`mt-3 text-sm ${
                      isToday ? "font-semibold text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {day.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {canWord ? (
            <div className="flex h-full flex-col rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-6 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold">📝 단어</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    기본 어휘를 문제와 패턴 카드로 익혀보세요.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{stats.wordCount}</p>
                  <p className="text-xs text-gray-500">학습 횟수</p>
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <div>
                  <p className="text-sm text-gray-500">평균 점수</p>
                  <p className="mt-1 text-2xl font-bold">{stats.wordAvg}%</p>
                </div>
                <a
                  href="/word"
                  className="shrink-0 rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                >
                  단어 시작
                </a>
              </div>
            </div>
          ) : null}

          {canKanji ? (
            <div className="flex h-full flex-col rounded-3xl border border-green-200 bg-gradient-to-r from-green-50 to-white p-6 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold">🈯 한자</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    레벨별 한자 문제를 풀며 읽기와 뜻을 익혀보세요.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{stats.kanjiCount}</p>
                  <p className="text-xs text-gray-500">학습 횟수</p>
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <div>
                  <p className="text-sm text-gray-500">평균 점수</p>
                  <p className="mt-1 text-2xl font-bold">{stats.kanjiAvg}%</p>
                </div>
                <a
                  href="/kanji"
                  className="shrink-0 rounded-2xl border border-green-200 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                >
                  한자 시작
                </a>
              </div>
            </div>
          ) : null}

          {canKatsuyou ? (
            <div className="flex h-full flex-col rounded-3xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-6 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold">🔄 활용</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    い형용사·な형용사·동사의 기본형을 문제로 익혀보세요.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{stats.katsuyouCount}</p>
                  <p className="text-xs text-gray-500">학습 횟수</p>
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <div>
                  <p className="text-sm text-gray-500">평균 점수</p>
                  <p className="mt-1 text-2xl font-bold">
                    {stats.katsuyouAvg}%
                  </p>
                </div>
                <a
                  href="/katsuyou"
                  className="shrink-0 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                >
                  활용 시작
                </a>
              </div>
            </div>
          ) : null}

          {canTalk ? (
            <div className="flex h-full flex-col rounded-3xl border border-purple-200 bg-gradient-to-r from-purple-50 to-white p-6 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold">🗣️ 회화</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    실제 대화형 문제로 말문을 자연스럽게 열어보세요.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{stats.talkCount}</p>
                  <p className="text-xs text-gray-500">학습 횟수</p>
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <div>
                  <p className="text-sm text-gray-500">평균 점수</p>
                  <p className="mt-1 text-2xl font-bold">{stats.talkAvg}%</p>
                </div>
                <a
                  href="/talk"
                  className="shrink-0 rounded-2xl border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                >
                  회화 시작
                </a>
              </div>
            </div>
          ) : null}
        </div>

        {recommendedMainHref || recommendedWrongHref ? (
          <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
            <p className="text-lg font-semibold">오늘의 추천 루틴</p>
            <p className="mt-2 text-sm text-gray-600">
              오늘 가장 필요한 루틴부터 가볍게 시작해보세요.
            </p>

            <div className="mt-5 rounded-2xl border border-gray-200 p-4">
              <p className="text-base font-medium">{recommendationText}</p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recommendedMainHref && recommendedMainLabel ? (
                <a
                  href={recommendedMainHref}
                  className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-gray-900 px-5 py-4 text-center text-base font-semibold text-white"
                >
                  {recommendedMainLabel}
                </a>
              ) : null}

              {recommendedWrongHref && recommendedWrongLabel ? (
                <a
                  href={recommendedWrongHref}
                  className="inline-flex min-h-[56px] items-center justify-center rounded-2xl border border-gray-300 px-5 py-4 text-center text-base font-semibold text-gray-900"
                >
                  {recommendedWrongLabel}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {canMyPage ? (
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
              <div className="min-h-[108px] rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">총 학습 횟수</p>
                <p className="mt-2 text-2xl font-bold">
                  {stats.totalAttempts}
                </p>
              </div>
              <div className="min-h-[108px] rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">총 오답 수</p>
                <p className="mt-2 text-2xl font-bold">{stats.totalWrong}</p>
              </div>
              <div className="min-h-[108px] rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">단어 + 한자 + 활용</p>
                <p className="mt-2 text-2xl font-bold">
                  {stats.wordCount + stats.kanjiCount + stats.katsuyouCount}
                </p>
              </div>
              <div className="min-h-[108px] rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">회화</p>
                <p className="mt-2 text-2xl font-bold">{stats.talkCount}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-10 rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
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
                <div className="h-3 rounded-full bg-white">
                  <div
                    className="h-3 rounded-full bg-blue-300"
                    style={{ width: `${item.widthPct}%` }}
                  />
                </div>
                <p className="text-right text-sm text-gray-600">{item.count}</p>
              </div>
            ))}
          </div>
        </div>

        {showCoursesSection ? (
          <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">강의 카탈로그</p>
                <p className="mt-2 text-sm text-gray-600">
                  지금 열려 있는 강의를 한눈에 보고, 원하는 강의를 골라
                  들어가 보세요.
                </p>
              </div>

              <a
                href="/courses"
                className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
              >
                전체 강의 보기
              </a>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-base font-medium text-gray-900">
                입문 강의부터 패턴, 회화, 실전 강의까지 카탈로그형으로 정리해
                두었습니다.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                아직 수강 등록 전이어도 어떤 강의가 있는지 먼저 둘러볼 수
                있습니다.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href="/courses"
                className="rounded-2xl bg-black px-5 py-4 text-center text-base font-semibold text-white"
              >
                📚 강의 카탈로그 보기
              </a>
              <a
                href="/classroom"
                className="rounded-2xl border border-gray-300 px-5 py-4 text-center text-base font-semibold text-gray-900"
              >
                🎓 나의 강의실로 이동
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}