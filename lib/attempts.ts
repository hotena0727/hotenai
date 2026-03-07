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
};

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
      .select("id, created_at, user_id, user_email, level, pos_mode, quiz_len, score, wrong_count, wrong_list")
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
      .select("id, created_at, user_id, user_email, level, pos_mode, quiz_len, score, wrong_count, wrong_list")
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
      .select("id, created_at, user_id, user_email, level, pos_mode, quiz_len, score, wrong_count, wrong_list")
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