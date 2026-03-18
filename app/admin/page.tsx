"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { fetchAllAttempts, type QuizAttemptRow } from "@/lib/attempts";
import {
  getPlanBadge,
  getPlanLabel,
  getPlanOptions,
  getPlanTheme,
  hasPlan,
  normalizePlan,
  type PlanCode,
} from "@/lib/plans";

type AdminTab =
  | "members"
  | "stats"
  | "push"
  | "logs"
  | "app"
  | "classroom"
  | "backup";

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

type ClassroomCourse = {
  id: string;
  slug: string;
  title: string;
  level: string;
  description: string;
  status: "draft" | "open" | "coming";
  sort_order: number;
  is_visible: boolean;
  thumbnail_url?: string | null;
};

type ClassroomLesson = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  sort_order: number;
  is_preview: boolean;
  is_visible: boolean;
  video_source: "youtube" | "vimeo" | "server" | null;
  video_url?: string | null;
  video_embed_url?: string | null;
  video_seconds?: number | null;
  attachment_url?: string | null;
  audio_url?: string | null;
  poster_url?: string | null;
};

type LessonDraft = {
  title: string;
  description: string;
  sort_order: number;
  is_preview: boolean;
  is_visible: boolean;
  video_source: "youtube" | "vimeo" | "server" | null;
  video_url: string;
  video_embed_url: string;
  video_seconds: number;
  attachment_url: string;
  audio_url: string;
  poster_url: string;
};

type CourseEnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number;
  last_lesson_title?: string | null;
  last_studied_at?: string | null;
  is_completed: boolean;
};

type CourseCsvRow = {
  title?: string;
  slug?: string;
  level?: string;
  description?: string;
  status?: string;
  sort_order?: string | number;
  thumbnail_url?: string;
  is_visible?: string | boolean;
};

type LessonCsvRow = {
  title?: string;
  description?: string;
  sort_order?: string | number;
  is_preview?: string | boolean;
  is_visible?: string | boolean;
  video_source?: string;
  video_url?: string;
  video_embed_url?: string;
  video_seconds?: string | number;
  attachment_url?: string;
  audio_url?: string;
  poster_url?: string;
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

function readCsvFile<T = Record<string, unknown>>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors?.length) {
          reject(new Error(results.errors[0].message));
          return;
        }
        resolve(results.data || []);
      },
      error: (error) => reject(error),
    });
  });
}

function parseBooleanLike(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;

  const raw = String(value ?? "").trim().toLowerCase();

  if (["true", "1", "y", "yes", "예", "on"].includes(raw)) return true;
  if (["false", "0", "n", "no", "아니오", "off"].includes(raw)) return false;

  return fallback;
}

function parseNumberLike(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeVideoSource(value: unknown): "youtube" | "vimeo" | "server" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "vimeo") return "vimeo";
  if (raw === "server") return "server";
  return "youtube";
}

function slugifyKoreanSafe(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();

  return raw
    .replace(/[^a-z0-9가-힣\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeUniqueSlug(base: string, used: Set<string>) {
  const seed = slugifyKoreanSafe(base) || `course-${Date.now()}`;
  let next = seed;
  let i = 2;

  while (used.has(next)) {
    next = `${seed}-${i}`;
    i += 1;
  }

  used.add(next);
  return next;
}

function normalizeSequentialSortOrder<T extends { sort_order?: number | null }>(
  rows: T[]
) {
  return rows.map((row, index) => ({
    ...row,
    sort_order: index + 1,
  }));
}

function downloadCsvFile(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
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
          ? "border-b-2 border-red-400 px-1 pb-3 text-sm font-semibold text-red-400"
          : "px-1 pb-3 text-sm font-semibold text-gray-700"
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
      className={`rounded-full border px-4 py-2 text-xs font-semibold ${active ? activeCls : inactiveCls}`}
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
  const [showCoursesSection, setShowCoursesSection] = useState(false);
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
  const [pushDebugInfo, setPushDebugInfo] = useState<PushDebugInfo | null>(
    null
  );
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

  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [lessons, setLessons] = useState<ClassroomLesson[]>([]);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomMessage, setClassroomMessage] = useState("");
  const [classroomSavingCourseId, setClassroomSavingCourseId] = useState("");

  const [editingCourseId, setEditingCourseId] = useState("");
  const [savingCourseId, setSavingCourseId] = useState("");
  const [courseDrafts, setCourseDrafts] = useState<
    Record<
      string,
      {
        title: string;
        slug: string;
        level: string;
        description: string;
        status: "draft" | "open" | "coming";
        thumbnail_url: string;
      }
    >
  >({});

  const [editingLessonId, setEditingLessonId] = useState("");
  const [savingLessonId, setSavingLessonId] = useState("");
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, LessonDraft>>(
    {}
  );

  const [deleteConfirmLessonId, setDeleteConfirmLessonId] = useState("");
  const [deletingLessonId, setDeletingLessonId] = useState("");

  const [deleteConfirmCourseId, setDeleteConfirmCourseId] = useState("");
  const [deletingCourseId, setDeletingCourseId] = useState("");

  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseSlug, setNewCourseSlug] = useState("");
  const [newCourseLevel, setNewCourseLevel] = useState("입문");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseStatus, setNewCourseStatus] = useState<
    "draft" | "open" | "coming"
  >("draft");
  const [newCourseThumbnailUrl, setNewCourseThumbnailUrl] = useState("");

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");
  const [newLessonSortOrder, setNewLessonSortOrder] = useState(1);
  const [newLessonPreview, setNewLessonPreview] = useState(false);
  const [newLessonVideoSource, setNewLessonVideoSource] = useState<
    "youtube" | "vimeo" | "server"
  >("youtube");
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState("");
  const [newLessonEmbedUrl, setNewLessonEmbedUrl] = useState("");
  const [newLessonVideoSeconds, setNewLessonVideoSeconds] = useState(600);
  const [newLessonAttachmentUrl, setNewLessonAttachmentUrl] = useState("");
  const [newLessonAudioUrl, setNewLessonAudioUrl] = useState("");
  const [newLessonPosterUrl, setNewLessonPosterUrl] = useState("");

  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState("");
  const [memberCourseQuery, setMemberCourseQuery] = useState("");
  const [selectedEnrollmentUserId, setSelectedEnrollmentUserId] = useState("");
  const [userEnrollments, setUserEnrollments] = useState<CourseEnrollmentRow[]>(
    []
  );
  const [assigningCourseId, setAssigningCourseId] = useState("");
  const [removingEnrollmentId, setRemovingEnrollmentId] = useState("");

  const [courseCsvBusy, setCourseCsvBusy] = useState(false);
  const [courseCsvFile, setCourseCsvFile] = useState<File | null>(null);
  const [courseCsvPreview, setCourseCsvPreview] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    rows: Array<{
      title: string;
      slug: string;
      level: string;
      status: "draft" | "open" | "coming";
      sort_order: number;
    }>;
    invalidDetails: string[];
  } | null>(null);

  const [lessonCsvBusy, setLessonCsvBusy] = useState(false);
  const [lessonCsvFile, setLessonCsvFile] = useState<File | null>(null);
  const [lessonCsvPreview, setLessonCsvPreview] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    rows: Array<{
      title: string;
      sort_order: number;
      video_source: "youtube" | "vimeo" | "server";
      is_preview: boolean;
    }>;
    invalidDetails: string[];
  } | null>(null);

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
          Object.fromEntries(
            normalizedProfiles.map((item) => [item.id, item.plan])
          )
        );
        setDurationDrafts(
          Object.fromEntries(normalizedProfiles.map((item) => [item.id, 30]))
        );

        if (normalizedProfiles[0]?.id) {
          setSelectedMemberId(normalizedProfiles[0].id);
          setSelectedEnrollmentUserId(normalizedProfiles[0].id);
        }

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
          .select("show_my_classroom_section, show_courses_section")
          .eq("id", 1)
          .maybeSingle();

        if (pageError) {
          console.error(pageError);
        } else {
          setShowMyClassroomSection(Boolean(pageRow?.show_my_classroom_section));
          setShowCoursesSection(Boolean(pageRow?.show_courses_section));
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

  const filteredEnrollmentProfiles = useMemo(() => {
    const q = memberCourseQuery.trim().toLowerCase();
    const base = profiles.filter((item) => !!item.email);
    if (!q) return base.slice(0, 100);

    return base
      .filter((item) => {
        return (
          item.email.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          String(item.full_name || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 100);
  }, [profiles, memberCourseQuery]);

  const selectedPushProfile = useMemo(
    () => profiles.find((item) => item.id === selectedPushUserId) || null,
    [profiles, selectedPushUserId]
  );

  const selectedMember = useMemo(
    () => profiles.find((item) => item.id === selectedMemberId) || null,
    [profiles, selectedMemberId]
  );

  const selectedEnrollmentMember = useMemo(
    () => profiles.find((item) => item.id === selectedEnrollmentUserId) || null,
    [profiles, selectedEnrollmentUserId]
  );

  const selectedCourse = useMemo(
    () => courses.find((item) => item.id === selectedCourseId) || null,
    [courses, selectedCourseId]
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

  const enrolledCourseMap = useMemo(() => {
    return new Map(userEnrollments.map((item) => [item.course_id, item]));
  }, [userEnrollments]);

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

  const loadCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select(
        "id, slug, title, level, description, status, sort_order, is_visible, thumbnail_url"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (data || []) as ClassroomCourse[];
    setCourses(rows);

    setCourseDrafts(
      Object.fromEntries(
        rows.map((course) => [
          course.id,
          {
            title: course.title || "",
            slug: course.slug || "",
            level: course.level || "",
            description: course.description || "",
            status: course.status,
            thumbnail_url: course.thumbnail_url || "",
          },
        ])
      )
    );

    if (rows.length === 0) {
      setSelectedCourseId("");
      setLessons([]);
      return;
    }

    setSelectedCourseId((prev) => {
      const exists = rows.some((course) => course.id === prev);
      return exists ? prev : rows[0].id;
    });
  };

  const loadLessons = async (courseId: string) => {
    if (!courseId) {
      setLessons([]);
      return;
    }

    const { data, error } = await supabase
      .from("course_lessons")
      .select(`
        id,
        course_id,
        title,
        description,
        sort_order,
        is_preview,
        is_visible,
        video_source,
        video_url,
        video_embed_url,
        video_seconds,
        attachment_url,
        audio_url,
        poster_url
      `)
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (data || []) as ClassroomLesson[];
    setLessons(rows);
    setNewLessonSortOrder(rows.length + 1);

    setLessonDrafts(
      Object.fromEntries(
        rows.map((lesson) => [
          lesson.id,
          {
            title: lesson.title || "",
            description: lesson.description || "",
            sort_order: lesson.sort_order || 1,
            is_preview: Boolean(lesson.is_preview),
            is_visible: Boolean(lesson.is_visible),
            video_source: lesson.video_source || "youtube",
            video_url: lesson.video_url || "",
            video_embed_url: lesson.video_embed_url || "",
            video_seconds: Number(lesson.video_seconds || 0),
            attachment_url: lesson.attachment_url || "",
            audio_url: lesson.audio_url || "",
            poster_url: lesson.poster_url || "",
          },
        ])
      )
    );
  };

  const loadUserEnrollments = async (userId: string) => {
    if (!userId) {
      setUserEnrollments([]);
      return;
    }

    const { data, error } = await supabase
      .from("course_enrollments")
      .select(
        "id, user_id, course_id, progress, last_lesson_title, last_studied_at, is_completed"
      )
      .eq("user_id", userId)
      .order("last_studied_at", { ascending: false });

    if (error) throw error;

    setUserEnrollments((data || []) as CourseEnrollmentRow[]);
  };

  const handleDownloadCourseCsvSample = () => {
    const header =
      "title,slug,level,description,status,sort_order,thumbnail_url,is_visible";
    const rows = [
      '일본어 입문 코스,starter-japanese,입문,처음 시작하는 학습자를 위한 코스,open,1,https://example.com/course1.jpg,true',
      '패턴 회화 코스,pattern-speaking,N3~N2,자주 쓰는 패턴 중심 회화,coming,2,https://example.com/course2.jpg,true',
    ];

    downloadCsvFile("courses_sample.csv", [header, ...rows].join("\n"));
  };

  const handleDownloadLessonCsvSample = () => {
    const header =
      "title,description,sort_order,is_preview,is_visible,video_source,video_url,video_embed_url,video_seconds,attachment_url,audio_url,poster_url";
    const rows = [
      '1강 인사 표현,기본 인사와 자기소개,1,true,true,youtube,https://youtube.com/watch?v=aaa,https://www.youtube.com/embed/aaa,600,https://example.com/lesson1.pdf,https://example.com/lesson1.mp3,https://example.com/poster1.jpg',
      '2강 기본 회화,자주 쓰는 회화 패턴,2,false,true,youtube,https://youtube.com/watch?v=bbb,https://www.youtube.com/embed/bbb,720,https://example.com/lesson2.pdf,https://example.com/lesson2.mp3,https://example.com/poster2.jpg',
    ];

    downloadCsvFile("lessons_sample.csv", [header, ...rows].join("\n"));
  };

  const handlePreviewCoursesCsv = async (file: File) => {
    try {
      setCourseCsvBusy(true);
      setClassroomMessage("");
      setCourseCsvFile(file);
      setCourseCsvPreview(null);

      const rows = await readCsvFile<CourseCsvRow>(file);

      const existingSlugSet = new Set(
        courses.map((course) => String(course.slug || "").trim().toLowerCase())
      );

      const invalidDetails: string[] = [];

      const cleaned = rows.map((row, index) => {
        const title = String(row.title ?? "").trim();
        const rawSlug = String(row.slug ?? "").trim();
        const level = String(row.level ?? "").trim() || "입문";
        const description = String(row.description ?? "").trim();

        const rawStatus = String(row.status ?? "").trim().toLowerCase();
        const status =
          rawStatus === "open" || rawStatus === "coming" || rawStatus === "draft"
            ? rawStatus
            : "draft";

        if (!title) {
          invalidDetails.push(`${index + 1}행: title 없음`);
          return null;
        }

        const slug = makeUniqueSlug(rawSlug || title, existingSlugSet);

        return {
          title,
          slug,
          level,
          description,
          status: status as "draft" | "open" | "coming",
          sort_order: parseNumberLike(row.sort_order, index + 1),
          thumbnail_url: String(row.thumbnail_url ?? "").trim() || null,
          is_visible: parseBooleanLike(row.is_visible, true),
        };
      });

      const valid = cleaned.filter(Boolean) as Array<{
        title: string;
        slug: string;
        level: string;
        description: string;
        status: "draft" | "open" | "coming";
        sort_order: number;
        thumbnail_url: string | null;
        is_visible: boolean;
      }>;

      const normalized = normalizeSequentialSortOrder(
        valid.sort((a, b) => a.sort_order - b.sort_order)
      );

      setCourseCsvPreview({
        totalRows: rows.length,
        validRows: normalized.length,
        invalidRows: rows.length - normalized.length,
        rows: normalized.slice(0, 10).map((row) => ({
          title: row.title,
          slug: row.slug,
          level: row.level,
          status: row.status,
          sort_order: row.sort_order,
        })),
        invalidDetails: invalidDetails.slice(0, 10),
      });

      setClassroomMessage(
        `강의 CSV 미리보기 완료 · 전체 ${rows.length}행 / 유효 ${normalized.length}행 / 제외 ${rows.length - normalized.length}행`
      );
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 CSV 분석 중 오류가 발생했습니다."
      );
    } finally {
      setCourseCsvBusy(false);
    }
  };

  const handleImportCoursesCsv = async () => {
    if (!courseCsvFile) {
      setClassroomMessage("강의 CSV 파일을 먼저 선택해 주세요.");
      return;
    }

    try {
      setCourseCsvBusy(true);
      setClassroomMessage("");

      const rows = await readCsvFile<CourseCsvRow>(courseCsvFile);

      const existingSlugSet = new Set(
        courses.map((course) => String(course.slug || "").trim().toLowerCase())
      );

      const cleaned = rows
        .map((row, index) => {
          const title = String(row.title ?? "").trim();
          if (!title) return null;

          const rawSlug = String(row.slug ?? "").trim();
          const rawStatus = String(row.status ?? "").trim().toLowerCase();

          const status =
            rawStatus === "open" ||
            rawStatus === "coming" ||
            rawStatus === "draft"
              ? rawStatus
              : "draft";

          return {
            title,
            slug: makeUniqueSlug(rawSlug || title, existingSlugSet),
            level: String(row.level ?? "").trim() || "입문",
            description: String(row.description ?? "").trim(),
            status: status as "draft" | "open" | "coming",
            sort_order: parseNumberLike(row.sort_order, index + 1),
            thumbnail_url: String(row.thumbnail_url ?? "").trim() || null,
            is_visible: parseBooleanLike(row.is_visible, true),
          };
        })
        .filter(Boolean) as Array<{
        title: string;
        slug: string;
        level: string;
        description: string;
        status: "draft" | "open" | "coming";
        sort_order: number;
        thumbnail_url: string | null;
        is_visible: boolean;
      }>;

      const normalized = normalizeSequentialSortOrder(
        cleaned.sort((a, b) => a.sort_order - b.sort_order)
      );

      if (normalized.length === 0) {
        setClassroomMessage("업로드 가능한 강의 데이터가 없습니다.");
        return;
      }

      const { error } = await supabase.from("courses").insert(normalized);
      if (error) throw error;

      await loadCourses();
      setCourseCsvFile(null);
      setCourseCsvPreview(null);
      setClassroomMessage(`강의 CSV 업로드 완료 · ${normalized.length}건 추가`);
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 CSV 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setCourseCsvBusy(false);
    }
  };

  const handlePreviewLessonsCsv = async (file: File) => {
    if (!selectedCourseId) {
      setClassroomMessage("먼저 강의를 선택해 주세요.");
      return;
    }

    try {
      setLessonCsvBusy(true);
      setClassroomMessage("");
      setLessonCsvFile(file);
      setLessonCsvPreview(null);

      const rows = await readCsvFile<LessonCsvRow>(file);
      const invalidDetails: string[] = [];

      const cleaned = rows.map((row, index) => {
        const title = String(row.title ?? "").trim();

        if (!title) {
          invalidDetails.push(`${index + 1}행: title 없음`);
          return null;
        }

        return {
          title,
          description: String(row.description ?? "").trim(),
          sort_order: parseNumberLike(row.sort_order, index + 1),
          is_preview: parseBooleanLike(row.is_preview, false),
          is_visible: parseBooleanLike(row.is_visible, true),
          video_source: normalizeVideoSource(row.video_source),
          video_url: String(row.video_url ?? "").trim() || null,
          video_embed_url: String(row.video_embed_url ?? "").trim() || null,
          video_seconds: parseNumberLike(row.video_seconds, 0) || null,
          attachment_url: String(row.attachment_url ?? "").trim() || null,
          audio_url: String(row.audio_url ?? "").trim() || null,
          poster_url: String(row.poster_url ?? "").trim() || null,
        };
      });

      const valid = cleaned.filter(Boolean) as Array<{
        title: string;
        description: string;
        sort_order: number;
        is_preview: boolean;
        is_visible: boolean;
        video_source: "youtube" | "vimeo" | "server";
        video_url: string | null;
        video_embed_url: string | null;
        video_seconds: number | null;
        attachment_url: string | null;
        audio_url: string | null;
        poster_url: string | null;
      }>;

      const normalized = normalizeSequentialSortOrder(
        valid.sort((a, b) => a.sort_order - b.sort_order)
      );

      setLessonCsvPreview({
        totalRows: rows.length,
        validRows: normalized.length,
        invalidRows: rows.length - normalized.length,
        rows: normalized.slice(0, 10).map((row) => ({
          title: row.title,
          sort_order: row.sort_order,
          video_source: row.video_source,
          is_preview: row.is_preview,
        })),
        invalidDetails: invalidDetails.slice(0, 10),
      });

      setClassroomMessage(
        `레슨 CSV 미리보기 완료 · 전체 ${rows.length}행 / 유효 ${normalized.length}행 / 제외 ${rows.length - normalized.length}행`
      );
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 CSV 분석 중 오류가 발생했습니다."
      );
    } finally {
      setLessonCsvBusy(false);
    }
  };

  const handleImportLessonsCsv = async () => {
    if (!lessonCsvFile) {
      setClassroomMessage("레슨 CSV 파일을 먼저 선택해 주세요.");
      return;
    }

    if (!selectedCourseId) {
      setClassroomMessage("먼저 강의를 선택해 주세요.");
      return;
    }

    try {
      setLessonCsvBusy(true);
      setClassroomMessage("");

      const rows = await readCsvFile<LessonCsvRow>(lessonCsvFile);

      const cleaned = rows
        .map((row, index) => {
          const title = String(row.title ?? "").trim();
          if (!title) return null;

          return {
            course_id: selectedCourseId,
            title,
            description: String(row.description ?? "").trim(),
            sort_order: parseNumberLike(row.sort_order, index + 1),
            is_preview: parseBooleanLike(row.is_preview, false),
            is_visible: parseBooleanLike(row.is_visible, true),
            video_source: normalizeVideoSource(row.video_source),
            video_url: String(row.video_url ?? "").trim() || null,
            video_embed_url: String(row.video_embed_url ?? "").trim() || null,
            video_seconds: parseNumberLike(row.video_seconds, 0) || null,
            attachment_url: String(row.attachment_url ?? "").trim() || null,
            audio_url: String(row.audio_url ?? "").trim() || null,
            poster_url: String(row.poster_url ?? "").trim() || null,
          };
        })
        .filter(Boolean) as Array<{
        course_id: string;
        title: string;
        description: string;
        sort_order: number;
        is_preview: boolean;
        is_visible: boolean;
        video_source: "youtube" | "vimeo" | "server";
        video_url: string | null;
        video_embed_url: string | null;
        video_seconds: number | null;
        attachment_url: string | null;
        audio_url: string | null;
        poster_url: string | null;
      }>;

      const normalized = normalizeSequentialSortOrder(
        cleaned.sort((a, b) => a.sort_order - b.sort_order)
      );

      if (normalized.length === 0) {
        setClassroomMessage("업로드 가능한 레슨 데이터가 없습니다.");
        return;
      }

      const { error } = await supabase.from("course_lessons").insert(normalized);
      if (error) throw error;

      await loadLessons(selectedCourseId);
      setLessonCsvFile(null);
      setLessonCsvPreview(null);
      setClassroomMessage(`레슨 CSV 업로드 완료 · ${normalized.length}건 추가`);
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 CSV 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setLessonCsvBusy(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim() || !newCourseSlug.trim()) {
      setClassroomMessage("강의 제목과 slug를 입력해 주세요.");
      return;
    }

    try {
      setClassroomLoading(true);
      setClassroomMessage("");

      const { error } = await supabase.from("courses").insert({
        title: newCourseTitle.trim(),
        slug: newCourseSlug.trim(),
        level: newCourseLevel.trim() || "입문",
        description: newCourseDescription.trim(),
        status: newCourseStatus,
        sort_order: courses.length + 1,
        is_visible: true,
        thumbnail_url: newCourseThumbnailUrl.trim() || null,
      });

      if (error) throw error;

      setNewCourseTitle("");
      setNewCourseSlug("");
      setNewCourseLevel("입문");
      setNewCourseDescription("");
      setNewCourseStatus("draft");
      setNewCourseThumbnailUrl("");

      await loadCourses();
      setClassroomMessage("강의를 추가했습니다.");
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error ? error.message : "강의 추가 중 오류가 발생했습니다."
      );
    } finally {
      setClassroomLoading(false);
    }
  };

  const handleCreateLesson = async () => {
    if (!selectedCourseId) {
      setClassroomMessage("먼저 강의를 선택해 주세요.");
      return;
    }

    if (!newLessonTitle.trim()) {
      setClassroomMessage("레슨 제목을 입력해 주세요.");
      return;
    }

    try {
      setClassroomLoading(true);
      setClassroomMessage("");

      const { error } = await supabase.from("course_lessons").insert({
        course_id: selectedCourseId,
        title: newLessonTitle.trim(),
        description: newLessonDescription.trim(),
        sort_order: newLessonSortOrder,
        is_preview: newLessonPreview,
        is_visible: true,
        video_source: newLessonVideoSource,
        video_url: newLessonVideoUrl.trim() || null,
        video_embed_url: newLessonEmbedUrl.trim() || null,
        video_seconds: newLessonVideoSeconds || null,
        attachment_url: newLessonAttachmentUrl.trim() || null,
        audio_url: newLessonAudioUrl.trim() || null,
        poster_url: newLessonPosterUrl.trim() || null,
      });

      if (error) throw error;

      setNewLessonTitle("");
      setNewLessonDescription("");
      setNewLessonSortOrder(lessons.length + 1);
      setNewLessonPreview(false);
      setNewLessonVideoSource("youtube");
      setNewLessonVideoUrl("");
      setNewLessonEmbedUrl("");
      setNewLessonVideoSeconds(600);
      setNewLessonAttachmentUrl("");
      setNewLessonAudioUrl("");
      setNewLessonPosterUrl("");

      await loadLessons(selectedCourseId);
      setClassroomMessage("레슨을 추가했습니다.");
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error ? error.message : "레슨 추가 중 오류가 발생했습니다."
      );
    } finally {
      setClassroomLoading(false);
    }
  };

  const handleAssignCourseToUser = async (courseId: string) => {
    if (!selectedEnrollmentUserId) {
      setEnrollmentMessage("먼저 회원을 선택해 주세요.");
      return;
    }

    try {
      setAssigningCourseId(courseId);
      setEnrollmentMessage("");

      const alreadyAssigned = userEnrollments.some((item) => item.course_id === courseId);
      if (alreadyAssigned) {
        setEnrollmentMessage("이미 배정된 강의입니다.");
        return;
      }

      const { error } = await supabase.from("course_enrollments").insert({
        user_id: selectedEnrollmentUserId,
        course_id: courseId,
        progress: 0,
        is_completed: false,
        last_lesson_title: null,
        last_studied_at: null,
      });

      if (error) throw error;

      await loadUserEnrollments(selectedEnrollmentUserId);
      setEnrollmentMessage("강의를 회원에게 배정했습니다.");
    } catch (error) {
      console.error(error);
      setEnrollmentMessage(
        error instanceof Error ? error.message : "강의 배정 중 오류가 발생했습니다."
      );
    } finally {
      setAssigningCourseId("");
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    try {
      setRemovingEnrollmentId(enrollmentId);
      setEnrollmentMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";
      if (!accessToken) throw new Error("로그인 세션을 찾지 못했습니다.");

      const res = await fetch("/api/admin/course-enrollment/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ enrollmentId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "강의 배정 해제 중 오류가 발생했습니다.");
      }

      if (selectedEnrollmentUserId) {
        await loadUserEnrollments(selectedEnrollmentUserId);
      }

      setEnrollmentMessage("강의 배정을 해제했습니다.");
    } catch (error) {
      console.error(error);
      setEnrollmentMessage(
        error instanceof Error ? error.message : "강의 배정 해제 중 오류가 발생했습니다."
      );
    } finally {
      setRemovingEnrollmentId("");
    }
  };

  const handleUpdateCourseStatus = async (
    courseId: string,
    nextStatus: "draft" | "open" | "coming"
  ) => {
    try {
      setClassroomSavingCourseId(courseId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", courseId);

      if (error) throw error;

      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId ? { ...course, status: nextStatus } : course
        )
      );

      setCourseDrafts((prev) => ({
        ...prev,
        [courseId]: {
          ...prev[courseId],
          status: nextStatus,
        },
      }));

      setClassroomMessage(`강의 상태를 ${nextStatus}로 변경했습니다.`);
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 상태 변경 중 오류가 발생했습니다."
      );
    } finally {
      setClassroomSavingCourseId("");
    }
  };

  const handleCourseDraftChange = (
    courseId: string,
    key: "title" | "slug" | "level" | "description" | "status" | "thumbnail_url",
    value: string
  ) => {
    setCourseDrafts((prev) => ({
      ...prev,
      [courseId]: {
        ...prev[courseId],
        [key]: value,
      },
    }));
  };

  const handleSaveCourse = async (courseId: string) => {
    const draft = courseDrafts[courseId];
    if (!draft) return;

    if (!draft.title.trim() || !draft.slug.trim()) {
      setClassroomMessage("강의 제목과 slug는 비워둘 수 없습니다.");
      return;
    }

    try {
      setSavingCourseId(courseId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          title: draft.title.trim(),
          slug: draft.slug.trim(),
          level: draft.level.trim() || "입문",
          description: draft.description.trim(),
          status: draft.status,
          thumbnail_url: draft.thumbnail_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", courseId);

      if (error) throw error;

      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId
            ? {
                ...course,
                title: draft.title.trim(),
                slug: draft.slug.trim(),
                level: draft.level.trim() || "입문",
                description: draft.description.trim(),
                status: draft.status,
                thumbnail_url: draft.thumbnail_url.trim() || null,
              }
            : course
        )
      );

      setEditingCourseId("");
      setClassroomMessage("강의 정보를 저장했습니다.");

      await loadCourses();
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSavingCourseId("");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      setDeletingCourseId(courseId);
      setClassroomMessage("");

      const { error: lessonDeleteError } = await supabase
        .from("course_lessons")
        .delete()
        .eq("course_id", courseId);

      if (lessonDeleteError) throw lessonDeleteError;

      const { error: enrollmentDeleteError } = await supabase
        .from("course_enrollments")
        .delete()
        .eq("course_id", courseId);

      if (enrollmentDeleteError) throw enrollmentDeleteError;

      const { error: courseDeleteError } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);

      if (courseDeleteError) throw courseDeleteError;

      setCourses((prev) => prev.filter((course) => course.id !== courseId));

      setCourseDrafts((prev) => {
        const next = { ...prev };
        delete next[courseId];
        return next;
      });

      if (selectedCourseId === courseId) {
        const remainCourses = courses.filter((course) => course.id !== courseId);
        setSelectedCourseId(remainCourses[0]?.id || "");
        setLessons([]);
      }

      if (editingCourseId === courseId) {
        setEditingCourseId("");
      }

      if (deleteConfirmCourseId === courseId) {
        setDeleteConfirmCourseId("");
      }

      setClassroomMessage("강의를 삭제했습니다.");

      await loadCourses();
      if (selectedEnrollmentUserId) {
        await loadUserEnrollments(selectedEnrollmentUserId);
      }
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "강의 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setDeletingCourseId("");
    }
  };

  const handleLessonDraftChange = (
    lessonId: string,
    key:
      | "title"
      | "description"
      | "sort_order"
      | "is_preview"
      | "video_source"
      | "video_url"
      | "video_embed_url"
      | "video_seconds"
      | "attachment_url"
      | "audio_url"
      | "poster_url",
    value: string | number | boolean | null
  ) => {
    setLessonDrafts((prev) => ({
      ...prev,
      [lessonId]: {
        ...prev[lessonId],
        [key]: value,
      },
    }));
  };

  const handleSaveLesson = async (lessonId: string) => {
    const draft = lessonDrafts[lessonId];
    if (!draft) return;

    if (!draft.title.trim()) {
      setClassroomMessage("레슨 제목은 비워둘 수 없습니다.");
      return;
    }

    try {
      setSavingLessonId(lessonId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("course_lessons")
        .update({
          title: draft.title.trim(),
          description: draft.description.trim(),
          sort_order: Number(draft.sort_order || 1),
          is_preview: Boolean(draft.is_preview),
          video_source: draft.video_source,
          video_url: draft.video_url.trim() || null,
          video_embed_url: draft.video_embed_url.trim() || null,
          video_seconds: Number(draft.video_seconds || 0) || null,
          attachment_url: draft.attachment_url.trim() || null,
          audio_url: draft.audio_url.trim() || null,
          poster_url: draft.poster_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lessonId);

      if (error) throw error;

      setLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === lessonId
            ? {
                ...lesson,
                title: draft.title.trim(),
                description: draft.description.trim(),
                sort_order: Number(draft.sort_order || 1),
                is_preview: Boolean(draft.is_preview),
                video_source: draft.video_source,
                video_url: draft.video_url.trim() || null,
                video_embed_url: draft.video_embed_url.trim() || null,
                video_seconds: Number(draft.video_seconds || 0) || null,
                attachment_url: draft.attachment_url.trim() || null,
                audio_url: draft.audio_url.trim() || null,
                poster_url: draft.poster_url.trim() || null,
              }
            : lesson
        )
      );

      setEditingLessonId("");
      setClassroomMessage("레슨 정보를 저장했습니다.");

      if (selectedCourseId) {
        await loadLessons(selectedCourseId);
      }
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSavingLessonId("");
    }
  };

  const handleToggleLessonVisibility = async (
    lessonId: string,
    nextVisible: boolean
  ) => {
    try {
      setSavingLessonId(lessonId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("course_lessons")
        .update({
          is_visible: nextVisible,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lessonId);

      if (error) throw error;

      setLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === lessonId
            ? {
                ...lesson,
                is_visible: nextVisible,
              }
            : lesson
        )
      );

      setLessonDrafts((prev) => ({
        ...prev,
        [lessonId]: {
          ...prev[lessonId],
          is_visible: nextVisible,
        },
      }));

      setClassroomMessage(
        nextVisible ? "레슨을 표시 상태로 변경했습니다." : "레슨을 숨김 상태로 변경했습니다."
      );

      if (selectedCourseId) {
        await loadLessons(selectedCourseId);
      }
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 표시 상태 변경 중 오류가 발생했습니다."
      );
    } finally {
      setSavingLessonId("");
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      setDeletingLessonId(lessonId);
      setClassroomMessage("");

      const { error } = await supabase
        .from("course_lessons")
        .delete()
        .eq("id", lessonId);

      if (error) throw error;

      setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));

      setLessonDrafts((prev) => {
        const next = { ...prev };
        delete next[lessonId];
        return next;
      });

      if (editingLessonId === lessonId) {
        setEditingLessonId("");
      }

      if (deleteConfirmLessonId === lessonId) {
        setDeleteConfirmLessonId("");
      }

      setClassroomMessage("레슨을 삭제했습니다.");

      if (selectedCourseId) {
        await loadLessons(selectedCourseId);
      }
    } catch (error) {
      console.error(error);
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "레슨 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setDeletingLessonId("");
    }
  };

  useEffect(() => {
    if (tab !== "classroom") return;

    const run = async () => {
      try {
        setClassroomLoading(true);
        setClassroomMessage("");
        await loadCourses();
      } catch (error) {
        console.error(error);
        setClassroomMessage("강의 목록을 불러오지 못했습니다.");
      } finally {
        setClassroomLoading(false);
      }
    };

    void run();
  }, [tab]);

  useEffect(() => {
    if (tab !== "classroom") return;
    if (!selectedCourseId) return;

    const run = async () => {
      try {
        setClassroomLoading(true);
        await loadLessons(selectedCourseId);
      } catch (error) {
        console.error(error);
        setClassroomMessage("레슨 목록을 불러오지 못했습니다.");
      } finally {
        setClassroomLoading(false);
      }
    };

    void run();
  }, [tab, selectedCourseId]);

  useEffect(() => {
    if (tab !== "classroom") return;
    if (!selectedEnrollmentUserId) {
      setUserEnrollments([]);
      return;
    }

    const run = async () => {
      try {
        setEnrollmentsLoading(true);
        setEnrollmentMessage("");
        await loadUserEnrollments(selectedEnrollmentUserId);
      } catch (error) {
        console.error(error);
        setEnrollmentMessage("회원의 수강 강의 목록을 불러오지 못했습니다.");
      } finally {
        setEnrollmentsLoading(false);
      }
    };

    void run();
  }, [tab, selectedEnrollmentUserId]);

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
            show_courses_section: showCoursesSection,
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      setPageSettingsMessage("페이지 영역 설정을 저장했습니다.");
    } catch (error) {
      console.error(error);
      setPageSettingsMessage(
        error instanceof Error
          ? error.message
          : "페이지 영역 설정 저장 중 오류가 발생했습니다."
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
          //
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
        <div className="mx-auto max-w-4xl px-4 py-6">
          <p className="text-sm text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <p className="text-sm text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <section className="mt-4">
          <h1 className="text-2xl font-bold">🛠️ 관리자 대시보드</h1>
          <p className="mt-2 text-sm text-gray-600">회원/구독 관리 · 통계 · 기록</p>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["총 회원", stats.totalMembers, "현재 등록된 회원 수"],
            [
              "유료 회원",
              stats.paidMembers,
              `전체의 ${stats.totalMembers
                ? Math.round((stats.paidMembers / stats.totalMembers) * 100)
                : 0
              }%`,
            ],
            ["관리자", stats.adminMembers, "권한 보유 계정"],
            ["오늘 퀴즈", stats.todayQuiz, "오늘 기록된 시도 수"],
          ].map(([label, value, desc]) => (
            <div
              key={String(label)}
              className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold text-gray-500">{label}</p>
              <p className="mt-3 text-xl font-bold">{value}</p>
              <p className="mt-2 text-xs text-gray-600">{desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">플랜 분포</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["free", "light", "standard", "pro", "vip"] as PlanCode[]).map(
              (plan) => {
                const theme = getPlanTheme(plan);
                return (
                  <span
                    key={plan}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold ${theme.badge}`}
                  >
                    {getPlanBadge(plan)} {stats.planCounts[plan]}명
                  </span>
                );
              }
            )}
          </div>
        </section>

        <section className="mt-8 border-b border-gray-200">
          <div className="flex flex-wrap gap-5">
            <TabButton active={tab === "members"} onClick={() => setTab("members")} icon="👥" label="회원" />
            <TabButton active={tab === "stats"} onClick={() => setTab("stats")} icon="📊" label="통계" />
            <TabButton active={tab === "push"} onClick={() => setTab("push")} icon="🔔" label="푸시" />
            <TabButton active={tab === "logs"} onClick={() => setTab("logs")} icon="🕒" label="기록" />
            <TabButton active={tab === "app"} onClick={() => setTab("app")} icon="⚙️" label="앱 설정" />
            <TabButton active={tab === "classroom"} onClick={() => setTab("classroom")} icon="🎓" label="강의실 관리" />
            <TabButton active={tab === "backup"} onClick={() => setTab("backup")} icon="🗂️" label="백업·버전" />
          </div>
        </section>

        {tab === "members" ? (
          <section className="mt-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">회원 관리</h2>
              <p className="mt-2 text-sm text-gray-600">
                5단계 플랜 변경, 기록 정리, 학생 메시지 발송을 한 곳에서 관리합니다.
              </p>
            </div>

            <div className="mt-8">
              <label className="text-sm font-semibold text-gray-800">회원 검색</label>
              <input
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value);
                  setMemberMessage("");
                }}
                placeholder="이름/이메일/ID/플랜으로 검색"
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
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
                const theme = getPlanTheme(item.plan);

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl border bg-white p-5 shadow-sm ${selectedMemberId === item.id ? "border-red-300" : "border-gray-200"
                      }`}
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedMemberId(item.id)}
                        className="text-left"
                      >
                        <p className="text-lg font-bold">{item.email || "-"}</p>
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
                          <span className={`rounded-full border px-4 py-2 text-xs font-semibold ${theme.badge}`}>
                            {getPlanBadge(item.plan)}
                          </span>
                          <span className={`rounded-full border px-4 py-2 text-xs font-semibold ${theme.soft}`}>
                            {getPlanLabel(item.plan)}
                          </span>
                          {item.is_admin ? (
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700">
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
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
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
                                  ? "mt-2 w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-400 outline-none"
                                  : "mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
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
                              ? "inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                              : "inline-flex w-full items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
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
                <h3 className="text-xl font-bold">기록 정리</h3>
                <p className="mt-2 text-sm text-gray-600">
                  선택한 회원의 오래된 학습 기록을 정리합니다. 먼저 미리보기를 확인한 뒤 실행해 주세요.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-800">선택 회원</label>
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
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
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
                <label className="text-sm font-semibold text-gray-800">정리 기간</label>
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
                  <label className="text-xs font-semibold text-gray-700">직접 입력</label>
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
                      className="w-32 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                    <span className="text-sm text-gray-600">일 이전 기록 정리</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-800">정리 대상</label>
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
                  className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800"
                >
                  {cleanupBusy ? "확인 중..." : "정리 미리보기"}
                </button>

                <button
                  type="button"
                  onClick={handleCleanupRun}
                  disabled={cleanupBusy || !cleanupReadyToRun}
                  className={
                    cleanupBusy || !cleanupReadyToRun
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                      : "inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
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
                <h3 className="text-xl font-bold">학생에게 메시지 보내기</h3>
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
                <label className="text-sm font-semibold text-gray-800">제목</label>
                <input
                  value={memberMsgTitle}
                  onChange={(e) => {
                    setMemberMsgTitle(e.target.value);
                    setMemberMsgStatus("");
                    setMemberMsgProbeResult(null);
                  }}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-800">내용</label>
                <textarea
                  value={memberMsgBody}
                  onChange={(e) => {
                    setMemberMsgBody(e.target.value);
                    setMemberMsgStatus("");
                    setMemberMsgProbeResult(null);
                  }}
                  rows={4}
                  placeholder="학생에게 보낼 메시지를 입력하세요."
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-800">전송 대상</label>
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
                  <label className="text-sm font-semibold text-gray-800">플랜 선택</label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PLAN_OPTIONS.map((option) => {
                      const theme = getPlanTheme(option.value);
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
                              ? `rounded-full border px-4 py-2 text-xs font-semibold ${theme.badge}`
                              : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
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
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                      : "inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800"
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
                    ? "inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                    : "inline-flex w-full items-center justify-center rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
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
              <h2 className="text-xl font-bold">회원별 통계</h2>
              <p className="mt-2 text-sm text-gray-600">
                현재 기록을 기준으로 앱 사용 패턴을 간단히 봅니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-lg font-bold">단어 시도</p>
                <p className="mt-4 text-2xl font-bold text-blue-600">{stats.wordCount}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-lg font-bold">한자 시도</p>
                <p className="mt-4 text-2xl font-bold text-blue-600">{stats.kanjiCount}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-lg font-bold">회화 시도</p>
                <p className="mt-4 text-2xl font-bold text-blue-600">{stats.talkCount}</p>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "push" ? (
          <section className="mt-8 space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">🔔 푸시 알림 보내기</h2>
              <p className="mt-2 text-sm text-gray-600">
                테스트, 선택 회원, 전체 발송으로 나누어 알림을 보낼 수 있습니다.
              </p>
            </div>
            <div className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <label className="text-sm font-semibold text-gray-800">발송 방식</label>
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
                        ? "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                        : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-800"
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
                        ? "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                        : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-800"
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
                        ? "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                        : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-800"
                    }
                  >
                    전체 발송
                  </button>
                </div>
              </div>

              {pushMode === "selected" ? (
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-800">회원 검색</label>
                    <input
                      value={pushMemberQuery}
                      onChange={(e) => {
                        setPushMemberQuery(e.target.value);
                        setPushMessage("");
                        setPushDebugInfo(null);
                      }}
                      placeholder="이름/이메일/ID/플랜으로 검색"
                      className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-800">
                      발송할 회원
                    </label>
                    <select
                      value={selectedPushUserId}
                      onChange={(e) => {
                        setSelectedPushUserId(e.target.value);
                        setPushMessage("");
                        setPushDebugInfo(null);
                      }}
                      className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
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
                <label className="text-sm font-semibold text-gray-800">제목</label>
                <input
                  value={pushTitle}
                  onChange={(e) => {
                    setPushTitle(e.target.value);
                    setPushMessage("");
                    setPushDebugInfo(null);
                  }}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800">내용</label>
                <textarea
                  value={pushBody}
                  onChange={(e) => {
                    setPushBody(e.target.value);
                    setPushMessage("");
                    setPushDebugInfo(null);
                  }}
                  rows={4}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800">
                  클릭 이동 URL (선택)
                </label>
                <input
                  value={pushUrl}
                  onChange={(e) => {
                    setPushUrl(e.target.value);
                    setPushMessage("");
                    setPushDebugInfo(null);
                  }}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleProbePushTarget}
                  disabled={pushProbeBusy || (pushMode === "selected" && !selectedPushUserId)}
                  className={
                    pushProbeBusy || (pushMode === "selected" && !selectedPushUserId)
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                      : "inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800"
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
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                      : "inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
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
              <h2 className="text-xl font-bold">기록</h2>
              <p className="mt-2 text-sm text-gray-600">
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
                        ? "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                        : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-800"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <input
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder="이메일 / 레벨 / 유형 검색"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <label className="inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
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
                  <p className="text-lg font-bold">{item.user_email || "(이메일 없음)"}</p>
                  <p className="mt-2 text-sm text-gray-600">🕒 {formatDateTime(item.created_at)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                      {item.level || "-"}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                      {item.pos_mode || "-"}
                    </span>
                    <span className="rounded-full border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-gray-700">
                      ✅ {item.score}/{item.quiz_len}
                    </span>
                    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-gray-700">
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
                  <h2 className="text-xl font-bold">앱 설정</h2>
                  <p className="mt-2 text-sm text-gray-600">
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
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                  홈 카드 + 상단 메뉴 연동
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
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
                          <h3 className="text-lg font-bold text-gray-900">{item.label}</h3>
                          <span className={status.className}>{status.text}</span>
                        </div>
                        <p className="mt-3 text-sm text-gray-600">{item.desc}</p>
                      </div>

                      <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                        현재 최소 플랜: {getPlanBadge(minPlanValue)}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[160px_1fr]">
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
                                ? "rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                                : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
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
                                ? "rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white"
                                : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                            }
                          >
                            숨김
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-700">최소 플랜</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {PLAN_OPTIONS.map((option) => {
                            const theme = getPlanTheme(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  handleMenuToggle(item.planKey as keyof MenuSettings, option.value)
                                }
                                className={
                                  minPlanValue === option.value
                                    ? `rounded-full border px-4 py-2 text-xs font-semibold ${theme.badge}`
                                    : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                                }
                              >
                                {option.badge}
                              </button>
                            );
                          })}
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
                  <h3 className="text-lg font-bold">페이지 영역 공개 설정</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    마이페이지와 홈에서 아직 공개하지 않을 영역을 미리 만들어 두고, 준비가 끝났을 때만 노출할 수 있습니다.
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

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-gray-900">나의 강의실</h4>
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
                          ? "rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                          : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
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
                          ? "rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white"
                          : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                      }
                    >
                      숨김
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-gray-900">강의 카탈로그</h4>
                        <span
                          className={
                            showCoursesSection
                              ? "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                              : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
                          }
                        >
                          {showCoursesSection ? "표시 중" : "숨김 중"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-gray-600">
                        홈 화면에 강의 카탈로그 이동 블록을 노출합니다.
                      </p>
                    </div>

                    <div className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                      대상 페이지: HOME
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCoursesSection(true);
                        setPageSettingsMessage("");
                      }}
                      className={
                        showCoursesSection
                          ? "rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                          : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                      }
                    >
                      표시
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCoursesSection(false);
                        setPageSettingsMessage("");
                      }}
                      className={
                        !showCoursesSection
                          ? "rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white"
                          : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                      }
                    >
                      숨김
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    지금은 숨김으로 두고 내부 테스트만 한 뒤, 준비가 끝났을 때 표시로 바꾸면 됩니다.
                  </p>
                </div>

                {pageSettingsMessage ? (
                  <p className="text-sm text-gray-600">{pageSettingsMessage}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">미리보기</h3>
              <p className="mt-2 text-sm text-gray-600">
                현재 설정 기준으로 사용자 등급별로 어떤 메뉴가 보이는지 요약합니다.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {(["free", "light", "standard", "pro", "vip"] as PlanCode[]).map((previewPlan) => {
                  const theme = getPlanTheme(previewPlan);
                  return (
                    <div
                      key={previewPlan}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <p className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${theme.badge}`}>
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
                              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
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
                      ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                      : "inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
                  }
                >
                  {menuSaving ? "저장 중..." : "메뉴 설정 저장"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "classroom" ? (
          <section className="mt-8 space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">강의실 관리</h2>
              <p className="mt-2 text-sm text-gray-600">
                강의와 레슨을 직접 등록하고 관리합니다.
              </p>
              {classroomMessage ? (
                <p className="mt-4 text-sm text-gray-600">{classroomMessage}</p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">회원 강의 배정</h3>
              <p className="mt-2 text-sm text-gray-600">
                특정 회원에게 강의를 붙이거나 해제할 수 있습니다.
              </p>

              <div className="mt-4 grid gap-6 xl:grid-cols-[300px_1fr]">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-800">회원 검색</label>
                    <input
                      value={memberCourseQuery}
                      onChange={(e) => {
                        setMemberCourseQuery(e.target.value);
                        setEnrollmentMessage("");
                      }}
                      placeholder="이름 / 이메일 / ID 검색"
                      className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-800">회원 선택</label>
                    <select
                      value={selectedEnrollmentUserId}
                      onChange={(e) => {
                        setSelectedEnrollmentUserId(e.target.value);
                        setEnrollmentMessage("");
                      }}
                      className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="">회원 선택</option>
                      {filteredEnrollmentProfiles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.email} · {getPlanBadge(item.plan)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-800">선택 회원</p>
                    <p className="mt-2 text-sm text-gray-600">
                      {selectedEnrollmentMember?.email || "-"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {selectedEnrollmentMember?.full_name || "-"}
                    </p>
                  </div>

                  {enrollmentMessage ? (
                    <p className="text-sm text-gray-600">{enrollmentMessage}</p>
                  ) : null}
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-base font-bold text-gray-900">현재 배정된 강의</h4>

                    <div className="mt-3 space-y-3">
                      {!selectedEnrollmentUserId ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                          먼저 회원을 선택해 주세요.
                        </div>
                      ) : enrollmentsLoading ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                          불러오는 중...
                        </div>
                      ) : userEnrollments.length === 0 ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                          아직 배정된 강의가 없습니다.
                        </div>
                      ) : (
                        userEnrollments.map((enrollment) => {
                          const course = courses.find((c) => c.id === enrollment.course_id);
                          return (
                            <div
                              key={enrollment.id}
                              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-bold text-gray-900">
                                    {course?.title || enrollment.course_id}
                                  </p>
                                  <p className="mt-1 text-sm text-gray-600">
                                    진도율 {enrollment.progress}% ·{" "}
                                    {enrollment.is_completed ? "완료" : "진행 중"}
                                  </p>
                                  <p className="mt-1 text-sm text-gray-500">
                                    최근 학습: {enrollment.last_lesson_title || "-"}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveEnrollment(enrollment.id)}
                                  disabled={removingEnrollmentId === enrollment.id}
                                  className={
                                    removingEnrollmentId === enrollment.id
                                      ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-400"
                                      : "rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                                  }
                                >
                                  {removingEnrollmentId === enrollment.id ? "해제 중..." : "배정 해제"}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-gray-900">강의 배정하기</h4>

                    <div className="mt-3 space-y-3">
                      {courses.length === 0 ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                          등록된 강의가 없습니다.
                        </div>
                      ) : (
                        courses.map((course) => {
                          const already = enrolledCourseMap.has(course.id);

                          return (
                            <div
                              key={course.id}
                              className="rounded-2xl border border-gray-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{course.title}</p>
                                  <p className="mt-1 text-sm text-gray-600">
                                    {course.level} · {course.status}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAssignCourseToUser(course.id)}
                                  disabled={
                                    !selectedEnrollmentUserId ||
                                    already ||
                                    assigningCourseId === course.id
                                  }
                                  className={
                                    !selectedEnrollmentUserId || already || assigningCourseId === course.id
                                      ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-400"
                                      : "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                                  }
                                >
                                  {already
                                    ? "배정됨"
                                    : assigningCourseId === course.id
                                      ? "배정 중..."
                                      : "강의 배정"}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold">강의 추가</h3>

                <div className="mt-4 space-y-4">
                  <input
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder="강의 제목"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                  />
                  <input
                    value={newCourseSlug}
                    onChange={(e) => setNewCourseSlug(e.target.value)}
                    placeholder="slug 예: starter-patterns"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                  />
                  <input
                    value={newCourseLevel}
                    onChange={(e) => setNewCourseLevel(e.target.value)}
                    placeholder="레벨 예: 입문 / N3~N2"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                  />
                  <textarea
                    value={newCourseDescription}
                    onChange={(e) => setNewCourseDescription(e.target.value)}
                    rows={4}
                    placeholder="강의 설명"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                  />
                  <input
                    value={newCourseThumbnailUrl}
                    onChange={(e) => setNewCourseThumbnailUrl(e.target.value)}
                    placeholder="썸네일 이미지 URL"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                  />
                  <select
                    value={newCourseStatus}
                    onChange={(e) =>
                      setNewCourseStatus(e.target.value as "draft" | "open" | "coming")
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                  >
                    <option value="draft">draft</option>
                    <option value="open">open</option>
                    <option value="coming">coming</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleCreateCourse}
                    disabled={classroomLoading}
                    className={
                      classroomLoading
                        ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                        : "inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
                    }
                  >
                    {classroomLoading ? "처리 중..." : "강의 추가"}
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">CSV로 강의 한꺼번에 추가</p>
                      <p className="mt-1 text-xs text-gray-500">
                        title, slug, level, description, status, sort_order, thumbnail_url, is_visible
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadCourseCsvSample}
                      className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800"
                    >
                      샘플 다운로드
                    </button>
                  </div>

                  <div className="mt-4">
                    <label className="inline-flex cursor-pointer rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800">
                      CSV 선택
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          await handlePreviewCoursesCsv(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {courseCsvFile ? (
                    <p className="mt-3 text-sm text-gray-600">선택 파일: {courseCsvFile.name}</p>
                  ) : null}

                  {courseCsvPreview ? (
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-semibold text-gray-900">
                        미리보기 · 전체 {courseCsvPreview.totalRows}행 / 유효 {courseCsvPreview.validRows}행 / 제외 {courseCsvPreview.invalidRows}행
                      </p>

                      <div className="mt-3 space-y-2">
                        {courseCsvPreview.rows.map((row, idx) => (
                          <div
                            key={`${row.slug}-${idx}`}
                            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                          >
                            {row.sort_order}. {row.title} / {row.slug} / {row.level} / {row.status}
                          </div>
                        ))}
                      </div>

                      {courseCsvPreview.invalidDetails.length > 0 ? (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                          <p className="text-sm font-semibold text-red-700">제외된 행</p>
                          <div className="mt-2 space-y-1">
                            {courseCsvPreview.invalidDetails.map((item, idx) => (
                              <p key={`${item}-${idx}`} className="text-xs text-red-600">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleImportCoursesCsv}
                          disabled={courseCsvBusy}
                          className={
                            courseCsvBusy
                              ? "rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                              : "rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                          }
                        >
                          {courseCsvBusy ? "업로드 중..." : "미리보기 확인 후 강의 반영"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCourseCsvFile(null);
                            setCourseCsvPreview(null);
                          }}
                          className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                        >
                          초기화
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold">강의 목록</h3>

                <div className="mt-4 space-y-3">
                  {courses.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                      아직 등록된 강의가 없습니다.
                    </div>
                  ) : (
                    courses.map((course) => {
                      const draft = courseDrafts[course.id];

                      return (
                        <div
                          key={course.id}
                          className={`rounded-2xl border p-4 ${selectedCourseId === course.id
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-gray-50"
                            }`}
                        >
                          {editingCourseId === course.id && draft ? (
                            <div className="space-y-3">
                              <input
                                value={draft.title}
                                onChange={(e) =>
                                  handleCourseDraftChange(course.id, "title", e.target.value)
                                }
                                placeholder="강의 제목"
                                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                              />

                              <input
                                value={draft.slug}
                                onChange={(e) =>
                                  handleCourseDraftChange(course.id, "slug", e.target.value)
                                }
                                placeholder="slug"
                                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                              />

                              <input
                                value={draft.level}
                                onChange={(e) =>
                                  handleCourseDraftChange(course.id, "level", e.target.value)
                                }
                                placeholder="레벨"
                                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                              />

                              <textarea
                                value={draft.description}
                                onChange={(e) =>
                                  handleCourseDraftChange(course.id, "description", e.target.value)
                                }
                                rows={3}
                                placeholder="강의 설명"
                                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                              />

                              <input
                                value={draft.thumbnail_url}
                                onChange={(e) =>
                                  handleCourseDraftChange(course.id, "thumbnail_url", e.target.value)
                                }
                                placeholder="썸네일 이미지 URL"
                                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                              />

                              <select
                                value={draft.status}
                                onChange={(e) =>
                                  handleCourseDraftChange(
                                    course.id,
                                    "status",
                                    e.target.value as "draft" | "open" | "coming"
                                  )
                                }
                                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                              >
                                <option value="draft">draft</option>
                                <option value="coming">coming</option>
                                <option value="open">open</option>
                              </select>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveCourse(course.id)}
                                  disabled={savingCourseId === course.id || deletingCourseId === course.id}
                                  className={
                                    savingCourseId === course.id
                                      ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-400"
                                      : "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                                  }
                                >
                                  {savingCourseId === course.id ? "저장 중..." : "저장"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setEditingCourseId("")}
                                  disabled={deletingCourseId === course.id}
                                  className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-700"
                                >
                                  취소
                                </button>

                                {deleteConfirmCourseId === course.id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCourse(course.id)}
                                    disabled={deletingCourseId === course.id}
                                    className={
                                      deletingCourseId === course.id
                                        ? "rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-xs font-semibold text-red-300"
                                        : "rounded-2xl bg-red-500 px-4 py-3 text-xs font-semibold text-white"
                                    }
                                  >
                                    {deletingCourseId === course.id ? "삭제 중..." : "정말 삭제"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmCourseId(course.id)}
                                    disabled={deletingCourseId === course.id}
                                    className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                                  >
                                    삭제
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <button
                                type="button"
                                onClick={() => setSelectedCourseId(course.id)}
                                className="w-full text-left"
                              >
                                {course.thumbnail_url ? (
                                  <img
                                    src={course.thumbnail_url}
                                    alt={course.title}
                                    className="mb-3 h-24 w-full rounded-2xl object-cover"
                                  />
                                ) : null}

                                <p className="text-sm font-bold text-gray-900">{course.title}</p>
                                <p className="mt-1 text-sm text-gray-600">
                                  {course.slug} · {course.level}
                                </p>
                              </button>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                                  현재 상태: {course.status}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateCourseStatus(course.id, "draft")}
                                  disabled={classroomSavingCourseId === course.id || deletingCourseId === course.id}
                                  className={
                                    course.status === "draft"
                                      ? "rounded-full bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white"
                                      : "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                                  }
                                >
                                  draft
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateCourseStatus(course.id, "coming")}
                                  disabled={classroomSavingCourseId === course.id || deletingCourseId === course.id}
                                  className={
                                    course.status === "coming"
                                      ? "rounded-full bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white"
                                      : "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                                  }
                                >
                                  coming
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateCourseStatus(course.id, "open")}
                                  disabled={classroomSavingCourseId === course.id || deletingCourseId === course.id}
                                  className={
                                    course.status === "open"
                                      ? "rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"
                                      : "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                                  }
                                >
                                  open
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCourseId(course.id);
                                    setDeleteConfirmCourseId("");
                                  }}
                                  disabled={deletingCourseId === course.id}
                                  className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                                >
                                  수정
                                </button>

                                {deleteConfirmCourseId === course.id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCourse(course.id)}
                                    disabled={deletingCourseId === course.id}
                                    className={
                                      deletingCourseId === course.id
                                        ? "rounded-2xl border border-red-200 bg-red-100 px-4 py-2 text-xs font-semibold text-red-300"
                                        : "rounded-2xl bg-red-500 px-4 py-2 text-xs font-semibold text-white"
                                    }
                                  >
                                    {deletingCourseId === course.id ? "삭제 중..." : "정말 삭제"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmCourseId(course.id)}
                                    disabled={deletingCourseId === course.id}
                                    className="rounded-2xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-600"
                                  >
                                    삭제
                                  </button>
                                )}

                                {classroomSavingCourseId === course.id ? (
                                  <span className="text-xs text-gray-500">저장 중...</span>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">레슨 추가</h3>
              <p className="mt-2 text-sm text-gray-600">
                선택한 강의에 레슨을 추가합니다.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                현재 선택 강의: {selectedCourse?.title || "-"}
              </p>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <input
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="레슨 제목"
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <input
                  type="number"
                  value={newLessonSortOrder}
                  onChange={(e) => setNewLessonSortOrder(Number(e.target.value || 1))}
                  placeholder="정렬 순서"
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <textarea
                  value={newLessonDescription}
                  onChange={(e) => setNewLessonDescription(e.target.value)}
                  rows={3}
                  placeholder="레슨 설명"
                  className="xl:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <select
                  value={newLessonVideoSource}
                  onChange={(e) =>
                    setNewLessonVideoSource(e.target.value as "youtube" | "vimeo" | "server")
                  }
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                >
                  <option value="youtube">youtube</option>
                  <option value="vimeo">vimeo</option>
                  <option value="server">server</option>
                </select>
                <input
                  value={newLessonVideoUrl}
                  onChange={(e) => setNewLessonVideoUrl(e.target.value)}
                  placeholder="원본 영상 URL"
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <input
                  value={newLessonEmbedUrl}
                  onChange={(e) => setNewLessonEmbedUrl(e.target.value)}
                  placeholder="embed URL"
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <input
                  type="number"
                  value={newLessonVideoSeconds}
                  onChange={(e) => setNewLessonVideoSeconds(Number(e.target.value || 0))}
                  placeholder="영상 길이(초)"
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <input
                  value={newLessonAttachmentUrl}
                  onChange={(e) => setNewLessonAttachmentUrl(e.target.value)}
                  placeholder="첨부자료 URL"
                  className="xl:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <input
                  value={newLessonAudioUrl}
                  onChange={(e) => setNewLessonAudioUrl(e.target.value)}
                  placeholder="음성 MP3 URL"
                  className="xl:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
                <input
                  value={newLessonPosterUrl}
                  onChange={(e) => setNewLessonPosterUrl(e.target.value)}
                  placeholder="포스터 이미지 URL"
                  className="xl:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                />

                <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={newLessonPreview}
                    onChange={(e) => setNewLessonPreview(e.target.checked)}
                    className="h-4 w-4"
                  />
                  미리보기 레슨
                </label>
              </div>

              <button
                type="button"
                onClick={handleCreateLesson}
                disabled={classroomLoading || !selectedCourseId}
                className={
                  classroomLoading || !selectedCourseId
                    ? "mt-5 inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                    : "mt-5 inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
                }
              >
                {classroomLoading ? "처리 중..." : "레슨 추가"}
              </button>

              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">CSV로 레슨 한꺼번에 추가</p>
                    <p className="mt-1 text-xs text-gray-500">
                      title, description, sort_order, is_preview, is_visible, video_source, video_url, video_embed_url, video_seconds, attachment_url, audio_url, poster_url
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadLessonCsvSample}
                    className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800"
                  >
                    샘플 다운로드
                  </button>
                </div>

                <div className="mt-4">
                  <label className="inline-flex cursor-pointer rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800">
                    CSV 선택
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await handlePreviewLessonsCsv(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {lessonCsvFile ? (
                  <p className="mt-3 text-sm text-gray-600">선택 파일: {lessonCsvFile.name}</p>
                ) : null}

                {lessonCsvPreview ? (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-sm font-semibold text-gray-900">
                      미리보기 · 전체 {lessonCsvPreview.totalRows}행 / 유효 {lessonCsvPreview.validRows}행 / 제외 {lessonCsvPreview.invalidRows}행
                    </p>

                    <div className="mt-3 space-y-2">
                      {lessonCsvPreview.rows.map((row, idx) => (
                        <div
                          key={`${row.title}-${idx}`}
                          className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                        >
                          {row.sort_order}. {row.title} / {row.video_source} / {row.is_preview ? "미리보기" : "일반"}
                        </div>
                      ))}
                    </div>

                    {lessonCsvPreview.invalidDetails.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                        <p className="text-sm font-semibold text-red-700">제외된 행</p>
                        <div className="mt-2 space-y-1">
                          {lessonCsvPreview.invalidDetails.map((item, idx) => (
                            <p key={`${item}-${idx}`} className="text-xs text-red-600">
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleImportLessonsCsv}
                        disabled={lessonCsvBusy || !selectedCourseId}
                        className={
                          lessonCsvBusy || !selectedCourseId
                            ? "rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                            : "rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                        }
                      >
                        {lessonCsvBusy ? "업로드 중..." : "미리보기 확인 후 레슨 반영"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLessonCsvFile(null);
                          setLessonCsvPreview(null);
                        }}
                        className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                      >
                        초기화
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">선택 강의의 레슨 목록</h3>

              <div className="mt-4 space-y-3">
                {lessons.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    표시할 레슨이 없습니다.
                  </div>
                ) : (
                  lessons.map((lesson) => {
                    const draft = lessonDrafts[lesson.id];

                    return (
                      <div
                        key={lesson.id}
                        className={`rounded-2xl border p-4 ${
                          lesson.is_visible
                            ? "border-gray-200 bg-gray-50"
                            : "border-red-200 bg-red-50/60"
                        }`}
                      >
                        {editingLessonId === lesson.id && draft ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={
                                  draft.is_visible
                                    ? "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                                    : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
                                }
                              >
                                {draft.is_visible ? "표시 중" : "숨김 중"}
                              </span>
                            </div>

                            <input
                              value={draft.title}
                              onChange={(e) =>
                                handleLessonDraftChange(lesson.id, "title", e.target.value)
                              }
                              placeholder="레슨 제목"
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                            />

                            <textarea
                              value={draft.description}
                              onChange={(e) =>
                                handleLessonDraftChange(lesson.id, "description", e.target.value)
                              }
                              rows={3}
                              placeholder="레슨 설명"
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                            />

                            <div className="grid gap-3 lg:grid-cols-2">
                              <input
                                type="number"
                                value={draft.sort_order}
                                onChange={(e) =>
                                  handleLessonDraftChange(
                                    lesson.id,
                                    "sort_order",
                                    Number(e.target.value || 1)
                                  )
                                }
                                placeholder="정렬 순서"
                                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                              />

                              <input
                                type="number"
                                value={draft.video_seconds}
                                onChange={(e) =>
                                  handleLessonDraftChange(
                                    lesson.id,
                                    "video_seconds",
                                    Number(e.target.value || 0)
                                  )
                                }
                                placeholder="영상 길이(초)"
                                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                              />
                            </div>

                            <select
                              value={draft.video_source || "youtube"}
                              onChange={(e) =>
                                handleLessonDraftChange(
                                  lesson.id,
                                  "video_source",
                                  e.target.value as "youtube" | "vimeo" | "server"
                                )
                              }
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                            >
                              <option value="youtube">youtube</option>
                              <option value="vimeo">vimeo</option>
                              <option value="server">server</option>
                            </select>

                            <input
                              value={draft.video_url}
                              onChange={(e) =>
                                handleLessonDraftChange(lesson.id, "video_url", e.target.value)
                              }
                              placeholder="원본 영상 URL"
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                            />

                            <input
                              value={draft.video_embed_url}
                              onChange={(e) =>
                                handleLessonDraftChange(
                                  lesson.id,
                                  "video_embed_url",
                                  e.target.value
                                )
                              }
                              placeholder="embed URL"
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                            />

                            <input
                              value={draft.attachment_url}
                              onChange={(e) =>
                                handleLessonDraftChange(
                                  lesson.id,
                                  "attachment_url",
                                  e.target.value
                                )
                              }
                              placeholder="첨부자료 URL"
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                            />

                            <input
                              value={draft.audio_url}
                              onChange={(e) =>
                                handleLessonDraftChange(lesson.id, "audio_url", e.target.value)
                              }
                              placeholder="음성 MP3 URL"
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                            />

                            <input
                              value={draft.poster_url}
                              onChange={(e) =>
                                handleLessonDraftChange(lesson.id, "poster_url", e.target.value)
                              }
                              placeholder="포스터 이미지 URL"
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                            />

                            <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
                              <input
                                type="checkbox"
                                checked={draft.is_preview}
                                onChange={(e) =>
                                  handleLessonDraftChange(
                                    lesson.id,
                                    "is_preview",
                                    e.target.checked
                                  )
                                }
                                className="h-4 w-4"
                              />
                              미리보기 레슨
                            </label>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleLessonVisibility(lesson.id, !lesson.is_visible)
                                }
                                disabled={savingLessonId === lesson.id}
                                className={
                                  lesson.is_visible
                                    ? "rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                                    : "rounded-2xl border border-green-300 bg-white px-4 py-3 text-xs font-semibold text-green-700"
                                }
                              >
                                {lesson.is_visible ? "숨김으로 변경" : "표시로 변경"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSaveLesson(lesson.id)}
                                disabled={savingLessonId === lesson.id || deletingLessonId === lesson.id}
                                className={
                                  savingLessonId === lesson.id
                                    ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-400"
                                    : "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                                }
                              >
                                {savingLessonId === lesson.id ? "저장 중..." : "저장"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingLessonId("")}
                                disabled={deletingLessonId === lesson.id}
                                className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-700"
                              >
                                취소
                              </button>

                              {deleteConfirmLessonId === lesson.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                  disabled={deletingLessonId === lesson.id}
                                  className={
                                    deletingLessonId === lesson.id
                                      ? "rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-xs font-semibold text-red-300"
                                      : "rounded-2xl bg-red-500 px-4 py-3 text-xs font-semibold text-white"
                                  }
                                >
                                  {deletingLessonId === lesson.id ? "삭제 중..." : "정말 삭제"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmLessonId(lesson.id)}
                                  disabled={deletingLessonId === lesson.id}
                                  className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            {lesson.poster_url ? (
                              <img
                                src={lesson.poster_url}
                                alt={lesson.title}
                                className="mb-3 h-24 w-full rounded-2xl object-cover"
                              />
                            ) : null}

                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">{lesson.title}</p>
                              <span
                                className={
                                  lesson.is_visible
                                    ? "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                                    : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
                                }
                              >
                                {lesson.is_visible ? "표시 중" : "숨김 중"}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-gray-600">
                              순서 {lesson.sort_order} · {lesson.video_source || "-"} ·{" "}
                              {lesson.is_preview ? "미리보기" : "일반"}
                            </p>
                            <p className="mt-2 text-sm text-gray-600">{lesson.description}</p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLessonId(lesson.id);
                                  setDeleteConfirmLessonId("");
                                }}
                                className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-700"
                              >
                                수정
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleLessonVisibility(lesson.id, !lesson.is_visible)
                                }
                                disabled={savingLessonId === lesson.id || deletingLessonId === lesson.id}
                                className={
                                  lesson.is_visible
                                    ? "rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                                    : "rounded-2xl border border-green-300 bg-white px-4 py-3 text-xs font-semibold text-green-700"
                                }
                              >
                                {savingLessonId === lesson.id
                                  ? "처리 중..."
                                  : lesson.is_visible
                                    ? "숨김"
                                    : "표시"}
                              </button>

                              {deleteConfirmLessonId === lesson.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                  disabled={deletingLessonId === lesson.id}
                                  className={
                                    deletingLessonId === lesson.id
                                      ? "rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-xs font-semibold text-red-300"
                                      : "rounded-2xl bg-red-500 px-4 py-3 text-xs font-semibold text-white"
                                  }
                                >
                                  {deletingLessonId === lesson.id ? "삭제 중..." : "정말 삭제"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmLessonId(lesson.id)}
                                  disabled={deletingLessonId === lesson.id}
                                  className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "backup" ? (
          <section className="mt-8 space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">백업·버전</h2>
              <p className="mt-2 text-sm text-gray-600">
                현재 핵심 파일을 ZIP으로 백업하는 흐름을 정리하는 자리입니다.
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <label className="text-sm font-semibold text-gray-800">버전 태그</label>
              <input
                value={backupTag}
                onChange={(e) => {
                  setBackupTag(e.target.value);
                  setBackupMessage("");
                }}
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
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
                    ? "mt-6 inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                    : "mt-6 inline-flex rounded-2xl bg-red-500 px-6 py-3 text-sm font-semibold text-white"
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