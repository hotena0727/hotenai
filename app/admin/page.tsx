"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllAttempts, type QuizAttemptRow } from "@/lib/attempts";
import {
  getPlanBadge,
  getPlanLabel,
  getPlanOptions,
  hasPlan,
  normalizePlan,
  type PlanCode,
} from "@/lib/plans";

type AdminTab = "members" | "stats" | "push" | "logs" | "app" | "backup";
type LogFilter = "all" | "word" | "kanji" | "talk";

type AdminProfile = {
  id: string;
  email: string;
  full_name?: string;
  plan: PlanCode;
  is_admin: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
};

type PushDebugInfo = {
  mode?: string;
  targetUserId?: string;
  total?: number;
  matchedRows?: number;
  availableColumns?: string[];
  detail?: string;
  note?: string;
};

type CleanupPreview = {
  scopeLabel: string;
  days: number;
  total: number;
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

const PLAN_DURATION_OPTIONS = [
  { value: 30, label: "30일" },
  { value: 90, label: "90일" },
  { value: 180, label: "6개월" },
  { value: 365, label: "1년" },
] as const;

const PLAN_OPTIONS = getPlanOptions();

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value: string | null | undefined) {
  const d = toDate(value);
  if (!d) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWordAttempt(item: QuizAttemptRow) {
  return String(item.pos_mode || "").startsWith("단어");
}

function isKanjiAttempt(item: QuizAttemptRow) {
  return String(item.pos_mode || "").startsWith("한자");
}

function isTalkAttempt(item: QuizAttemptRow) {
  return String(item.pos_mode || "").startsWith("회화");
}

function countWhere<T>(items: T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}

function getAdminDisplayName(item: AdminProfile) {
  return item.full_name?.trim() || item.email || "(이름 없음)";
}

function buildRecentLogs(attempts: QuizAttemptRow[]) {
  return [...attempts]
    .sort((a, b) => {
      const ta = toDate(a.created_at)?.getTime() || 0;
      const tb = toDate(b.created_at)?.getTime() || 0;
      return tb - ta;
    })
    .slice(0, 20);
}

function getMenuStatusLabel(show: boolean, minPlan: PlanCode) {
  if (!show) {
    return {
      text: "숨김",
      className:
        "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600",
    };
  }

  if (minPlan === "free") {
    return {
      text: "FREE 공개",
      className:
        "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700",
    };
  }

  return {
    text: `${getPlanLabel(minPlan)} 이상`,
    className:
      "rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700",
    };
}

function canUserSeeMenu(userPlan: PlanCode, show: boolean, minPlan: PlanCode) {
  if (!show) return false;
  return hasPlan(userPlan, minPlan);
}

function getPlanTone(plan: PlanCode) {
  switch (plan) {
    case "free":
      return {
        pill: "border-gray-200 bg-gray-50 text-gray-700",
        soft: "bg-gray-50 text-gray-700",
      };
    case "light":
      return {
        pill: "border-sky-200 bg-sky-50 text-sky-700",
        soft: "bg-sky-50 text-sky-700",
      };
    case "standard":
      return {
        pill: "border-violet-200 bg-violet-50 text-violet-700",
        soft: "bg-violet-50 text-violet-700",
      };
    case "pro":
      return {
        pill: "border-blue-200 bg-blue-50 text-blue-700",
        soft: "bg-blue-50 text-blue-700",
      };
    case "vip":
      return {
        pill: "border-amber-200 bg-amber-50 text-amber-700",
        soft: "bg-amber-50 text-amber-700",
      };
    default:
      return {
        pill: "border-gray-200 bg-gray-50 text-gray-700",
        soft: "bg-gray-50 text-gray-700",
      };
  }
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "border-b-2 border-red-400 px-1 pb-3 text-base font-semibold text-red-400"
          : "px-1 pb-3 text-base font-semibold text-gray-700"
      }
    >
      {icon} {label}
    </button>
  );
}

function PillButton({
  active,
  onClick,
  label,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "default" | "danger";
}) {
  const activeCls =
    tone === "danger"
      ? "border-red-300 bg-red-50 text-red-600"
      : "border-black bg-black text-white";
  const inactiveCls =
    tone === "danger"
      ? "border-gray-200 bg-white text-gray-700"
      : "border-gray-300 bg-white text-gray-800";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold ${active ? activeCls : inactiveCls}`}
    >
      {label}
    </button>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [tab, setTab] = useState<AdminTab>("members");
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanCode>>({});
  const [durationDrafts, setDurationDrafts] = useState<Record<string, number>>(
    {}
  );
  const [savingUserId, setSavingUserId] = useState("");
  const [memberMessage, setMemberMessage] = useState("");

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
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuMessage, setMenuMessage] = useState("");
  const [showMyClassroomSection, setShowMyClassroomSection] = useState(false);
  const [pageSettingsSaving, setPageSettingsSaving] = useState(false);
  const [pageSettingsMessage, setPageSettingsMessage] = useState("");

  const [pushTitle, setPushTitle] = useState("하테나 알림");
  const [pushBody, setPushBody] = useState("오늘 15분만 같이 달려요. 🔥");
  const [pushUrl, setPushUrl] = useState("https://hotenai.com");
  const [pushMode, setPushMode] = useState<"test" | "all" | "selected">("test");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushMemberQuery, setPushMemberQuery] = useState("");
  const [selectedPushUserId, setSelectedPushUserId] = useState("");
  const [pushDebugInfo, setPushDebugInfo] = useState<PushDebugInfo | null>(null);
  const [pushProbeBusy, setPushProbeBusy] = useState(false);

  const [backupTag, setBackupTag] = useState("stable");
  const [backupConfirm, setBackupConfirm] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);

  const [cleanupPreset, setCleanupPreset] = useState<7 | 30 | 90>(30);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleanupScope, setCleanupScope] = useState<"mine" | "all">("mine");
  const [cleanupDeleteAll, setCleanupDeleteAll] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(
    null
  );
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [cleanupReadyToRun, setCleanupReadyToRun] = useState(false);

  const [memberMsgPreset, setMemberMsgPreset] = useState<
    "시험 독려" | "루틴 독려" | "합격 축하" | ""
  >("");
  const [memberMsgTitle, setMemberMsgTitle] = useState("");
  const [memberMsgBody, setMemberMsgBody] = useState("");
  const [memberMsgTarget, setMemberMsgTarget] = useState<"selected" | "plan">(
    "selected"
  );
  const [memberMsgPlan, setMemberMsgPlan] = useState<PlanCode>("standard");
  const [memberMsgConfirm, setMemberMsgConfirm] = useState(false);
  const [memberMsgBusy, setMemberMsgBusy] = useState(false);
  const [memberMsgStatus, setMemberMsgStatus] = useState("");
  const [memberMsgProbeBusy, setMemberMsgProbeBusy] = useState(false);
  const [memberMsgProbeResult, setMemberMsgProbeResult] =
    useState<PushDebugInfo | null>(null);

  const [logType, setLogType] = useState<LogFilter>("all");
  const [logQuery, setLogQuery] = useState("");
  const [logOnlyWrong, setLogOnlyWrong] = useState(false);

  useEffect(() => {
    const loadAdmin = async () => {
      setLoading(true);
      setErrorMsg("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setErrorMsg("로그인이 필요합니다.");
          setLoading(false);
          return;
        }

        const { data: myProfile, error: myProfileError } = await supabase
          .from("profiles")
          .select(
            "id, email, full_name, plan, is_admin, created_at, updated_at, plan_started_at, plan_expires_at"
          )
          .eq("id", user.id)
          .maybeSingle();

        if (myProfileError) {
          console.error(myProfileError);
          setErrorMsg("관리자 정보를 확인하지 못했습니다.");
          setLoading(false);
          return;
        }

        if (!myProfile?.is_admin) {
          setErrorMsg("관리자만 접근할 수 있습니다.");
          setLoading(false);
          return;
        }

        const { data: profileRows, error: profileRowsError } = await supabase
          .from("profiles")
          .select(
            "id, email, full_name, plan, is_admin, created_at, updated_at, plan_started_at, plan_expires_at"
          )
          .order("created_at", { ascending: false });

        if (profileRowsError) {
          console.error(profileRowsError);
          setErrorMsg("회원 목록을 불러오지 못했습니다.");
          setLoading(false);
          return;
        }

        const normalizedProfiles: AdminProfile[] = (profileRows || []).map(
          (row: any) => ({
            id: String(row.id || ""),
            email: String(row.email || ""),
            full_name: String(row.full_name || "").trim(),
            plan: normalizePlan(row.plan),
            is_admin: Boolean(row.is_admin),
            created_at: row.created_at ?? null,
            updated_at: row.updated_at ?? null,
            plan_started_at: row.plan_started_at ?? null,
            plan_expires_at: row.plan_expires_at ?? null,
          })
        );

        setProfiles(normalizedProfiles);
        setPlanDrafts(
          Object.fromEntries(normalizedProfiles.map((item) => [item.id, item.plan]))
        );
        setDurationDrafts(
          Object.fromEntries(normalizedProfiles.map((item) => [item.id, 30]))
        );
        if (normalizedProfiles[0]?.id) setSelectedMemberId(normalizedProfiles[0].id);

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
          .select("show_my_classroom_section")
          .eq("id", 1)
          .maybeSingle();

        if (pageError) {
          console.error(pageError);
        } else if (pageRow) {
          setShowMyClassroomSection(Boolean(pageRow.show_my_classroom_section));
        }

        const allAttempts = await fetchAllAttempts(user.id, 300);
        setAttempts(allAttempts);
      } catch (error) {
        console.error(error);
        setErrorMsg("관리자 페이지를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void loadAdmin();
  }, []);

  const filteredProfiles = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((item) => {
      return (
        item.email.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        String(item.full_name || "").toLowerCase().includes(q) ||
        item.plan.toLowerCase().includes(q)
      );
    });
  }, [profiles, memberSearch]);

  const filteredPushProfiles = useMemo(() => {
    const q = pushMemberQuery.trim().toLowerCase();
    const base = profiles.filter((item) => !!item.email);
    if (!q) return base.slice(0, 50);
    return base
      .filter((item) => {
        return (
          item.email.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          String(item.full_name || "").toLowerCase().includes(q) ||
          item.plan.toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [profiles, pushMemberQuery]);

  const selectedPushProfile = useMemo(
    () => profiles.find((item) => item.id === selectedPushUserId) || null,
    [profiles, selectedPushUserId]
  );

  const selectedMember = useMemo(
    () => profiles.find((item) => item.id === selectedMemberId) || null,
    [profiles, selectedMemberId]
  );

  const memberRecentMap = useMemo(() => {
    const recent = new Map<string, string>();
    for (
      const item of [...attempts].sort((a, b) => {
        const ta = toDate(a.created_at)?.getTime() || 0;
        const tb = toDate(b.created_at)?.getTime() || 0;
        return tb - ta;
      })
    ) {
      const uid = String(item.user_id || "");
      if (uid && !recent.has(uid)) recent.set(uid, formatDateTime(item.created_at));
    }
    return recent;
  }, [attempts]);

  const stats = useMemo(() => {
    const totalMembers = profiles.length;
    const paidMembers = profiles.filter((item) => item.plan !== "free").length;
    const adminMembers = profiles.filter((item) => item.is_admin).length;
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayQuiz = attempts.filter(
      (item) => String(item.created_at || "").slice(0, 10) === todayKey
    ).length;

    const planCounts: Record<PlanCode, number> = {
      free: profiles.filter((item) => item.plan === "free").length,
      light: profiles.filter((item) => item.plan === "light").length,
      standard: profiles.filter((item) => item.plan === "standard").length,
      pro: profiles.filter((item) => item.plan === "pro").length,
      vip: profiles.filter((item) => item.plan === "vip").length,
    };

    return {
      totalMembers,
      paidMembers,
      adminMembers,
      todayQuiz,
      planCounts,
      wordCount: countWhere(attempts, isWordAttempt),
      kanjiCount: countWhere(attempts, isKanjiAttempt),
      talkCount: countWhere(attempts, isTalkAttempt),
      recentLogs: buildRecentLogs(attempts),
    };
  }, [profiles, attempts]);

  const filteredLogs = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    return buildRecentLogs(attempts).filter((item) => {
      const typeOk =
        logType === "all"
          ? true
          : logType === "word"
            ? isWordAttempt(item)
            : logType === "kanji"
              ? isKanjiAttempt(item)
              : isTalkAttempt(item);

      const queryOk = !q
        ? true
        : String(item.user_email || "").toLowerCase().includes(q) ||
          String(item.level || "").toLowerCase().includes(q) ||
          String(item.pos_mode || "").toLowerCase().includes(q);

      const wrongOk = !logOnlyWrong ? true : Number(item.wrong_count || 0) > 0;
      return typeOk && queryOk && wrongOk;
    });
  }, [attempts, logType, logQuery, logOnlyWrong]);

  const handlePlanDraftChange = (userId: string, value: PlanCode) => {
    setPlanDrafts((prev) => ({ ...prev, [userId]: value }));
    if (value !== "free") {
      setDurationDrafts((prev) => ({ ...prev, [userId]: prev[userId] || 30 }));
    }
    setMemberMessage("");
  };

  const handleDurationDraftChange = (userId: string, value: number) => {
    setDurationDrafts((prev) => ({ ...prev, [userId]: value }));
    setMemberMessage("");
  };

  const handleMenuToggle = (
    key: keyof MenuSettings,
    value: boolean | PlanCode
  ) => {
    setMenuSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setMenuMessage("");
  };

  const handleSaveMenuSettings = async () => {
    try {
      setMenuSaving(true);
      setMenuMessage("");

      const { error } = await supabase
        .from("app_menu_settings")
        .update({
          show_home: menuSettings.show_home,
          show_word: menuSettings.show_word,
          show_kanji: menuSettings.show_kanji,
          show_katsuyou: menuSettings.show_katsuyou,
          show_talk: menuSettings.show_talk,
          show_mypage: menuSettings.show_mypage,
          show_admin: menuSettings.show_admin,

          home_min_plan: menuSettings.home_min_plan,
          word_min_plan: menuSettings.word_min_plan,
          kanji_min_plan: menuSettings.kanji_min_plan,
          katsuyou_min_plan: menuSettings.katsuyou_min_plan,
          talk_min_plan: menuSettings.talk_min_plan,
          mypage_min_plan: menuSettings.mypage_min_plan,
          admin_min_plan: menuSettings.admin_min_plan,

          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw error;

      setMenuMessage("메뉴 설정을 저장했습니다.");
    } catch (error) {
      console.error(error);
      setMenuMessage(
        error instanceof Error
          ? error.message
          : "메뉴 설정 저장 중 오류가 발생했습니다."
      );
    } finally {
      setMenuSaving(false);
    }
  };

  const handleSavePageSettings = async () => {
    try {
      setPageSettingsSaving(true);
      setPageSettingsMessage("");

      const { error } = await supabase
        .from("app_page_settings")
        .upsert(
          {
            id: 1,
            show_my_classroom_section: showMyClassroomSection,
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      setPageSettingsMessage("마이페이지 영역 설정을 저장했습니다.");
    } catch (error) {
      console.error(error);
      setPageSettingsMessage(
        error instanceof Error
          ? error.message
          : "마이페이지 영역 설정 저장 중 오류가 발생했습니다."
      );
    } finally {
      setPageSettingsSaving(false);
    }
  };

  const reloadAttempts = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return;

    const allAttempts = await fetchAllAttempts(user.id, 300);
    setAttempts(allAttempts);
  };

  const handleSavePlan = async (userId: string) => {
    const nextPlan = planDrafts[userId];
    const durationDays = durationDrafts[userId] || 30;
    const current = profiles.find((item) => item.id === userId);
    if (!current || !nextPlan) return;

    const currentPlan = normalizePlan(current.plan);
    const changed = currentPlan !== nextPlan || nextPlan !== "free";

    if (!changed) {
      setMemberMessage("변경된 플랜이 없습니다.");
      return;
    }

    try {
      setSavingUserId(userId);
      setMemberMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const res = await fetch("/api/admin/member-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId,
          plan: nextPlan,
          durationDays: nextPlan !== "free" ? durationDays : 0,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "플랜 저장 중 오류가 발생했습니다."));
      }

      const nowIso = new Date().toISOString();
      const expiresIso =
        nextPlan !== "free" ? addDays(new Date(), durationDays).toISOString() : null;

      setProfiles((prev) =>
        prev.map((item) =>
          item.id === userId
            ? {
                ...item,
                plan: nextPlan,
                plan_started_at: nextPlan !== "free" ? nowIso : null,
                plan_expires_at: expiresIso,
              }
            : item
        )
      );

      setMemberMessage(
        nextPlan !== "free"
          ? `${current.email} 회원의 플랜을 ${durationDays}일 ${getPlanBadge(nextPlan)}로 저장했습니다.`
          : `${current.email} 회원의 플랜을 ${getPlanBadge(nextPlan)}로 저장했습니다.`
      );
    } catch (error) {
      console.error(error);
      setMemberMessage(
        error instanceof Error ? error.message : "플랜 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSavingUserId("");
    }
  };

  const handleProbePushTarget = async () => {
    try {
      setPushProbeBusy(true);
      setPushMessage("");
      setPushDebugInfo(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: pushMode,
          userId: selectedPushUserId,
          probeOnly: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPushDebugInfo(data?.debug || null);
        throw new Error(String(data?.error || "대상 확인 중 오류가 발생했습니다."));
      }

      setPushDebugInfo(data?.debug || null);
      setPushMessage(
        Number(data?.total || 0) > 0
          ? `발송 가능 대상 확인 · ${data.total}건`
          : "발송 가능한 구독이 없습니다."
      );
    } catch (error) {
      console.error(error);
      setPushMessage(
        error instanceof Error ? error.message : "대상 확인 중 오류가 발생했습니다."
      );
    } finally {
      setPushProbeBusy(false);
    }
  };

  const handleSendPush = async () => {
    if (!pushTitle.trim()) {
      setPushMessage("제목을 먼저 입력해 주세요.");
      return;
    }
    if (!pushBody.trim()) {
      setPushMessage("내용을 먼저 입력해 주세요.");
      return;
    }
    if (pushMode === "selected" && !selectedPushUserId) {
      setPushMessage("발송할 회원을 먼저 선택해 주세요.");
      return;
    }

    try {
      setPushBusy(true);
      setPushMessage("");
      setPushDebugInfo(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: pushMode,
          title: pushTitle.trim(),
          body: pushBody.trim(),
          url: pushUrl.trim(),
          userId: selectedPushUserId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPushDebugInfo(data?.debug || null);
        throw new Error(String(data?.error || "푸시 발송 중 오류가 발생했습니다."));
      }

      const sent = Number(data?.sent ?? 0);
      const failed = Number(data?.failed ?? 0);
      const total = Number(data?.total ?? 0);
      setPushDebugInfo(data?.debug || null);

      setPushMessage(
        pushMode === "test"
          ? `테스트 발송 완료 · 전송 ${sent}건 / 실패 ${failed}건`
          : pushMode === "selected"
            ? `선택 회원 발송 완료 · 전송 ${sent}건 / 실패 ${failed}건 / 대상 ${total}건`
            : `전체 발송 완료 · 전송 ${sent}건 / 실패 ${failed}건 / 대상 ${total}건`
      );
    } catch (error) {
      console.error(error);
      setPushMessage(
        error instanceof Error ? error.message : "푸시 발송 중 오류가 발생했습니다."
      );
    } finally {
      setPushBusy(false);
    }
  };

  const handleCleanupPreview = async () => {
    if (!selectedMemberId && cleanupScope === "mine") {
      setCleanupMessage("회원을 먼저 선택해 주세요.");
      return;
    }

    try {
      setCleanupBusy(true);
      setCleanupMessage("");
      setCleanupPreview(null);
      setCleanupReadyToRun(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const res = await fetch("/api/admin/log-cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: "preview",
          days: cleanupDeleteAll ? 0 : cleanupDays,
          scope: cleanupScope,
          deleteAll: cleanupDeleteAll,
          selectedUserId: selectedMemberId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "정리 미리보기 중 오류가 발생했습니다."));
      }

      setCleanupPreview(data?.preview || null);
      setCleanupReadyToRun(true);
      setCleanupMessage(`정리 미리보기 완료 · ${Number(data?.preview?.total || 0)}건`);
    } catch (error) {
      console.error(error);
      setCleanupMessage(
        error instanceof Error ? error.message : "정리 미리보기 중 오류가 발생했습니다."
      );
    } finally {
      setCleanupBusy(false);
    }
  };

  const handleCleanupRun = async () => {
    if (!cleanupReadyToRun) {
      setCleanupMessage("먼저 미리보기를 확인해 주세요.");
      return;
    }
    if (!selectedMemberId && cleanupScope === "mine") {
      setCleanupMessage("회원을 먼저 선택해 주세요.");
      return;
    }

    try {
      setCleanupBusy(true);
      setCleanupMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const res = await fetch("/api/admin/log-cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: "execute",
          days: cleanupDeleteAll ? 0 : cleanupDays,
          scope: cleanupScope,
          deleteAll: cleanupDeleteAll,
          selectedUserId: selectedMemberId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "기록 정리 중 오류가 발생했습니다."));
      }

      await reloadAttempts();
      setCleanupMessage(`기록 정리 완료 · ${Number(data?.deleted || 0)}건 삭제`);
      setCleanupPreview(null);
      setCleanupReadyToRun(false);
    } catch (error) {
      console.error(error);
      setCleanupMessage(
        error instanceof Error ? error.message : "기록 정리 중 오류가 발생했습니다."
      );
    } finally {
      setCleanupBusy(false);
    }
  };

  const handleApplyMemberMsgPreset = (
    preset: "시험 독려" | "루틴 독려" | "합격 축하"
  ) => {
    setMemberMsgPreset(preset);
    if (preset === "시험 독려") {
      setMemberMsgTitle("시험, 끝까지 잘 해봅시다");
      setMemberMsgBody(
        "조금만 더 집중해 봅시다. 지금까지 쌓아온 힘이 분명히 결과로 이어질 거예요."
      );
    } else if (preset === "루틴 독려") {
      setMemberMsgTitle("오늘도 루틴, 가볍게 이어가요");
      setMemberMsgBody(
        "길게 하지 않아도 괜찮습니다. 오늘도 잠깐이라도 이어가면 실력은 분명히 앞으로 갑니다."
      );
    } else {
      setMemberMsgTitle("정말 축하합니다");
      setMemberMsgBody(
        "좋은 결과, 진심으로 축하드립니다. 여기까지 해낸 과정 자체가 정말 대단합니다."
      );
    }
    setMemberMsgStatus("");
    setMemberMsgProbeResult(null);
  };

  const handleProbeMemberMessageTarget = async () => {
    if (memberMsgTarget === "selected" && !selectedMemberId) {
      setMemberMsgStatus("회원을 먼저 선택해 주세요.");
      return;
    }

    try {
      setMemberMsgProbeBusy(true);
      setMemberMsgStatus("");
      setMemberMsgProbeResult(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const payload =
        memberMsgTarget === "plan"
          ? {
              mode: "plan",
              plan: memberMsgPlan,
              probeOnly: true,
            }
          : {
              mode: "selected",
              userId: selectedMemberId,
              probeOnly: true,
            };

      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "대상 수 확인 중 오류가 발생했습니다."));
      }

      setMemberMsgProbeResult(data?.debug || null);
      setMemberMsgStatus(
        Number(data?.total || 0) > 0
          ? `전송 가능 대상 확인 · ${data.total}건`
          : "전송 가능한 대상이 없습니다."
      );
    } catch (error) {
      console.error(error);
      setMemberMsgStatus(
        error instanceof Error ? error.message : "대상 수 확인 중 오류가 발생했습니다."
      );
    } finally {
      setMemberMsgProbeBusy(false);
    }
  };

  const handleSendMemberMessage = async () => {
    if (!memberMsgTitle.trim()) {
      setMemberMsgStatus("제목을 입력해 주세요.");
      return;
    }
    if (!memberMsgBody.trim()) {
      setMemberMsgStatus("내용을 입력해 주세요.");
      return;
    }
    if (!memberMsgConfirm) {
      setMemberMsgStatus("전송 확인을 체크해 주세요.");
      return;
    }
    if (memberMsgTarget === "selected" && !selectedMemberId) {
      setMemberMsgStatus("회원을 먼저 선택해 주세요.");
      return;
    }

    try {
      setMemberMsgBusy(true);
      setMemberMsgStatus("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const payload =
        memberMsgTarget === "plan"
          ? {
              mode: "plan",
              plan: memberMsgPlan,
              title: memberMsgTitle.trim(),
              body: memberMsgBody.trim(),
              url: pushUrl.trim(),
            }
          : {
              mode: "selected",
              title: memberMsgTitle.trim(),
              body: memberMsgBody.trim(),
              url: pushUrl.trim(),
              userId: selectedMemberId,
            };

      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "메시지 전송 중 오류가 발생했습니다."));
      }

      const sent = Number(data?.sent ?? 0);
      const failed = Number(data?.failed ?? 0);
      const total = Number(data?.total ?? 0);

      setMemberMsgStatus(
        memberMsgTarget === "plan"
          ? `${getPlanBadge(memberMsgPlan)} 전체 전송 완료 · 전송 ${sent}건 / 실패 ${failed}건 / 대상 ${total}건`
          : `메시지 전송 완료 · ${selectedMember?.email || "선택 회원"} · 전송 ${sent}건 / 실패 ${failed}건`
      );
      setMemberMsgConfirm(false);
    } catch (error) {
      console.error(error);
      setMemberMsgStatus(
        error instanceof Error ? error.message : "메시지 전송 중 오류가 발생했습니다."
      );
    } finally {
      setMemberMsgBusy(false);
    }
  };

  const handleBackupZip = async () => {
    if (!backupTag.trim()) {
      setBackupMessage("버전 태그를 먼저 입력해 주세요.");
      return;
    }
    if (!backupConfirm) {
      setBackupMessage("백업 실행 확인을 먼저 체크해 주세요.");
      return;
    }

    try {
      setBackupBusy(true);
      setBackupMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tag: backupTag.trim() }),
      });

      if (!res.ok) {
        let message = "백업 ZIP 생성 중 오류가 발생했습니다.";
        try {
          const data = await res.json();
          if (data?.error) message = String(data.error);
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `hotena_backup_${backupTag.trim()}.zip`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setBackupMessage(`백업 완료 · ${filename}`);
    } catch (error) {
      console.error(error);
      setBackupMessage(
        error instanceof Error ? error.message : "백업 ZIP 생성 중 오류가 발생했습니다."
      );
    } finally {
      setBackupBusy(false);
    }
  };

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
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <section className="mt-4">
          <h1 className="text-3xl font-bold">🛠️ 관리자 대시보드</h1>
          <p className="mt-3 text-base text-gray-600">회원/구독 관리 · 통계 · 기록</p>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-4">
          {[
            ["총 회원", stats.totalMembers, "현재 등록된 회원 수"],
            [
              "유료 회원",
              stats.paidMembers,
              `전체의 ${
                stats.totalMembers
                  ? Math.round((stats.paidMembers / stats.totalMembers) * 100)
                  : 0
              }%`,
            ],
            ["관리자", stats.adminMembers, "권한 보유 계정"],
            ["오늘 퀴즈", stats.todayQuiz, "오늘 기록된 시도 수"],
          ].map(([label, value, desc]) => (
            <div
              key={String(label)}
              className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <p className="text-sm font-semibold text-gray-500 sm:text-base">{label}</p>
              <p className="mt-3 text-2xl font-bold sm:mt-4 sm:text-3xl">{value}</p>
              <p className="mt-2 text-xs text-gray-600 sm:mt-3 sm:text-sm">{desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">플랜 분포</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["free", "light", "standard", "pro", "vip"] as PlanCode[]).map((plan) => {
              const tone = getPlanTone(plan);
              return (
                <span
                  key={plan}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${tone.pill}`}
                >
                  {getPlanBadge(plan)} {stats.planCounts[plan]}명
                </span>
              );
            })}
          </div>
        </section>

        <section className="mt-8 border-b border-gray-200">
          <div className="flex flex-wrap gap-5">
            <TabButton active={tab === "members"} onClick={() => setTab("members")} icon="👥" label="회원" />
            <TabButton active={tab === "stats"} onClick={() => setTab("stats")} icon="📊" label="통계" />
            <TabButton active={tab === "push"} onClick={() => setTab("push")} icon="🔔" label="푸시" />
            <TabButton active={tab === "logs"} onClick={() => setTab("logs")} icon="🕒" label="기록" />
            <TabButton active={tab === "app"} onClick={() => setTab("app")} icon="⚙️" label="앱 설정" />
            <TabButton active={tab === "backup"} onClick={() => setTab("backup")} icon="🗂️" label="백업·버전" />
          </div>
        </section>

        {tab === "members" ? (
          <section className="mt-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">회원 관리</h2>
              <p className="mt-3 text-sm text-gray-600">
                5단계 플랜 변경, 기록 정리, 학생 메시지 발송을 한 곳에서 관리합니다.
              </p>
            </div>

            <div className="mt-8">
              <label className="text-base font-semibold text-gray-800">회원 검색</label>
              <input
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value);
                  setMemberMessage("");
                }}
                placeholder="이름/이메일/ID/플랜으로 검색"
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
              />
            </div>

            {memberMessage ? (
              <p className="mt-6 text-sm text-gray-600">{memberMessage}</p>
            ) : (
              <p className="mt-6 text-sm text-gray-600">
                검색 결과: {filteredProfiles.length}명 / 전체: {profiles.length}명
              </p>
            )}

            <div className="mt-6 space-y-4">
              {filteredProfiles.map((item) => {
                const draft = planDrafts[item.id] || item.plan;
                const durationDraft = durationDrafts[item.id] || 30;
                const changed = draft !== item.plan || draft !== "free";
                const saving = savingUserId === item.id;
                const tone = getPlanTone(item.plan);

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl border bg-white p-5 shadow-sm ${
                      selectedMemberId === item.id ? "border-red-300" : "border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedMemberId(item.id)}
                        className="text-left"
                      >
                        <p className="text-xl font-bold">{item.email || "-"}</p>
                        <p className="mt-2 text-sm text-gray-600">
                          이름: {item.full_name?.trim() || "-"}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          가입: {formatDateTime(item.created_at)}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          최근 학습: {memberRecentMap.get(item.id) || "-"}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          만료: {item.plan !== "free" ? formatDateTime(item.plan_expires_at) : "-"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${tone.pill}`}>
                            {getPlanBadge(item.plan)}
                          </span>
                          <span className={`rounded-full px-4 py-2 text-sm font-semibold ${tone.soft}`}>
                            {getPlanLabel(item.plan)}
                          </span>
                          {item.is_admin ? (
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                              관리자
                            </span>
                          ) : null}
                        </div>
                      </button>

                      <div className="w-full max-w-xs space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-semibold text-gray-800">
                              플랜 변경
                            </label>
                            <select
                              value={draft}
                              onChange={(e) =>
                                handlePlanDraftChange(item.id, e.target.value as PlanCode)
                              }
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
                            >
                              {PLAN_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.badge}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-800">
                              기간
                            </label>
                            <select
                              value={durationDraft}
                              onChange={(e) =>
                                handleDurationDraftChange(item.id, Number(e.target.value))
                              }
                              disabled={draft === "free"}
                              className={
                                draft === "free"
                                  ? "mt-2 w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-4 text-base text-gray-400 outline-none"
                                  : "mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
                              }
                            >
                              {PLAN_DURATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {draft !== "free" ? (
                          <p className="text-xs text-gray-500">
                            만료 예정일:{" "}
                            {formatDateTime(addDays(new Date(), durationDraft).toISOString())}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            FREE로 변경하면 기간 정보는 비워집니다.
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSavePlan(item.id)}
                          disabled={saving || !changed}
                          className={
                            saving || !changed
                              ? "inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 px-5 py-4 text-base font-semibold text-gray-400"
                              : "inline-flex w-full items-center justify-center rounded-2xl bg-black px-5 py-4 text-base font-semibold text-white"
                          }
                        >
                          {saving ? "저장 중..." : "플랜 저장"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 space-y-5 rounded-3xl border border-red-100 bg-red-50/50 p-6 shadow-sm">
              <div>
                <h3 className="text-2xl font-bold">기록 정리</h3>
                <p className="mt-2 text-sm text-gray-600">
                  선택한 회원의 오래된 학습 기록을 정리합니다. 먼저 미리보기를 확인한 뒤 실행해 주세요.
                </p>
              </div>

              <div>
                <label className="text-base font-semibold text-gray-800">선택 회원</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profiles.slice(0, 8).map((item) => (
                    <PillButton
                      key={item.id}
                      active={selectedMemberId === item.id}
                      onClick={() => {
                        setSelectedMemberId(item.id);
                        setCleanupMessage("");
                        setCleanupPreview(null);
                        setCleanupReadyToRun(false);
                      }}
                      label={getAdminDisplayName(item)}
                    />
                  ))}
                </div>
                <div className="mt-3">
                  <select
                    value={selectedMemberId}
                    onChange={(e) => {
                      setSelectedMemberId(e.target.value);
                      setCleanupMessage("");
                      setCleanupPreview(null);
                      setCleanupReadyToRun(false);
                    }}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-base outline-none"
                  >
                    <option value="">회원 선택</option>
                    {profiles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.email}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedMember ? (
                  <p className="mt-3 text-sm text-gray-600">
                    선택됨: {getAdminDisplayName(selectedMember)} · 최근 학습:{" "}
                    {memberRecentMap.get(selectedMember.id) || "-"}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-base font-semibold text-gray-800">정리 기간</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[7, 30, 90].map((days) => (
                    <PillButton
                      key={days}
                      active={!cleanupDeleteAll && cleanupPreset === days}
                      onClick={() => {
                        setCleanupPreset(days as 7 | 30 | 90);
                        setCleanupDays(days);
                        setCleanupDeleteAll(false);
                        setCleanupMessage("");
                        setCleanupPreview(null);
                        setCleanupReadyToRun(false);
                      }}
                      label={`${days}일`}
                    />
                  ))}
                  <PillButton
                    active={cleanupDeleteAll}
                    onClick={() => {
                      setCleanupDeleteAll(true);
                      setCleanupMessage("");
                      setCleanupPreview(null);
                      setCleanupReadyToRun(false);
                    }}
                    label="전체 기록"
                    tone="danger"
                  />
                </div>

                <div className="mt-4">
                  <label className="text-sm font-semibold text-gray-700">직접 입력</label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={cleanupDays}
                      onChange={(e) => {
                        setCleanupDays(Math.max(1, Number(e.target.value || 1)));
                        setCleanupDeleteAll(false);
                        setCleanupMessage("");
                        setCleanupPreview(null);
                        setCleanupReadyToRun(false);
                      }}
                      className="w-32 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base outline-none"
                    />
                    <span className="text-sm text-gray-600">일 이전 기록 정리</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-base font-semibold text-gray-800">정리 대상</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PillButton
                    active={cleanupScope === "mine"}
                    onClick={() => {
                      setCleanupScope("mine");
                      setCleanupMessage("");
                      setCleanupPreview(null);
                      setCleanupReadyToRun(false);
                    }}
                    label="이 회원만"
                  />
                  <PillButton
                    active={cleanupScope === "all"}
                    onClick={() => {
                      setCleanupScope("all");
                      setCleanupMessage("");
                      setCleanupPreview(null);
                      setCleanupReadyToRun(false);
                    }}
                    label="전체 회원"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCleanupPreview}
                  disabled={cleanupBusy}
                  className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-4 text-base font-semibold text-gray-800"
                >
                  {cleanupBusy ? "확인 중..." : "정리 미리보기"}
                </button>

                <button
                  type="button"
                  onClick={handleCleanupRun}
                  disabled={cleanupBusy || !cleanupReadyToRun}
                  className={
                    cleanupBusy || !cleanupReadyToRun
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-4 text-base font-semibold text-gray-400"
                      : "inline-flex rounded-2xl bg-black px-6 py-4 text-base font-semibold text-white"
                  }
                >
                  정리 실행
                </button>
              </div>

              {cleanupPreview ? (
                <div className="rounded-2xl border border-white bg-white p-4 text-sm text-gray-700 shadow-sm">
                  <p>대상: {cleanupPreview.scopeLabel}</p>
                  <p>기준: {cleanupDeleteAll ? "전체 기록" : `${cleanupPreview.days}일 이전`}</p>
                  <p>정리 예정: {cleanupPreview.total}건</p>
                </div>
              ) : null}

              {cleanupMessage ? <p className="text-sm text-gray-600">{cleanupMessage}</p> : null}
            </div>

            <div className="mt-10 space-y-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <h3 className="text-2xl font-bold">학생에게 메시지 보내기</h3>
                <p className="mt-2 text-sm text-gray-600">
                  선택 회원 또는 특정 플랜 전체에게 메시지를 보낼 수 있습니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <PillButton
                  active={memberMsgPreset === "시험 독려"}
                  onClick={() => handleApplyMemberMsgPreset("시험 독려")}
                  label="시험 독려"
                />
                <PillButton
                  active={memberMsgPreset === "루틴 독려"}
                  onClick={() => handleApplyMemberMsgPreset("루틴 독려")}
                  label="루틴 독려"
                />
                <PillButton
                  active={memberMsgPreset === "합격 축하"}
                  onClick={() => handleApplyMemberMsgPreset("합격 축하")}
                  label="합격 축하"
                />
              </div>

              <div>
                <label className="text-base font-semibold text-gray-800">제목</label>
                <input
                  value={memberMsgTitle}
                  onChange={(e) => {
                    setMemberMsgTitle(e.target.value);
                    setMemberMsgStatus("");
                    setMemberMsgProbeResult(null);
                  }}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
                />
              </div>

              <div>
                <label className="text-base font-semibold text-gray-800">내용</label>
                <textarea
                  value={memberMsgBody}
                  onChange={(e) => {
                    setMemberMsgBody(e.target.value);
                    setMemberMsgStatus("");
                    setMemberMsgProbeResult(null);
                  }}
                  rows={4}
                  placeholder="학생에게 보낼 메시지를 입력하세요."
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-base font-semibold text-gray-800">전송 대상</label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PillButton
                      active={memberMsgTarget === "selected"}
                      onClick={() => {
                        setMemberMsgTarget("selected");
                        setMemberMsgStatus("");
                        setMemberMsgProbeResult(null);
                      }}
                      label="선택 회원에게"
                    />
                    <PillButton
                      active={memberMsgTarget === "plan"}
                      onClick={() => {
                        setMemberMsgTarget("plan");
                        setMemberMsgStatus("");
                        setMemberMsgProbeResult(null);
                      }}
                      label="특정 플랜 전체"
                    />
                  </div>
                  {memberMsgTarget === "selected" && selectedMember ? (
                    <p className="mt-3 text-sm text-gray-600">
                      현재 선택: {getAdminDisplayName(selectedMember)}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="text-base font-semibold text-gray-800">플랜 선택</label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PLAN_OPTIONS.map((option) => {
                      const tone = getPlanTone(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setMemberMsgPlan(option.value);
                            setMemberMsgStatus("");
                            setMemberMsgProbeResult(null);
                          }}
                          className={
                            memberMsgPlan === option.value
                              ? `rounded-full border px-4 py-2 text-sm font-semibold ${tone.pill}`
                              : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                          }
                        >
                          {option.badge}
                        </button>
                      );
                    })}
                  </div>
                  {memberMsgTarget === "plan" ? (
                    <p className="mt-3 text-sm text-gray-600">
                      현재 선택: {getPlanBadge(memberMsgPlan)} 전체
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleProbeMemberMessageTarget}
                  disabled={
                    memberMsgProbeBusy ||
                    (memberMsgTarget === "selected" && !selectedMemberId)
                  }
                  className={
                    memberMsgProbeBusy ||
                    (memberMsgTarget === "selected" && !selectedMemberId)
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-5 py-4 text-base font-semibold text-gray-400"
                      : "inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-4 text-base font-semibold text-gray-800"
                  }
                >
                  {memberMsgProbeBusy ? "대상 확인 중..." : "대상 수 미리보기"}
                </button>
              </div>

              {memberMsgProbeResult ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p>발송 방식: {memberMsgTarget === "plan" ? `${getPlanBadge(memberMsgPlan)} 전체` : "선택 회원"}</p>
                  <p>대상 구독 수: {memberMsgProbeResult.total ?? "-"}</p>
                  <p>매칭 행 수: {memberMsgProbeResult.matchedRows ?? "-"}</p>
                  <p>상세: {memberMsgProbeResult.detail || memberMsgProbeResult.note || "-"}</p>
                </div>
              ) : null}

              <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={memberMsgConfirm}
                  onChange={(e) => {
                    setMemberMsgConfirm(e.target.checked);
                    setMemberMsgStatus("");
                  }}
                  className="h-4 w-4"
                />
                전송 확인
              </label>

              <button
                type="button"
                onClick={handleSendMemberMessage}
                disabled={
                  memberMsgBusy ||
                  !memberMsgTitle.trim() ||
                  !memberMsgBody.trim() ||
                  (memberMsgTarget === "selected" && !selectedMemberId)
                }
                className={
                  memberMsgBusy ||
                  !memberMsgTitle.trim() ||
                  !memberMsgBody.trim() ||
                  (memberMsgTarget === "selected" && !selectedMemberId)
                    ? "inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 px-6 py-4 text-base font-semibold text-gray-400"
                    : "inline-flex w-full items-center justify-center rounded-2xl bg-black px-6 py-4 text-base font-semibold text-white"
                }
              >
                {memberMsgBusy ? "메시지 전송 중..." : "메시지 전송"}
              </button>

              {memberMsgStatus ? (
                <p className="text-sm text-gray-600">{memberMsgStatus}</p>
              ) : (
                <p className="text-sm text-gray-500">
                  전송 전에 대상 수 미리보기를 눌러 확인하면 더 안전합니다.
                </p>
              )}
            </div>
          </section>
        ) : null}

        {tab === "stats" ? (
          <section className="mt-8 space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">회원별 통계</h2>
              <p className="mt-3 text-sm text-gray-600">
                현재 기록을 기준으로 앱 사용 패턴을 간단히 봅니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xl font-bold">단어 시도</p>
                <p className="mt-4 text-3xl font-bold text-blue-600">{stats.wordCount}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xl font-bold">한자 시도</p>
                <p className="mt-4 text-3xl font-bold text-blue-600">{stats.kanjiCount}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xl font-bold">회화 시도</p>
                <p className="mt-4 text-3xl font-bold text-blue-600">{stats.talkCount}</p>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "push" ? (
          <section className="mt-8 space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">🔔 푸시 알림 보내기</h2>
              <p className="mt-3 text-sm text-gray-600">
                테스트, 선택 회원, 전체 발송으로 나누어 알림을 보낼 수 있습니다.
              </p>
            </div>
            <div className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <label className="text-base font-semibold text-gray-800">발송 방식</label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPushMode("test");
                      setPushMessage("");
                      setPushDebugInfo(null);
                    }}
                    className={
                      pushMode === "test"
                        ? "rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
                        : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
                    }
                  >
                    테스트 발송
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPushMode("selected");
                      setPushMessage("");
                      setPushDebugInfo(null);
                    }}
                    className={
                      pushMode === "selected"
                        ? "rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
                        : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
                    }
                  >
                    선택 회원 발송
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPushMode("all");
                      setPushMessage("");
                      setPushDebugInfo(null);
                    }}
                    className={
                      pushMode === "all"
                        ? "rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
                        : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
                    }
                  >
                    전체 발송
                  </button>
                </div>
              </div>

              {pushMode === "selected" ? (
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <label className="text-base font-semibold text-gray-800">회원 검색</label>
                    <input
                      value={pushMemberQuery}
                      onChange={(e) => {
                        setPushMemberQuery(e.target.value);
                        setPushMessage("");
                        setPushDebugInfo(null);
                      }}
                      placeholder="이름/이메일/ID/플랜으로 검색"
                      className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-base outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-base font-semibold text-gray-800">
                      발송할 회원
                    </label>
                    <select
                      value={selectedPushUserId}
                      onChange={(e) => {
                        setSelectedPushUserId(e.target.value);
                        setPushMessage("");
                        setPushDebugInfo(null);
                      }}
                      className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-base outline-none"
                    >
                      <option value="">회원 선택</option>
                      {filteredPushProfiles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.email} · {getPlanBadge(item.plan)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedPushUserId ? (
                    <p className="text-sm text-gray-600">
                      선택됨: {selectedPushProfile?.email || "-"}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="text-base font-semibold text-gray-800">제목</label>
                <input
                  value={pushTitle}
                  onChange={(e) => {
                    setPushTitle(e.target.value);
                    setPushMessage("");
                    setPushDebugInfo(null);
                  }}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
                />
              </div>
              <div>
                <label className="text-base font-semibold text-gray-800">내용</label>
                <textarea
                  value={pushBody}
                  onChange={(e) => {
                    setPushBody(e.target.value);
                    setPushMessage("");
                    setPushDebugInfo(null);
                  }}
                  rows={4}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
                />
              </div>
              <div>
                <label className="text-base font-semibold text-gray-800">
                  클릭 이동 URL (선택)
                </label>
                <input
                  value={pushUrl}
                  onChange={(e) => {
                    setPushUrl(e.target.value);
                    setPushMessage("");
                    setPushDebugInfo(null);
                  }}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleProbePushTarget}
                  disabled={pushProbeBusy || (pushMode === "selected" && !selectedPushUserId)}
                  className={
                    pushProbeBusy || (pushMode === "selected" && !selectedPushUserId)
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-5 py-4 text-base font-semibold text-gray-400"
                      : "inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-4 text-base font-semibold text-gray-800"
                  }
                >
                  {pushProbeBusy ? "대상 확인 중..." : "대상 확인"}
                </button>
                <button
                  type="button"
                  onClick={handleSendPush}
                  disabled={
                    pushBusy ||
                    !pushTitle.trim() ||
                    !pushBody.trim() ||
                    (pushMode === "selected" && !selectedPushUserId)
                  }
                  className={
                    pushBusy ||
                    !pushTitle.trim() ||
                    !pushBody.trim() ||
                    (pushMode === "selected" && !selectedPushUserId)
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-4 text-base font-semibold text-gray-400"
                      : "inline-flex rounded-2xl bg-black px-6 py-4 text-base font-semibold text-white"
                  }
                >
                  {pushBusy
                    ? "푸시 발송 중..."
                    : pushMode === "test"
                      ? "🚀 테스트 발송"
                      : pushMode === "selected"
                        ? "🚀 선택 회원 발송"
                        : "🚀 전체 발송"}
                </button>
              </div>

              {pushMessage ? (
                <p className="text-sm text-gray-600">{pushMessage}</p>
              ) : (
                <p className="text-sm text-gray-500">
                  테스트 발송은 현재 관리자 계정의 구독만, 선택 회원 발송은 지정 회원의 구독만, 전체 발송은 저장된 전체 구독을 대상으로 합니다.
                </p>
              )}

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">푸시 디버그</p>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  <p>발송 방식: {pushMode}</p>
                  <p>선택 회원: {selectedPushProfile?.email || "-"}</p>
                  <p>대상 구독 수: {pushDebugInfo?.total ?? "-"}</p>
                  <p>매칭 행 수: {pushDebugInfo?.matchedRows ?? "-"}</p>
                  <p>사용 컬럼: {pushDebugInfo?.availableColumns?.join(", ") || "-"}</p>
                  <p>상세: {pushDebugInfo?.detail || pushDebugInfo?.note || "-"}</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "logs" ? (
          <section className="mt-8 space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">기록</h2>
              <p className="mt-3 text-sm text-gray-600">
                최근 시도 기록을 카드형으로 확인하고 필터로 빠르게 찾을 수 있습니다.
              </p>
            </div>

            <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap gap-3">
                {[
                  ["all", "전체"],
                  ["word", "단어"],
                  ["kanji", "한자"],
                  ["talk", "회화"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLogType(value as LogFilter)}
                    className={
                      logType === value
                        ? "rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
                        : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <input
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder="이메일 / 레벨 / 유형 검색"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
                />
                <label className="inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={logOnlyWrong}
                    onChange={(e) => setLogOnlyWrong(e.target.checked)}
                    className="h-4 w-4"
                  />
                  오답 있는 기록만
                </label>
              </div>

              <p className="text-sm text-gray-600">
                필터 결과: {filteredLogs.length}건 / 전체 최근 기록: {stats.recentLogs.length}건
              </p>
            </div>

            <div className="space-y-4">
              {filteredLogs.map((item, idx) => (
                <div
                  key={`${item.user_id || "log"}-${idx}-${item.created_at || ""}`}
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xl font-bold">{item.user_email || "(이메일 없음)"}</p>
                  <p className="mt-2 text-sm text-gray-600">🕒 {formatDateTime(item.created_at)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
                      {item.level || "-"}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
                      {item.pos_mode || "-"}
                    </span>
                    <span className="rounded-full border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-gray-700">
                      ✅ {item.score}/{item.quiz_len}
                    </span>
                    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-gray-700">
                      ❌ {item.wrong_count || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "app" ? (
          <section className="mt-8 space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">앱 설정</h2>
                  <p className="mt-3 text-sm text-gray-600">
                    상단 메뉴와 홈 화면 카드에 노출되는 메뉴를 한 번에 관리합니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveMenuSettings}
                  disabled={menuSaving}
                  className={
                    menuSaving
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                      : "inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                  }
                >
                  {menuSaving ? "저장 중..." : "설정 저장"}
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700">
                  홈 카드 + 상단 메뉴 연동
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700">
                  5등급 노출 제어
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  표시/숨김은 메뉴 자체를 감추고, 최소 플랜은 보이는 대상을 나눕니다.
                </p>
                <p className="mt-2 text-sm text-blue-800">
                  예: 회화를 표시 + standard로 설정하면, standard/pro/vip에게만 보입니다.
                </p>
              </div>

              {menuMessage ? (
                <p className="mt-4 text-sm text-gray-600">{menuMessage}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                {
                  label: "홈",
                  showKey: "show_home",
                  planKey: "home_min_plan",
                  desc: "상단 메뉴의 홈에 반영됩니다.",
                },
                {
                  label: "단어",
                  showKey: "show_word",
                  planKey: "word_min_plan",
                  desc: "상단 메뉴 + 홈의 단어 카드에 반영됩니다.",
                },
                {
                  label: "한자",
                  showKey: "show_kanji",
                  planKey: "kanji_min_plan",
                  desc: "상단 메뉴 + 홈의 한자 카드에 반영됩니다.",
                },
                {
                  label: "활용",
                  showKey: "show_katsuyou",
                  planKey: "katsuyou_min_plan",
                  desc: "상단 메뉴 + 홈의 활용 카드에 반영됩니다.",
                },
                {
                  label: "회화",
                  showKey: "show_talk",
                  planKey: "talk_min_plan",
                  desc: "상단 메뉴 + 홈의 회화 카드와 추천 루틴에 반영됩니다.",
                },
                {
                  label: "MY",
                  showKey: "show_mypage",
                  planKey: "mypage_min_plan",
                  desc: "상단 메뉴 + 홈의 MY 보기, 최근 학습 요약에 반영됩니다.",
                },
                {
                  label: "관리자",
                  showKey: "show_admin",
                  planKey: "admin_min_plan",
                  desc: "상단 메뉴의 관리자 버튼에 반영됩니다.",
                },
              ].map((item) => {
                const showValue = Boolean(
                  menuSettings[item.showKey as keyof MenuSettings]
                );
                const minPlanValue = menuSettings[
                  item.planKey as keyof MenuSettings
                ] as PlanCode;

                const status = getMenuStatusLabel(showValue, minPlanValue);

                return (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold text-gray-900">{item.label}</h3>
                          <span className={status.className}>{status.text}</span>
                        </div>
                        <p className="mt-3 text-sm text-gray-600">{item.desc}</p>
                      </div>

                      <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                        현재 최소 플랜: {getPlanBadge(minPlanValue)}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[180px_1fr]">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">노출 여부</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleMenuToggle(item.showKey as keyof MenuSettings, true)
                            }
                            className={
                              showValue
                                ? "rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                                : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                            }
                          >
                            표시
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMenuToggle(item.showKey as keyof MenuSettings, false)
                            }
                            className={
                              !showValue
                                ? "rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white"
                                : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                            }
                          >
                            숨김
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-700">최소 플랜</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {PLAN_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                handleMenuToggle(item.planKey as keyof MenuSettings, option.value)
                              }
                              className={
                                minPlanValue === option.value
                                  ? "rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white"
                                  : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                              }
                            >
                              {option.badge}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold">마이페이지 영역 공개 설정</h3>
                  <p className="mt-3 text-sm text-gray-600">
                    마이페이지에서 아직 공개하지 않을 영역을 미리 만들어 두고, 준비가 끝났을 때만 노출할 수 있습니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSavePageSettings}
                  disabled={pageSettingsSaving}
                  className={
                    pageSettingsSaving
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                      : "inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                  }
                >
                  {pageSettingsSaving ? "저장 중..." : "영역 설정 저장"}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold text-gray-900">나의 강의실</h4>
                      <span
                        className={
                          showMyClassroomSection
                            ? "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                            : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
                        }
                      >
                        {showMyClassroomSection ? "표시 중" : "숨김 중"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      마이페이지의 현재 플랜 아래에 ‘나의 강의실’ 안내 블록을 노출합니다.
                    </p>
                  </div>

                  <div className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                    대상 페이지: MY
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMyClassroomSection(true);
                      setPageSettingsMessage("");
                    }}
                    className={
                      showMyClassroomSection
                        ? "rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                    }
                  >
                    표시
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMyClassroomSection(false);
                      setPageSettingsMessage("");
                    }}
                    className={
                      !showMyClassroomSection
                        ? "rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                    }
                  >
                    숨김
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    지금은 숨김으로 두고 내부 테스트만 한 뒤, 준비가 끝났을 때 표시로 바꾸면 됩니다.
                  </p>
                </div>

                {pageSettingsMessage ? (
                  <p className="mt-4 text-sm text-gray-600">{pageSettingsMessage}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold">미리보기</h3>
              <p className="mt-3 text-sm text-gray-600">
                현재 설정 기준으로 사용자 등급별로 어떤 메뉴가 보이는지 요약합니다.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                {(["free", "light", "standard", "pro", "vip"] as PlanCode[]).map((previewPlan) => {
                  const tone = getPlanTone(previewPlan);
                  return (
                    <div
                      key={previewPlan}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <p className={`inline-flex rounded-full border px-3 py-1.5 text-base font-semibold ${tone.pill}`}>
                        {getPlanBadge(previewPlan)} 사용자에게 보임
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          ["홈", canUserSeeMenu(previewPlan, menuSettings.show_home, menuSettings.home_min_plan)],
                          ["단어", canUserSeeMenu(previewPlan, menuSettings.show_word, menuSettings.word_min_plan)],
                          ["한자", canUserSeeMenu(previewPlan, menuSettings.show_kanji, menuSettings.kanji_min_plan)],
                          ["활용", canUserSeeMenu(previewPlan, menuSettings.show_katsuyou, menuSettings.katsuyou_min_plan)],
                          ["회화", canUserSeeMenu(previewPlan, menuSettings.show_talk, menuSettings.talk_min_plan)],
                          ["MY", canUserSeeMenu(previewPlan, menuSettings.show_mypage, menuSettings.mypage_min_plan)],
                          ["관리자", canUserSeeMenu(previewPlan, menuSettings.show_admin, menuSettings.admin_min_plan)],
                        ]
                          .filter(([, visible]) => Boolean(visible))
                          .map(([label]) => (
                            <span
                              key={String(label)}
                              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700"
                            >
                              {label}
                            </span>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleSaveMenuSettings}
                  disabled={menuSaving}
                  className={
                    menuSaving
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-4 text-base font-semibold text-gray-400"
                      : "inline-flex rounded-2xl bg-black px-6 py-4 text-base font-semibold text-white"
                  }
                >
                  {menuSaving ? "저장 중..." : "메뉴 설정 저장"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "backup" ? (
          <section className="mt-8 space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">백업·버전</h2>
              <p className="mt-3 text-sm text-gray-600">
                현재 핵심 파일을 ZIP으로 백업하는 흐름을 정리하는 자리입니다.
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <label className="text-base font-semibold text-gray-800">버전 태그</label>
              <input
                value={backupTag}
                onChange={(e) => {
                  setBackupTag(e.target.value);
                  setBackupMessage("");
                }}
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base outline-none"
              />
              <label className="mt-5 flex items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={backupConfirm}
                  onChange={(e) => {
                    setBackupConfirm(e.target.checked);
                    setBackupMessage("");
                  }}
                  className="h-4 w-4"
                />
                백업 실행 확인
              </label>
              <button
                type="button"
                onClick={handleBackupZip}
                disabled={!backupTag.trim() || !backupConfirm || backupBusy}
                className={
                  !backupTag.trim() || !backupConfirm || backupBusy
                    ? "mt-6 inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-4 text-base font-semibold text-gray-400"
                    : "mt-6 inline-flex rounded-2xl bg-red-500 px-6 py-4 text-base font-semibold text-white"
                }
              >
                {backupBusy ? "백업 ZIP 생성 중..." : "백업 ZIP 만들기"}
              </button>
              {backupMessage ? (
                <p className="mt-4 text-sm text-gray-600">{backupMessage}</p>
              ) : (
                <p className="mt-4 text-sm text-gray-500">
                  태그 입력 + 실행 확인 체크 후 버튼이 활성화됩니다.
                </p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}