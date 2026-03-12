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
import {
  getPlanBadge,
  getPlanTheme,
  hasPlan,
  normalizePlan,
  type PlanCode,
} from "@/lib/plans";
import {
  buildBalanceData,
  buildSuggestedRoutines,
  calcGoalPercent,
  getBalanceValue,
  getTodayMessage,
  pickStrengthWeakness,
  type DayBucket,
  type HomeDashboardSummary,
  type WrongSummary,
} from "@/lib/home-dashboard";
import { markHomeSeenToday } from "@/lib/home-gate";

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

function canAccess(
  userPlan: string | null | undefined,
  minPlan: PlanCode,
  show: boolean
): boolean {
  if (!show) return false;
  return hasPlan(userPlan, minPlan);
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

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [dashboard, setDashboard] = useState<HomeDashboardSummary | null>(null);
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
  const [nextHref, setNextHref] = useState("");

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
          daily_goal_sets: Math.max(
            1,
            Number(profileRow?.daily_goal_sets || 3)
          ),
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

        const { data: dashboardData, error: dashboardError } = await supabase.rpc(
          "get_home_dashboard_summary",
          { p_user_id: user.id }
        );

        if (dashboardError) {
          console.error(dashboardError);
          setErrorMsg("홈 통계를 불러오지 못했습니다.");
          setLoading(false);
          return;
        }

        setDashboard(dashboardData as HomeDashboardSummary);
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

  useEffect(() => {
    if (!loading && !errorMsg) {
      markHomeSeenToday();
    }
  }, [loading, errorMsg]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setNextHref(params.get("next") || "");
  }, []);

  const goalSets = Math.max(1, Number(profile?.daily_goal_sets || 3));

  const stats = useMemo(() => {
    const safeDashboard = dashboard ?? {
      totalAttempts: 0,
      totalWrong: 0,
      wordCount: 0,
      kanjiCount: 0,
      katsuyouCount: 0,
      talkCount: 0,
      wordAvg: 0,
      kanjiAvg: 0,
      katsuyouAvg: 0,
      talkAvg: 0,
      recent7Days: [] as DayBucket[],
      streak: 0,
      todayCount: 0,
      activeDays7: 0,
      levelProgress: [] as Array<{ level: string; count: number }>,
      weightedWordWrong: 0,
      weightedKanjiWrong: 0,
      weightedKatsuyouWrong: 0,
      weightedTalkWrong: 0,
    };

    const maxLevelCount = Math.max(
      ...(safeDashboard.levelProgress || []).map((item) =>
        Number(item.count || 0)
      ),
      1
    );

    return {
      totalAttempts: Number(safeDashboard.totalAttempts || 0),
      totalWrong: Number(safeDashboard.totalWrong || 0),
      wordCount: Number(safeDashboard.wordCount || 0),
      kanjiCount: Number(safeDashboard.kanjiCount || 0),
      katsuyouCount: Number(safeDashboard.katsuyouCount || 0),
      talkCount: Number(safeDashboard.talkCount || 0),
      wordAvg: Number(safeDashboard.wordAvg || 0),
      kanjiAvg: Number(safeDashboard.kanjiAvg || 0),
      katsuyouAvg: Number(safeDashboard.katsuyouAvg || 0),
      talkAvg: Number(safeDashboard.talkAvg || 0),
      recent7Days: (safeDashboard.recent7Days || []).map((item) => ({
        key: item.key,
        label: item.label,
        count: Number(item.count || 0),
      })),
      streak: Number(safeDashboard.streak || 0),
      todayCount: Number(safeDashboard.todayCount || 0),
      goalPercent: calcGoalPercent(
        Number(safeDashboard.todayCount || 0),
        goalSets
      ),
      levelProgress: (safeDashboard.levelProgress || []).map((item) => ({
        level: item.level,
        count: Number(item.count || 0),
        widthPct: Math.round(
          ((Number(item.count || 0) || 0) / maxLevelCount) * 100
        ),
      })),
      activeDays7: Number(safeDashboard.activeDays7 || 0),
    };
  }, [dashboard, goalSets]);

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
        activeDays7: stats.activeDays7,
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
      stats.activeDays7,
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

  const wrongSummary = useMemo<WrongSummary>(() => {
    const safeDashboard = dashboard ?? {
      weightedWordWrong: 0,
      weightedKanjiWrong: 0,
      weightedKatsuyouWrong: 0,
      weightedTalkWrong: 0,
    };

    const weightedWordWrong = Number(safeDashboard.weightedWordWrong || 0);
    const weightedKanjiWrong = Number(safeDashboard.weightedKanjiWrong || 0);
    const weightedKatsuyouWrong = Number(
      safeDashboard.weightedKatsuyouWrong || 0
    );
    const weightedTalkWrong = Number(safeDashboard.weightedTalkWrong || 0);

    const pairs = [
      { kind: "word" as const, value: weightedWordWrong },
      { kind: "kanji" as const, value: weightedKanjiWrong },
      { kind: "katsuyou" as const, value: weightedKatsuyouWrong },
      { kind: "talk" as const, value: weightedTalkWrong },
    ].sort((a, b) => b.value - a.value);

    return {
      weightedWordWrong,
      weightedKanjiWrong,
      weightedKatsuyouWrong,
      weightedTalkWrong,
      topWrongKind: pairs[0].value > 0 ? pairs[0].kind : null,
    };
  }, [dashboard]);

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

  const isEmptyUser = stats.totalAttempts === 0;
  const isLightDataUser = stats.totalAttempts > 0 && stats.totalAttempts < 5;
  const isDormantWeek = stats.activeDays7 === 0;

  const untouchedAreas: string[] = [];
  if (canWord && stats.wordCount === 0) untouchedAreas.push("단어");
  if (canKanji && stats.kanjiCount === 0) untouchedAreas.push("한자");
  if (canKatsuyou && stats.katsuyouCount === 0) untouchedAreas.push("활용");
  if (canTalk && stats.talkCount === 0) untouchedAreas.push("회화");

  const weakest = balanceSummary.weaknesses[0] || "";

  const suggestedRoutines = useMemo(
    () =>
      buildSuggestedRoutines({
        isEmptyUser,
        isDormantWeek,
        canWord,
        canKanji,
        canKatsuyou,
        canTalk,
        canMyPage,
        weakest,
        untouchedAreas,
        topWrongKind: wrongSummary.topWrongKind,
      }),
    [
      isEmptyUser,
      isDormantWeek,
      canWord,
      canKanji,
      canKatsuyou,
      canTalk,
      canMyPage,
      weakest,
      untouchedAreas,
      wrongSummary.topWrongKind,
    ]
  );

  const recommendationText = isEmptyUser
    ? "아직 학습 기록이 없어요. 오늘은 첫 루틴 하나만 가볍게 시작해보세요."
    : isDormantWeek
      ? "이번 주는 잠시 쉬었네요. 오늘 한 세트부터 다시 시작해볼까요?"
      : weakest === "복습"
        ? "오늘은 새 문제보다 복습부터 해보면 더 효과적입니다."
        : "오늘 가장 필요한 루틴부터 가볍게 시작해보세요.";

  const balanceSupportText = isEmptyUser
    ? "아직 학습 기록이 없어요. 단어, 한자, 회화 중 하나부터 시작하면 밸런스가 채워집니다."
    : isLightDataUser
      ? untouchedAreas.length > 0
        ? `${untouchedAreas.join(", ")} 영역의 데이터가 아직 적어요. 몇 세트만 더 쌓이면 밸런스가 더 정확해집니다.`
        : "아직 데이터가 많지 않아요. 몇 세트만 더 쌓이면 밸런스가 더 정확해집니다."
      : `${balanceSummary.weaknesses.join(", ")} 영역을 조금 더 보강하면 전체 흐름이 더 단단해집니다.`;

  const strengthLabel = isEmptyUser ? "시작 전" : "강점";
  const strengthValue = isEmptyUser
    ? "첫 루틴을 시작해보세요"
    : balanceSummary.strengths.join(", ");

  const weaknessLabel = isEmptyUser ? "추천 시작" : "보완";
  const weaknessValue = isEmptyUser
    ? canWord
      ? "단어, 회화"
      : canTalk
        ? "회화, 한자"
        : "가벼운 루틴부터"
    : isLightDataUser && untouchedAreas.length > 0
      ? untouchedAreas.slice(0, 2).join(", ")
      : balanceSummary.weaknesses.join(", ");

  const weeklySupportText = isDormantWeek
    ? "이번 주는 아직 조용하네요. 오늘 한 세트부터 다시 시작해볼까요?"
    : stats.activeDays7 <= 2
      ? "루틴은 짧게라도 이어가는 게 중요해요."
      : "좋아요. 최근 루틴이 조금씩 이어지고 있어요.";

  const nextLabel = useMemo(() => {
    if (!nextHref) return "";

    if (nextHref.startsWith("/talk")) return "🗣️ 회화 이어서 하기";
    if (nextHref.startsWith("/word")) return "📝 단어 이어서 하기";
    if (nextHref.startsWith("/kanji")) return "🈯 한자 이어서 하기";
    if (nextHref.startsWith("/katsuyou")) return "🔄 활용 이어서 하기";
    if (nextHref.startsWith("/mypage")) return "📊 MY 이어서 보기";
    if (nextHref.startsWith("/classroom")) return "🎓 강의실 이어서 가기";
    if (nextHref.startsWith("/courses")) return "📚 강의 카탈로그 보기";

    return "이전 학습 이어서 하기";
  }, [nextHref]);

  const nextDesc = useMemo(() => {
    if (!nextHref) return "";

    if (nextHref.startsWith("/talk")) {
      return "하던 회화 문제로 바로 돌아가 이어서 학습할 수 있어요.";
    }
    if (nextHref.startsWith("/word")) {
      return "하던 단어 학습 세트로 바로 돌아갈 수 있어요.";
    }
    if (nextHref.startsWith("/kanji")) {
      return "하던 한자 학습 세트로 바로 돌아갈 수 있어요.";
    }
    if (nextHref.startsWith("/katsuyou")) {
      return "하던 활용 학습 세트로 바로 돌아갈 수 있어요.";
    }

    return "방금 보던 학습 흐름으로 바로 돌아갑니다.";
  }, [nextHref]);

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

          {nextHref ? (
            <div className="mt-5 rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-700">
                    이어가던 학습이 있어요
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {nextLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {nextDesc}
                  </p>
                </div>

                <a
                  href={nextHref}
                  className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  바로 이어가기
                </a>
              </div>
            </div>
          ) : null}
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
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      fill="#2563EB"
                      fillOpacity={0.24}
                      dot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "#2563EB",
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
                  <p className="text-xs font-semibold text-emerald-700">
                    {strengthLabel}
                  </p>
                  <p className="mt-1 text-base font-bold leading-6 text-gray-900">
                    {strengthValue}
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-700">
                    {weaknessLabel}
                  </p>
                  <p className="mt-1 text-base font-bold leading-6 text-gray-900">
                    {weaknessValue}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs font-semibold text-sky-700">
                  오늘의 한 줄 진단
                </p>
                <p className="mt-1 text-sm leading-6 text-gray-700">
                  {balanceSupportText}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
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

        <div className="mt-10 grid grid-cols-1 gap-6">
          <div className="flex flex-col items-center">
            <div
              className="flex h-44 w-44 items-center justify-center rounded-full shadow-sm"
              style={{
                background: `conic-gradient(${progressColors.main} ${
                  (stats.goalPercent / 100) * 360
                }deg, ${progressColors.rest} 0deg)`,
              }}
            >
              <div className="flex h-30 w-30 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                <p className="text-3xl font-bold">{stats.goalPercent}%</p>
                <p className="mt-1 text-sm text-gray-600">오늘 목표</p>
                <p className="mt-1 text-xs text-gray-500">{goalSets}세트 기준</p>
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
                      isToday
                        ? "font-semibold text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    {day.label}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {weeklySupportText}
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
        
        {suggestedRoutines.length > 0 ? (
          <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
            <p className="text-lg font-semibold">오늘의 추천 루틴</p>
            <p className="mt-2 text-sm text-gray-600">{recommendationText}</p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {suggestedRoutines.map((routine, idx) => {
                const isPrimary = idx === 0 || routine.variant === "primary";

                return (
                  <a
                    key={`${routine.title}-${routine.href}`}
                    href={routine.href ?? "#"}
                    className={
                      isPrimary
                        ? "rounded-2xl bg-gray-900 px-5 py-4 text-left text-white"
                        : "rounded-2xl border border-gray-300 px-5 py-4 text-left text-gray-900"
                    }
                  >
                    <div className="flex min-h-[56px] flex-col justify-center">
                      <p className="text-base font-semibold">{routine.title}</p>
                      <p
                        className={`mt-1 text-sm leading-6 ${
                          isPrimary ? "text-gray-200" : "text-gray-600"
                        }`}
                      >
                        {routine.desc}
                      </p>
                    </div>
                  </a>
                );
              })}
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