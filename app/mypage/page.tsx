"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchAllAttempts,
  fetchRecentAttempts,
  type QuizAttemptRow,
} from "@/lib/attempts";
import {
  isKanjiAttempt,
  isTalkAttempt,
  isWordAttempt,
  detectAppKind,
  getAppLabelFromPosMode,
} from "@/lib/labels";

type MyProfile = {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  is_admin: boolean;
};

type MainTabKey = "wrong" | "history" | "message" | "notice";
type WrongAppKey = "word" | "kanji" | "talk";
type WrongFilterKey = "all" | "word" | "kanji" | "talk";

type DayStat = {
  label: string;
  total: number;
  word: number;
  kanji: number;
  talk: number;
};

function calcAveragePercent(attempts: QuizAttemptRow[]): number {
  if (attempts.length === 0) return 0;

  const valid = attempts.filter((item) => Number(item.quiz_len || 0) > 0);
  if (valid.length === 0) return 0;

  return Math.round(
    valid.reduce((sum, item) => {
      const quizLen = Number(item.quiz_len || 0);
      const score = Number(item.score || 0);
      return sum + (score / quizLen) * 100;
    }, 0) / valid.length
  );
}

function formatDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildLast7Days(attempts: QuizAttemptRow[]): DayStat[] {
  const today = new Date();
  const map = new Map<string, DayStat>();

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(today.getDate() - i);

    const key = formatDayKey(d);
    const labels = ["일", "월", "화", "수", "목", "금", "토"];
    map.set(key, {
      label: labels[d.getDay()],
      total: 0,
      word: 0,
      kanji: 0,
      talk: 0,
    });
  }

  attempts.forEach((item) => {
    const d = parseDate(item.created_at);
    if (!d) return;

    const key = formatDayKey(d);
    const bucket = map.get(key);
    if (!bucket) return;

    bucket.total += 1;
    if (isWordAttempt(item.pos_mode)) bucket.word += 1;
    if (isKanjiAttempt(item.pos_mode)) bucket.kanji += 1;
    if (isTalkAttempt(item.pos_mode)) bucket.talk += 1;
  });

  return Array.from(map.values());
}

function calcStreak(last7: DayStat[]) {
  let streak = 0;
  for (let i = last7.length - 1; i >= 0; i -= 1) {
    if (last7[i].total > 0) streak += 1;
    else break;
  }
  return streak;
}

function getTopWrongType(attempts: QuizAttemptRow[]) {
  const counts = {
    word: 0,
    kanji: 0,
    talk: 0,
  };

  attempts.forEach((item) => {
    const wrong = Number(item.wrong_count || 0);
    const kind = detectAppKind(item.pos_mode);
    if (kind === "word") counts.word += wrong;
    if (kind === "kanji") counts.kanji += wrong;
    if (kind === "talk") counts.talk += wrong;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = entries[0];

  if (!top || top[1] === 0) return "-";
  if (top[0] === "word") return "단어";
  if (top[0] === "kanji") return "한자";
  return "회화";
}

function calcThisWeekCount(last7: DayStat[]) {
  return last7.reduce((sum, item) => sum + item.total, 0);
}

function calcThisMonthCount(attempts: QuizAttemptRow[]) {
  const now = new Date();
  return attempts.filter((item) => {
    const d = parseDate(item.created_at);
    if (!d) return false;
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

function calcProgressPercent(thisWeekCount: number, target = 20) {
  return Math.min(100, Math.round((thisWeekCount / target) * 100));
}

export default function MyPage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<QuizAttemptRow[]>([]);
  const [allAttempts, setAllAttempts] = useState<QuizAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [mainTab, setMainTab] = useState<MainTabKey>("wrong");
  const [wrongApp, setWrongApp] = useState<WrongAppKey>("word");
  const [wrongCount, setWrongCount] = useState("10");
  const [searchText, setSearchText] = useState("");
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [wrongFilter, setWrongFilter] = useState<WrongFilterKey>("all");

  useEffect(() => {
    const loadMyPage = async () => {
      setLoading(true);
      setErrorMsg("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error(userError);
          setErrorMsg("사용자 정보를 불러오지 못했습니다.");
          setLoading(false);
          return;
        }

        if (!user) {
          setErrorMsg("로그인이 필요합니다.");
          setLoading(false);
          return;
        }

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

        const googleName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.user_name ||
          "";

        setProfile({
          id: user.id,
          email: user.email ?? "",
          full_name: profileRow?.full_name || googleName || "",
          plan: String(profileRow?.plan || "FREE").toUpperCase(),
          is_admin: Boolean(profileRow?.is_admin),
        });

        const recent = await fetchRecentAttempts(user.id, 12);
        const all = await fetchAllAttempts(user.id, 300);

        setRecentAttempts(recent);
        setAllAttempts(all);
      } catch (error) {
        console.error(error);
        setErrorMsg("마이페이지 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void loadMyPage();
  }, []);

  const stats = useMemo(() => {
    const talkAttempts = allAttempts.filter((item) => isTalkAttempt(item.pos_mode));
    const wordAttempts = allAttempts.filter((item) => isWordAttempt(item.pos_mode));
    const kanjiAttempts = allAttempts.filter((item) => isKanjiAttempt(item.pos_mode));

    const totalAttempts = allAttempts.length;
    const totalWrong = allAttempts.reduce(
      (sum, item) => sum + Number(item.wrong_count || 0),
      0
    );

    const last7 = buildLast7Days(allAttempts);
    const streak = calcStreak(last7);
    const thisWeekCount = calcThisWeekCount(last7);
    const thisMonthCount = calcThisMonthCount(allAttempts);
    const progressPercent = calcProgressPercent(thisWeekCount, 20);
    const topWrongType = getTopWrongType(allAttempts);

    return {
      totalAttempts,
      totalWrong,
      talkCount: talkAttempts.length,
      talkAverage: calcAveragePercent(talkAttempts),
      wordCount: wordAttempts.length,
      wordAverage: calcAveragePercent(wordAttempts),
      kanjiCount: kanjiAttempts.length,
      kanjiAverage: calcAveragePercent(kanjiAttempts),
      last7,
      streak,
      thisWeekCount,
      thisMonthCount,
      progressPercent,
      topWrongType,
    };
  }, [allAttempts]);

  const filteredRecent = useMemo(() => {
    let base = recentAttempts;

    if (wrongFilter === "word") {
      base = base.filter((item) => isWordAttempt(item.pos_mode));
    } else if (wrongFilter === "kanji") {
      base = base.filter((item) => isKanjiAttempt(item.pos_mode));
    } else if (wrongFilter === "talk") {
      base = base.filter((item) => isTalkAttempt(item.pos_mode));
    }

    const q = searchText.trim().toLowerCase();
    if (!q) return base;

    return base.filter((item) => {
      const joined = [
        item.pos_mode || "",
        item.level || "",
        String(item.score || ""),
        String(item.quiz_len || ""),
        String(item.wrong_count || ""),
      ]
        .join(" ")
        .toLowerCase();

      return joined.includes(q);
    });
  }, [recentAttempts, wrongFilter, searchText]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handleWrongExamStart = () => {
    if (wrongApp === "word") {
      window.location.href = "/mypage/wrong-word";
      return;
    }
    if (wrongApp === "kanji") {
      window.location.href = "/mypage/wrong-kanji";
      return;
    }
    window.location.href = "/mypage/wrong-talk";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-sm text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-sm text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mt-4 rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-medium">
          ✨ {profile?.plan === "PRO" ? "PRO 이용 중입니다" : "FREE 이용 중입니다"}
        </div>

        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
                  は
                </div>
                <div>
                  <h1 className="text-2xl font-bold">하테나일본어 · 마이페이지</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    핵심은 위에, 상세는 아래에서 빠르게 확인하세요.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href="/"
                className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-800"
              >
                🏠 홈
              </a>
              <button
                onClick={handleLogout}
                className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-800"
              >
                🚪 로그아웃
              </button>
            </div>
          </div>

          <div className="mt-6">
            <div className="h-3 rounded-full bg-gray-100">
              <div
                className="h-3 rounded-full bg-blue-500"
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                이번 달 {stats.thisMonthCount}/20회
              </div>
              <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                {stats.progressPercent}% 진행
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-4xl font-bold">{stats.streak}</p>
            <p className="mt-2 text-lg font-semibold text-gray-700">연속 학습일</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-4xl font-bold">{stats.thisWeekCount}</p>
            <p className="mt-2 text-lg font-semibold text-gray-700">이번 주 풀이수</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-4xl font-bold">{stats.topWrongType}</p>
            <p className="mt-2 text-lg font-semibold text-gray-700">최다 오답 유형</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-4xl font-bold">{stats.totalWrong}</p>
            <p className="mt-2 text-lg font-semibold text-gray-700">오답</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-4xl font-bold">
              {stats.totalAttempts === 0
                ? "0%"
                : `${Math.round(
                    ((stats.totalAttempts * 10 - stats.totalWrong) /
                      Math.max(stats.totalAttempts * 10, 1)) *
                      100
                  )}%`}
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-700">평균 정답률</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-4xl font-bold">
              {stats.last7.reduce((sum, day) => sum + (day.total > 0 ? 1 : 0), 0)}
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-700">최근 7일 학습</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">최근 7일 학습</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">
                총 {stats.thisWeekCount}회
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">
                단어 {stats.wordCount}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">
                한자 {stats.kanjiCount}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">
                회화 {stats.talkCount}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">
                연속 {stats.streak}일
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-7">
            {stats.last7.map((day, idx) => (
              <div
                key={`${day.label}-${idx}`}
                className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center"
              >
                <p className="text-lg font-bold">{day.label}</p>
                <p className="mt-3 text-3xl font-bold">{idx + 1}</p>
                <p className="mt-2 text-sm font-semibold text-gray-700">{day.total}회</p>
                <div className="mt-3 text-sm text-gray-600">
                  <p>단어 {day.word}</p>
                  <p>한자 {day.kanji}</p>
                  <p>회화 {day.talk}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-blue-50 p-5">
          <p className="text-lg font-semibold text-blue-900">
            🔥 반복 오답이 쌓였어요. 오늘은 TOP10 복습부터 가볍게 정리해볼까요?
          </p>
        </div>

        <button
          onClick={() => {
            setMainTab("wrong");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="mt-4 w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 text-lg font-semibold text-gray-800"
        >
          🔥 TOP10 복습 시작
        </button>

        <div className="mt-8 border-b border-gray-200">
          <div className="flex flex-wrap gap-6">
            <button
              onClick={() => setMainTab("wrong")}
              className={
                mainTab === "wrong"
                  ? "border-b-2 border-red-500 pb-3 text-lg font-semibold text-red-500"
                  : "pb-3 text-lg font-semibold text-gray-500"
              }
            >
              📚 오답
            </button>
            <button
              onClick={() => setMainTab("history")}
              className={
                mainTab === "history"
                  ? "border-b-2 border-red-500 pb-3 text-lg font-semibold text-red-500"
                  : "pb-3 text-lg font-semibold text-gray-500"
              }
            >
              📈 기록
            </button>
            <button
              onClick={() => setMainTab("message")}
              className={
                mainTab === "message"
                  ? "border-b-2 border-red-500 pb-3 text-lg font-semibold text-red-500"
                  : "pb-3 text-lg font-semibold text-gray-500"
              }
            >
              💌 메시지
            </button>
            <button
              onClick={() => setMainTab("notice")}
              className={
                mainTab === "notice"
                  ? "border-b-2 border-red-500 pb-3 text-lg font-semibold text-red-500"
                  : "pb-3 text-lg font-semibold text-gray-500"
              }
            >
              🔔 알림
            </button>
          </div>
        </div>

        {mainTab === "wrong" ? (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold">📚 오답</h2>
            <p className="mt-2 text-sm text-gray-500">
              앱 선택 + 검색 + 반복오답 토글 + 점검 목록.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
              <div>
                <p className="text-sm font-semibold text-gray-700">오답으로 시험보기</p>
                <div className="mt-3 flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="radio"
                      name="wrong-app"
                      checked={wrongApp === "word"}
                      onChange={() => setWrongApp("word")}
                    />
                    단어
                  </label>
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="radio"
                      name="wrong-app"
                      checked={wrongApp === "kanji"}
                      onChange={() => setWrongApp("kanji")}
                    />
                    한자
                  </label>
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="radio"
                      name="wrong-app"
                      checked={wrongApp === "talk"}
                      onChange={() => setWrongApp("talk")}
                    />
                    회화
                  </label>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700">문항 수</p>
                <select
                  value={wrongCount}
                  onChange={(e) => setWrongCount(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="30">30</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleWrongExamStart}
              className="mt-5 w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 text-lg font-semibold text-gray-800"
            >
              📝 오답으로 시험보기
            </button>

            <div className="mt-6">
              <label className="text-sm font-semibold text-gray-700">
                검색 (단어/뜻/발음)
              </label>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3"
                placeholder="검색어를 입력하세요."
              />
            </div>

            <label className="mt-5 flex items-center gap-3 text-base font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={repeatOnly}
                onChange={(e) => setRepeatOnly(e.target.checked)}
              />
              🔥 반복 오답만 보기 (3회+)
            </label>

            <div className="mt-5 grid grid-cols-4 gap-3">
              <button
                onClick={() => setWrongFilter("all")}
                className={
                  wrongFilter === "all"
                    ? "rounded-2xl bg-red-500 px-4 py-3 text-base font-semibold text-white"
                    : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-800"
                }
              >
                전체
              </button>
              <button
                onClick={() => setWrongFilter("word")}
                className={
                  wrongFilter === "word"
                    ? "rounded-2xl bg-red-500 px-4 py-3 text-base font-semibold text-white"
                    : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-800"
                }
              >
                단어
              </button>
              <button
                onClick={() => setWrongFilter("kanji")}
                className={
                  wrongFilter === "kanji"
                    ? "rounded-2xl bg-red-500 px-4 py-3 text-base font-semibold text-white"
                    : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-800"
                }
              >
                한자
              </button>
              <button
                onClick={() => setWrongFilter("talk")}
                className={
                  wrongFilter === "talk"
                    ? "rounded-2xl bg-red-500 px-4 py-3 text-base font-semibold text-white"
                    : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-800"
                }
              >
                회화
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {filteredRecent.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 p-5 text-sm text-gray-500">
                  표시할 기록이 없습니다.
                </div>
              ) : (
                filteredRecent.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-200 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {getAppLabelFromPosMode(item.pos_mode)}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {item.pos_mode || "-"}
                        </p>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>{item.level || "-"}</p>
                        <p>{item.created_at ? new Date(item.created_at).toLocaleString("ko-KR") : "-"}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-xl bg-gray-50 p-3">
                        점수 {Number(item.score || 0)} / {Number(item.quiz_len || 0)}
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        오답 {Number(item.wrong_count || 0)}
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        앱 {getAppLabelFromPosMode(item.pos_mode)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {mainTab === "history" ? (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold">📈 기록</h2>
            <p className="mt-3 text-sm text-gray-500">
              최근 학습 기록을 더 자세히 보여주는 영역입니다.
            </p>

            <div className="mt-6 space-y-3">
              {recentAttempts.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {item.pos_mode || "-"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    레벨: {item.level || "-"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    점수: {Number(item.score || 0)} / {Number(item.quiz_len || 0)}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    오답 수: {Number(item.wrong_count || 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {mainTab === "message" ? (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold">💌 메시지</h2>
            <p className="mt-3 text-sm text-gray-500">
              추후 학습 독려 메시지, 코치 피드백 등을 모아볼 영역입니다.
            </p>
          </div>
        ) : null}

        {mainTab === "notice" ? (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold">🔔 알림</h2>
            <p className="mt-3 text-sm text-gray-500">
              추후 공지, 업데이트, 학습 알림 등을 보여줄 영역입니다.
            </p>
          </div>
        ) : null}

        <button
          onClick={handleLogout}
          className="mt-8 w-full rounded-2xl bg-black px-5 py-4 text-lg font-semibold text-white"
        >
          로그아웃
        </button>
      </div>
    </main>
  );
}