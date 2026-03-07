import { supabase } from "@/lib/supabase";

export type RecentTurn = {
  qid: string;
  situation_kr: string;
  partner_jp: string;
  selected: string;
  correct: string;
  ok: boolean | null;
};

export type DailyState = {
  date: string;
  key: string;
  stage: string;
  tag: string;
  sub: string;
  set_qids: string[];
  idx: number;
};

export type AppProgress = {
  recent_turns?: RecentTurn[];
  daily_state?: DailyState | Record<string, DailyState>;
  attempts?: number;
  correct?: number;
  wrongs?: number;
  last_set?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProgressAll = {
  talk?: AppProgress;
  word?: AppProgress;
  kanji?: AppProgress;
  [key: string]: unknown;
};

const EMPTY_RECENT_TURN: RecentTurn = {
  qid: "",
  situation_kr: "",
  partner_jp: "",
  selected: "",
  correct: "",
  ok: null,
};

export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

export async function loadProgressAll(userId?: string): Promise<ProgressAll> {
  const uid = userId || (await getCurrentUserId());
  if (!uid) return {};

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("progress")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      console.error(error);
      return {};
    }

    const progress = data?.progress;
    if (!progress || typeof progress !== "object") return {};
    return progress as ProgressAll;
  } catch (error) {
    console.error(error);
    return {};
  }
}

export async function saveProgressAll(
  progressAll: ProgressAll,
  userId?: string
): Promise<boolean> {
  const uid = userId || (await getCurrentUserId());
  if (!uid) return false;

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ progress: progressAll })
      .eq("id", uid);

    if (error) {
      console.error(error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function loadAppProgress<T extends AppProgress = AppProgress>(
  appKey: "talk" | "word" | "kanji",
  userId?: string
): Promise<T> {
  const all = await loadProgressAll(userId);
  const appProgress = all?.[appKey];
  if (!appProgress || typeof appProgress !== "object") {
    return {} as T;
  }
  return appProgress as T;
}

export async function saveAppProgress(
  appKey: "talk" | "word" | "kanji",
  appProgress: AppProgress,
  userId?: string
): Promise<boolean> {
  const all = await loadProgressAll(userId);
  const nextAll: ProgressAll = {
    ...all,
    [appKey]: appProgress,
  };
  return saveProgressAll(nextAll, userId);
}

export function ensureRecentTurns(turns: unknown): RecentTurn[] {
  let list = Array.isArray(turns) ? turns.filter(Boolean) : [];
  list = list.filter((item): item is Partial<RecentTurn> => typeof item === "object" && item !== null);

  const normalized: RecentTurn[] = list.map((item) => ({
    qid: String(item.qid || ""),
    situation_kr: String(item.situation_kr || ""),
    partner_jp: String(item.partner_jp || ""),
    selected: String(item.selected || ""),
    correct: String(item.correct || ""),
    ok:
      item.ok === true ? true : item.ok === false ? false : null,
  }));

  while (normalized.length < 2) {
    normalized.unshift({ ...EMPTY_RECENT_TURN });
  }

  return normalized.slice(-2);
}

export async function loadRecentTurns(
  appKey: "talk" | "word" | "kanji" = "talk",
  userId?: string
): Promise<RecentTurn[]> {
  const appProgress = await loadAppProgress(appKey, userId);
  return ensureRecentTurns(appProgress.recent_turns);
}

export async function saveRecentTurns(
  turns: RecentTurn[],
  appKey: "talk" | "word" | "kanji" = "talk",
  userId?: string
): Promise<boolean> {
  const appProgress = await loadAppProgress(appKey, userId);
  const nextProgress: AppProgress = {
    ...appProgress,
    recent_turns: ensureRecentTurns(turns),
  };
  return saveAppProgress(appKey, nextProgress, userId);
}

export async function pushRecentTurn(
  turn: Partial<RecentTurn>,
  appKey: "talk" | "word" | "kanji" = "talk",
  userId?: string
): Promise<boolean> {
  const current = await loadRecentTurns(appKey, userId);
  const nextTurn: RecentTurn = {
    qid: String(turn.qid || ""),
    situation_kr: String(turn.situation_kr || ""),
    partner_jp: String(turn.partner_jp || ""),
    selected: String(turn.selected || ""),
    correct: String(turn.correct || ""),
    ok: turn.ok === true ? true : turn.ok === false ? false : null,
  };

  const next = [...current, nextTurn];
  return saveRecentTurns(next, appKey, userId);
}

export function todayKST(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function loadDailyState(
  appKey: "talk" | "word" | "kanji" = "talk",
  userId?: string
): Promise<DailyState | null> {
  const appProgress = await loadAppProgress(appKey, userId);
  const ds = appProgress.daily_state;

  if (!ds || typeof ds !== "object" || Array.isArray(ds)) return null;

  const state = ds as Partial<DailyState>;

  if (String(state.date || "") !== todayKST()) return null;
  if (!Array.isArray(state.set_qids) || state.set_qids.length === 0) return null;

  return {
    date: String(state.date || ""),
    key: String(state.key || ""),
    stage: String(state.stage || ""),
    tag: String(state.tag || ""),
    sub: String(state.sub || ""),
    set_qids: state.set_qids.map((x) => String(x)),
    idx: Number.isFinite(Number(state.idx)) ? Number(state.idx) : 0,
  };
}

export async function saveDailyState(
  state: DailyState,
  appKey: "talk" | "word" | "kanji" = "talk",
  userId?: string
): Promise<boolean> {
  const appProgress = await loadAppProgress(appKey, userId);
  const nextProgress: AppProgress = {
    ...appProgress,
    daily_state: {
      ...state,
      date: state.date || todayKST(),
      set_qids: Array.isArray(state.set_qids)
        ? state.set_qids.map((x) => String(x))
        : [],
      idx: Number.isFinite(Number(state.idx)) ? Number(state.idx) : 0,
    },
  };
  return saveAppProgress(appKey, nextProgress, userId);
}

export async function clearDailyState(
  appKey: "talk" | "word" | "kanji" = "talk",
  userId?: string
): Promise<boolean> {
  const appProgress = await loadAppProgress(appKey, userId);
  const nextProgress: AppProgress = { ...appProgress };
  delete nextProgress.daily_state;
  return saveAppProgress(appKey, nextProgress, userId);
}