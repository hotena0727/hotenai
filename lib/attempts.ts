import { supabase } from "@/lib/supabase";

export type QuizAttemptRow = {
  id?: string;
  created_at?: string;
  user_id: string;
  user_email?: string;
  level?: string;
  pos_mode?: string;
  quiz_len?: number;
  score?: number;
  wrong_count?: number;
  wrong_list?: unknown[];
  question_keys?: string[];
};

export type SaveQuizAttemptInput = {
  user_id: string;
  user_email?: string;
  level?: string;
  pos_mode?: string;
  quiz_len?: number;
  score?: number;
  wrong_count?: number;
  wrong_list?: unknown[];
  question_keys?: string[];
};

function getKstDayRange(): { startIso: string; endIso: string } {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  const startUtcMs =
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 9 * 60 * 60 * 1000;
  const endUtcMs =
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 9 * 60 * 60 * 1000;

  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

export async function saveQuizAttempt(
  payload: SaveQuizAttemptInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const row: QuizAttemptRow = {
      user_id: payload.user_id,
      user_email: payload.user_email ?? "",
      level: payload.level ?? "",
      pos_mode: payload.pos_mode ?? "",
      quiz_len: Number(payload.quiz_len ?? 0),
      score: Number(payload.score ?? 0),
      wrong_count: Number(payload.wrong_count ?? 0),
      wrong_list: Array.isArray(payload.wrong_list) ? payload.wrong_list : [],
      question_keys: Array.isArray(payload.question_keys)
        ? payload.question_keys
        : [],
    };

    const { error } = await supabase.from("quiz_attempts").insert(row);

    if (error) {
      console.error(error);
      return { ok: false, error: error.message || "quiz_attempts 저장 실패" };
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "quiz_attempts 저장 중 예외 발생" };
  }
}

export async function fetchRecentAttempts(
  userId: string,
  limit = 5
): Promise<QuizAttemptRow[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(
        "id, created_at, user_id, user_email, level, pos_mode, quiz_len, score, wrong_count, wrong_list, question_keys"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(error);
      return [];
    }

    return (data ?? []) as QuizAttemptRow[];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function fetchAllAttempts(
  userId: string,
  limit = 300
): Promise<QuizAttemptRow[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(
        "id, created_at, user_id, user_email, level, pos_mode, quiz_len, score, wrong_count, wrong_list, question_keys"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(error);
      return [];
    }

    return (data ?? []) as QuizAttemptRow[];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function fetchAttemptsByPrefix(
  userId: string,
  posModePrefix: string,
  limit = 50
): Promise<QuizAttemptRow[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(
        "id, created_at, user_id, user_email, level, pos_mode, quiz_len, score, wrong_count, wrong_list, question_keys"
      )
      .eq("user_id", userId)
      .like("pos_mode", `${posModePrefix}%`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(error);
      return [];
    }

    return (data ?? []) as QuizAttemptRow[];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function fetchTodayBasicQuizSetCount(
  userId: string
): Promise<number> {
  if (!userId) return 0;

  try {
    const { startIso, endIso } = getKstDayRange();

    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("id, created_at, pos_mode")
      .eq("user_id", userId)
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    if (error) {
      console.error(error);
      return 0;
    }

    const rows = (data ?? []) as Array<{ pos_mode?: string | null }>;

    return rows.filter((row) => {
      const mode = String(row.pos_mode || "").trim();
      return (
        mode.startsWith("단어") ||
        mode.startsWith("한자") ||
        mode.startsWith("활용")
      );
    }).length;
  } catch (error) {
    console.error(error);
    return 0;
  }
}