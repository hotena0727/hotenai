"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribePush,
  syncExistingPushSubscription,
  unsubscribePush,
} from "@/lib/push";
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
  getPrettyPosModeLabel,
} from "@/lib/labels";

type MyProfile = {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  is_admin: boolean;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
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

type NoticeStatus = {
  supported: boolean;
  permission: "default" | "granted" | "denied" | "unknown";
  subscribed: boolean;
  serviceWorkerReady: boolean;
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

function formatRelativeMessageTime(value?: string | null) {
  const d = parseDate(value ?? undefined);
  if (!d) return "방금 업데이트";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 1) return "방금 도착";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}시간 전`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const sameYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (sameDay) {
    return `오늘 ${d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  if (sameYesterday) {
    return `어제 ${d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDateOnly(value?: string | null) {
  const d = parseDate(value ?? undefined);
  if (!d) return "-";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

function withFullIfMissing(posMode?: string): string {
  const label = getPrettyPosModeLabel(posMode);
  const parts = String(label || "")
    .split("·")
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.length === 2) {
    return `${parts[0]} · ${parts[1]} · 전체`;
  }


  if (parts.length >= 3 && parts[0] === "회화" && !parts[2]) {
    return `${parts[0]} · ${parts[1]} · 전체`;
  }

  return label;
}

function prettyAttemptLabel(posMode?: string): string {
  const raw = String(posMode || "").trim();

  return raw
    .replace(/\breading\b/g, "발음")
    .replace(/\bmeaning\b/g, "뜻")
    .replace(/\bkr2jp\b/g, "한→일")
    .replace(/\bnoun\b/g, "명사")
    .replace(/\bverb\b/g, "동사")
    .replace(/\badj_i\b/g, "い형용사")
    .replace(/\badj_na\b/g, "な형용사")
    .replace(/\badverb\b/g, "부사")
    .replace(/\bparticle\b/g, "조사")
    .replace(/\bconjunction\b/g, "접속사")
    .replace(/\binterjection\b/g, "감탄사");
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

  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  const [noticeRefreshing, setNoticeRefreshing] = useState(false);
  const [noticeEnabling, setNoticeEnabling] = useState(false);
  const [noticeDisabling, setNoticeDisabling] = useState(false);
  const [noticeTesting, setNoticeTesting] = useState(false);
  const [noticeError, setNoticeError] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeStatus, setNoticeStatus] = useState<NoticeStatus>({
    supported: false,
    permission: "unknown",
    subscribed: false,
    serviceWorkerReady: false,
  });

  useEffect(() => {
    const loadMyPage = async () => {
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

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, plan, is_admin, plan_started_at, plan_expires_at")
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
          plan_started_at: profileRow?.plan_started_at ?? null,
          plan_expires_at: profileRow?.plan_expires_at ?? null,
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

  const refreshNoticeStatus = async () => {
    try {
      setNoticeRefreshing(true);
      setNoticeError("");

      const supported = await isPushSupported();

      if (!supported) {
        setNoticeStatus({
          supported: false,
          permission: "unknown",
          subscribed: false,
          serviceWorkerReady: false,
        });
        return;
      }

      const permission =
        typeof Notification !== "undefined"
          ? (Notification.permission as "default" | "granted" | "denied")
          : "unknown";

      const sub = await getCurrentPushSubscription();

      setNoticeStatus({
        supported: true,
        permission,
        subscribed: !!sub,
        serviceWorkerReady: true,
      });

      if (sub) {
        await syncExistingPushSubscription();
      }
    } catch (error) {
      console.error(error);
      setNoticeError("알림 상태를 확인하지 못했습니다.");
    } finally {
      setNoticeRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshNoticeStatus();
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

    if (repeatOnly) {
      base = base.filter((item) => Number(item.wrong_count || 0) >= 3);
    }

    const q = searchText.trim().toLowerCase();
    if (!q) return base;

    return base.filter((item) => {
      const joined = [
        item.pos_mode || "",
        withFullIfMissing(item.pos_mode),
        item.level || "",
        String(item.score || ""),
        String(item.quiz_len || ""),
        String(item.wrong_count || ""),
      ]
        .join(" ")
        .toLowerCase();

      return joined.includes(q);
    });
  }, [recentAttempts, wrongFilter, searchText, repeatOnly]);

  const handleEnableNotice = async () => {
    try {
      setNoticeEnabling(true);
      setNoticeError("");
      setNoticeMessage("");

      const result = await subscribePush();

      if (!result.ok) {
        setNoticeError(result.error);
        await refreshNoticeStatus();
        return;
      }

      setNoticeMessage(
        result.mode === "new"
          ? "알림이 이 브라우저에 연결되었습니다."
          : "기존 알림 연결을 다시 확인했습니다."
      );

      await refreshNoticeStatus();
    } catch (error) {
      console.error("[mypage] handleEnableNotice error =", error);
      setNoticeError("알림 연결에 실패했습니다.");
    } finally {
      setNoticeEnabling(false);
    }
  };

  const handleDisableNotice = async () => {
    try {
      setNoticeDisabling(true);
      setNoticeError("");
      setNoticeMessage("");

      const result = await unsubscribePush();

      if (!result.ok) {
        setNoticeError(result.error);
        await refreshNoticeStatus();
        return;
      }

      setNoticeMessage("이 브라우저의 알림 연결을 해제했습니다.");
      await refreshNoticeStatus();
    } catch (error) {
      console.error(error);
      setNoticeError("알림 구독 해제에 실패했습니다.");
    } finally {
      setNoticeDisabling(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      setNoticeTesting(true);
      setNoticeError("");
      setNoticeMessage("");

      const res = await fetch("/api/push-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "하테나 테스트",
          body: "실제 웹 푸시 테스트입니다.",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(String(data?.error || "테스트 푸시 발송 실패"));
      }

      setNoticeMessage(`테스트 푸시를 보냈습니다. (${data.successCount || 0}건)`);
    } catch (error) {
      console.error(error);
      setNoticeError(
        error instanceof Error ? error.message : "테스트 푸시 발송에 실패했습니다."
      );
    } finally {
      setNoticeTesting(false);
    }
  };

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

  const todayMessageTitle =
    stats.streak >= 5
      ? "좋아요, 흐름이 이어지고 있어요"
      : stats.totalAttempts === 0
        ? "오늘의 첫 기록을 만들어볼까요?"
        : "지금 페이스가 나쁘지 않아요";

  const todayMessageBody =
    stats.streak >= 5
      ? `최근 ${stats.streak}일 연속으로 학습했어요. 오늘도 짧게라도 이어가면 흐름이 더 단단해집니다.`
      : stats.totalAttempts === 0
        ? "아직 저장된 학습 기록이 없어요. 회화나 단어를 한 세트만 해도 메시지가 달라지기 시작합니다."
        : `지금까지 총 ${stats.totalAttempts}회 학습했고, 이번 주에는 ${stats.thisWeekCount}회 진행했어요. 오늘도 가볍게 한 세트 이어가 보세요.`;

  const coachTipTitle =
    stats.topWrongType === "회화"
      ? "오늘의 코치 팁 · 회화"
      : stats.topWrongType === "한자"
        ? "오늘의 코치 팁 · 한자"
        : stats.topWrongType === "단어"
          ? "오늘의 코치 팁 · 단어"
          : "오늘의 코치 팁";

  const coachTipBody =
    stats.topWrongType === "회화"
      ? "오답이 많은 회화는 정답을 읽는 것보다 소리 내어 2~3번 따라 하는 쪽이 훨씬 오래 남습니다. 짧게라도 입으로 꺼내 보세요."
      : stats.topWrongType === "한자"
        ? "한자는 많이 보기보다 헷갈린 것만 다시 보는 편이 효율적입니다. 오늘은 오답노트에서 자주 틀린 것부터 정리해 보세요."
        : stats.topWrongType === "단어"
          ? "단어는 뜻만 보지 말고 짧은 문장 안에서 다시 만나야 기억이 오래 갑니다. 오늘은 오답 10개만 가볍게 복습해 보세요."
          : "오늘의 학습 기록을 바탕으로, 가장 부담 없는 루틴부터 다시 이어가 보세요.";

  const warmMessage =
    stats.totalWrong === 0
      ? "지금 흐름이 아주 좋습니다. 오늘은 유지하는 것만으로도 충분해요."
      : stats.totalWrong <= 10
        ? "조금 틀려도 괜찮아요. 기록은 흔들림이 아니라, 다시 올라가는 발판이 됩니다."
        : "오답이 쌓였다는 건 그만큼 시도했다는 뜻이기도 해요. 오늘은 많이 말고, 한 번 더 보는 것에 집중해 봅시다.";

  const latestAttemptAt = allAttempts[0]?.created_at || recentAttempts[0]?.created_at || null;
  const secondAttemptAt = allAttempts[1]?.created_at || latestAttemptAt;
  const thirdAttemptAt = allAttempts[2]?.created_at || secondAttemptAt;

  const messageHistory = [
    {
      id: "today-message",
      section: "오늘",
      badge: "NEW",
      title: todayMessageTitle,
      body: todayMessageBody,
      time: latestAttemptAt,
    },
    {
      id: "warm-message",
      section: "오늘",
      badge: "",
      title: "현재 학습 코멘트",
      body: warmMessage,
      time: secondAttemptAt,
    },
    {
      id: "coach-message",
      section: "최근",
      badge: "",
      title: coachTipTitle,
      body: coachTipBody,
      time: thirdAttemptAt,
    },
  ];

  const groupedMessageHistory = messageHistory.reduce<Record<string, typeof messageHistory>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  const noticePermissionLabel =
    noticeStatus.permission === "granted"
      ? "허용됨"
      : noticeStatus.permission === "denied"
        ? "차단됨"
        : noticeStatus.permission === "default"
          ? "아직 미설정"
          : "-";

  const noticeSummary = !noticeStatus.supported
    ? "이 브라우저에서는 푸시 알림을 지원하지 않습니다."
    : noticeStatus.subscribed
      ? "푸시 알림이 켜져 있습니다."
      : noticeStatus.permission === "denied"
        ? "브라우저에서 알림이 차단되어 있습니다."
        : noticeStatus.permission === "granted"
          ? "권한은 허용되어 있지만, 푸시 연결은 아직 꺼져 있습니다."
          : "알림이 아직 설정되지 않았습니다.";

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    const needsLogin = errorMsg === "로그인이 필요합니다.";

    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className={needsLogin ? "text-sm text-gray-700" : "text-sm text-red-500"}>
            {errorMsg}
          </p>

          {needsLogin ? (
            <a
              href="/login"
              className="mt-4 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              로그인하러 가기
            </a>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mt-2">
          <p className="text-3xl font-bold text-gray-900">마이페이지</p>
          <p className="mt-1 text-sm text-gray-500">
            학습 기록과 오답, 메시지를 한눈에 확인하세요.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-sky-200 bg-sky-50/70">
          <button
            type="button"
            onClick={() => setInstallGuideOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div>
              <p className="text-base font-bold text-slate-900">앱처럼 설치하기</p>
              <p className="mt-1 text-sm text-slate-600">
                홈 화면에 추가하면 더 빠르고 편하게 사용할 수 있어요.
              </p>
            </div>
            <span className="ml-4 text-xl font-bold text-slate-500">
              {installGuideOpen ? "−" : "+"}
            </span>
          </button>

          {installGuideOpen ? (
            <div className="border-t border-sky-200 bg-white/70 px-5 py-4 text-sm leading-6 text-slate-700">
              <div className="font-semibold text-slate-900">브라우저별 안내</div>
              <div className="mt-2">
                • <span className="font-semibold">iPhone / Safari</span>:
                아래 공유 버튼 → 홈 화면에 추가
                <br />
                • <span className="font-semibold">Android / Chrome</span>:
                브라우저 메뉴 → 홈 화면에 추가 또는 앱 설치
                <br />
                • <span className="font-semibold">삼성 인터넷</span>:
                브라우저 메뉴 → 홈 화면에 추가
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-500">현재 플랜</p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {profile?.plan === "PRO"
                  ? `PRO 이용 중 · ${formatDateOnly(profile?.plan_expires_at)}까지`
                  : "FREE 이용 중"}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {profile?.plan === "PRO"
                  ? `시작일 ${formatDateOnly(profile?.plan_started_at)} · 만료일 ${formatDateOnly(profile?.plan_expires_at)}`
                  : "현재는 FREE 플랜으로 이용 중입니다."}
              </p>
            </div>
            <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
              {profile?.full_name ? `${profile.full_name}님` : "학습 중"}
            </div>
          </div>

          <div className="mt-5 h-3 rounded-full bg-gray-100">
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


        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-3 sm:p-5">
            <p className="text-2xl sm:text-4xl font-bold">{stats.streak}</p>
            <p className="mt-2 text-sm sm:text-lg font-semibold text-gray-700">연속 학습일</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-3 sm:p-5">
            <p className="text-2xl sm:text-4xl font-bold">{stats.thisWeekCount}</p>
            <p className="mt-2 text-sm sm:text-lg font-semibold text-gray-700">이번 주 풀이수</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-3 sm:p-5">
            <p className="text-2xl sm:text-4xl font-bold">{stats.topWrongType}</p>
            <p className="mt-2 text-sm sm:text-lg font-semibold text-gray-700">최다 오답 유형</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-3 sm:p-5">
            <p className="text-2xl sm:text-4xl font-bold">{stats.totalWrong}</p>
            <p className="mt-2 text-sm sm:text-lg font-semibold text-gray-700">오답</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-3 sm:p-5">
            <p className="text-2xl sm:text-4xl font-bold">
              {stats.totalAttempts === 0
                ? "0%"
                : `${Math.round(
                  ((stats.totalAttempts * 10 - stats.totalWrong) /
                    Math.max(stats.totalAttempts * 10, 1)) *
                  100
                )}%`}
            </p>
            <p className="mt-2 text-sm sm:text-lg font-semibold text-gray-700">평균 정답률</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-3 sm:p-5">
            <p className="text-2xl sm:text-4xl font-bold">
              {stats.last7.reduce((sum, day) => sum + (day.total > 0 ? 1 : 0), 0)}
            </p>
            <p className="mt-2 text-sm sm:text-lg font-semibold text-gray-700">최근 7일 학습</p>
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

          <div className="mt-5 grid grid-cols-7 gap-2">
            {stats.last7.map((day, idx) => (
              <div
                key={`${day.label}-${idx}`}
                className="rounded-2xl border border-blue-200 bg-blue-50 p-2 sm:p-4 text-center"
              >
                <p className="text-xs sm:text-lg font-bold">{day.label}</p>
                <p className="mt-2 sm:mt-3 text-lg sm:text-3xl font-bold">{idx + 1}</p>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm font-semibold text-gray-700">{day.total}회</p>
                <div className="mt-2 sm:mt-3 text-[10px] sm:text-sm text-gray-600">
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
          type="button"
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
              type="button"
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
              type="button"
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
              type="button"
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
              type="button"
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
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">📚 오답</h2>
                <p className="mt-2 text-sm text-gray-500">
                  반복해서 틀린 문제부터 가볍게 정리해 보세요.
                </p>
              </div>
              <div className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
                최근 오답 {filteredRecent.length}개
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
                <div>
                  <p className="text-sm font-semibold text-gray-700">오답으로 시험보기</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { key: "word", label: "단어" },
                      { key: "kanji", label: "한자" },
                      { key: "talk", label: "회화" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setWrongApp(item.key as WrongAppKey)}
                        className={
                          wrongApp === item.key
                            ? "rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                            : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700">문항 수</p>
                  <div className="relative mt-2">
                    <select
                      value={wrongCount}
                      onChange={(e) => setWrongCount(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3 pr-10 text-base font-medium text-gray-900"
                    >
                      <option value="10">10문제</option>
                      <option value="20">20문제</option>
                      <option value="30">30문제</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400">
                      ⌄
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWrongExamStart}
                className="mt-5 w-full rounded-2xl bg-black px-5 py-4 text-lg font-semibold text-white"
              >
                📝 오답으로 시험보기
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <label className="text-sm font-semibold text-gray-700">검색</label>
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3"
                    placeholder="유형, 레벨, 점수로 검색하세요."
                  />
                </div>

                <label className="inline-flex items-center gap-3 rounded-2xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={repeatOnly}
                    onChange={(e) => setRepeatOnly(e.target.checked)}
                  />
                  🔥 반복 오답만 보기 (3회+)
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { key: "all", label: "전체" },
                  { key: "word", label: "단어" },
                  { key: "kanji", label: "한자" },
                  { key: "talk", label: "회화" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setWrongFilter(item.key as WrongFilterKey)}
                    className={
                      wrongFilter === item.key
                        ? "rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800"
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                          {getAppLabelFromPosMode(item.pos_mode)}
                        </div>
                        <p className="mt-3 text-lg font-bold text-gray-900">
                          {prettyAttemptLabel(withFullIfMissing(item.pos_mode))}
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                          {item.level || "-"} · {Number(item.score || 0)}/{Number(item.quiz_len || 0)} · 오답 {Number(item.wrong_count || 0)}
                        </p>
                      </div>

                      <div className="text-right text-sm text-gray-500">
                        <p>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString("ko-KR")
                            : "-"}
                        </p>
                        <p className="mt-1">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleTimeString("ko-KR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            : "-"}
                        </p>
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
              최근 학습 흐름을 한눈에 확인해 보세요. 가장 최근에 저장된 결과부터 보여드립니다.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">최근 기록</p>
                <p className="mt-2 text-2xl font-bold">{recentAttempts.length}개</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">평균 점수</p>
                <p className="mt-2 text-2xl font-bold">{calcAveragePercent(recentAttempts)}%</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">가장 많이 한 학습</p>
                <p className="mt-2 text-2xl font-bold">
                  {getTopWrongType(recentAttempts) === "-" ? "-" : getTopWrongType(recentAttempts)}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {recentAttempts.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 p-5 text-sm text-gray-500">
                  표시할 기록이 없습니다.
                </div>
              ) : (
                recentAttempts.map((item) => {
                  const kind = detectAppKind(item.pos_mode);
                  const tone =
                    kind === "talk"
                      ? "border-purple-200 bg-purple-50 text-purple-700"
                      : kind === "word"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : kind === "kanji"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-gray-200 bg-gray-50 text-gray-700";

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-gray-200 bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
                            {getAppLabelFromPosMode(item.pos_mode)}
                          </div>
                          <p className="mt-3 text-base font-semibold text-gray-900">
                            {prettyAttemptLabel(withFullIfMissing(item.pos_mode))}
                          </p>
                          <p className="mt-2 text-sm text-gray-600">
                            {item.level || "-"} · {Number(item.score || 0)}/{Number(item.quiz_len || 0)} · 오답 {Number(item.wrong_count || 0)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right text-xs text-gray-500">
                          {item.created_at ? new Date(item.created_at).toLocaleString("ko-KR") : "-"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {mainTab === "message" ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">💌 메시지</h2>
                  <p className="mt-3 text-sm text-gray-500">
                    관리자가 직접 보낸 메시지가 아니라, 오늘의 학습 흐름을 바탕으로 자동 생성된 피드백 메시지입니다.
                  </p>
                </div>
                <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  최신 업데이트 · {formatRelativeMessageTime(latestAttemptAt)}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-6">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-blue-700">오늘의 한마디</p>
                <div className="rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700">
                  {formatRelativeMessageTime(latestAttemptAt)}
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{todayMessageTitle}</p>
              <p className="mt-3 text-base leading-7 text-gray-700">{todayMessageBody}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-gray-200 bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-500">현재 학습 코멘트</p>
                  <p className="text-xs font-medium text-gray-400">{formatRelativeMessageTime(secondAttemptAt)}</p>
                </div>
                <p className="mt-3 text-lg font-semibold text-gray-900">{warmMessage}</p>
                <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                  최근 7일 학습 {stats.last7.reduce((sum, day) => sum + (day.total > 0 ? 1 : 0), 0)}일 · 연속 학습 {stats.streak}일 · 이번 주 풀이 {stats.thisWeekCount}회
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-500">{coachTipTitle}</p>
                  <p className="text-xs font-medium text-gray-400">{formatRelativeMessageTime(thirdAttemptAt)}</p>
                </div>
                <p className="mt-3 text-lg font-semibold text-gray-900">오늘은 너무 넓게 말고, 하나만 정확히</p>
                <p className="mt-3 text-base leading-7 text-gray-700">{coachTipBody}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">메시지 기록</p>
                  <p className="mt-2 text-sm text-gray-500">언제 받은 메시지인지 한눈에 구분할 수 있게 최근 흐름으로 정리했습니다.</p>
                </div>
                <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  총 {messageHistory.length}개
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {Object.entries(groupedMessageHistory).map(([section, items]) => (
                  <div key={section}>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-gray-200" />
                      <p className="shrink-0 text-xs font-semibold tracking-wide text-gray-400">{section}</p>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>

                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                              {item.badge ? (
                                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-500">
                                  {item.badge}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs font-medium text-gray-400">{formatRelativeMessageTime(item.time)}</p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-gray-600">{item.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">지금 추천하는 루틴</p>
                  <p className="mt-2 text-sm text-gray-500">부담 없이 이어가기 좋은 루틴부터 시작해 보세요.</p>
                </div>
                <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  {profile?.full_name ? `${profile.full_name}님 맞춤` : "오늘의 추천"}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={
                    stats.topWrongType === "회화"
                      ? "/mypage/wrong-talk"
                      : stats.topWrongType === "한자"
                        ? "/mypage/wrong-kanji"
                        : "/mypage/wrong-word"
                  }
                  className="rounded-2xl border border-gray-300 px-5 py-4 text-center text-base font-semibold text-gray-900"
                >
                  🔁 가장 많이 틀린 유형 복습
                </a>
                <a
                  href="/talk"
                  className="rounded-2xl border border-gray-300 px-5 py-4 text-center text-base font-semibold text-gray-900"
                >
                  🗣️ 회화 1세트 이어가기
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {mainTab === "notice" ? (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold">🔔 알림</h2>
            <p className="mt-3 text-sm text-gray-500">
              지금 이 브라우저에서 푸시 알림이 켜져 있는지 바로 확인할 수 있습니다.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">브라우저 권한</p>
                <p className="mt-2 text-xl font-bold">{noticePermissionLabel}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">푸시 연결 상태</p>
                <p className="mt-2 text-xl font-bold">
                  {noticeStatus.subscribed ? "켜짐" : "꺼짐"}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">서비스워커</p>
                <p className="mt-2 text-xl font-bold">
                  {noticeStatus.serviceWorkerReady ? "준비됨" : "미확인"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-base font-semibold text-blue-900">{noticeSummary}</p>
              <p className="mt-2 text-sm text-blue-800">
                {noticeStatus.permission === "denied"
                  ? "브라우저 설정에서 알림 권한을 다시 허용해야 합니다."
                  : "권한과 푸시 연결 상태를 함께 기준으로 보여줍니다."}
              </p>
            </div>

            {noticeError ? (
              <p className="mt-4 text-sm text-red-500">{noticeError}</p>
            ) : null}

            {noticeMessage ? (
              <p className="mt-4 text-sm text-green-600">{noticeMessage}</p>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleEnableNotice}
                disabled={noticeEnabling}
                className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-base font-semibold text-gray-800 disabled:opacity-60"
              >
                {noticeEnabling ? "알림 연결 중..." : "알림 켜기"}
              </button>

              <button
                type="button"
                onClick={refreshNoticeStatus}
                disabled={noticeRefreshing}
                className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-base font-semibold text-gray-800 disabled:opacity-60"
              >
                {noticeRefreshing ? "상태 확인 중..." : "상태 새로고침"}
              </button>

              <button
                type="button"
                onClick={handleDisableNotice}
                disabled={noticeDisabling}
                className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-base font-semibold text-gray-800 disabled:opacity-60"
              >
                {noticeDisabling ? "해제 중..." : "알림 끄기"}
              </button>

              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={noticeTesting}
                className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-base font-semibold text-gray-800 disabled:opacity-60"
              >
                {noticeTesting ? "테스트 발송 중..." : "테스트 알림 보내기"}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 w-full rounded-2xl bg-black px-5 py-4 text-lg font-semibold text-white"
        >
          로그아웃
        </button>
      </div>
    </main>
  );
}
