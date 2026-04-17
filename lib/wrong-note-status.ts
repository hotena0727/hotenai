import { supabase } from "@/lib/supabase";

export type WrongNoteStatusRow = {
  id?: string;
  user_id: string;
  app: "kanji" | "word" | "katsuyou" | "talk";
  item_key: string;
  qtype: string;
  level?: string;
  status: "active" | "cleared";
  clear_count: number;
  clear_days: string[];
  last_wrong_at?: string | null;
  last_correct_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

function todayKstDateString(): string {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function normalizeClearDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  ).sort();
}

export async function activateKanjiWrongItems(params: {
  userId: string;
  items: Array<{
    item_key: string;
    qtype: string;
    level?: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, items } = params;

  if (!userId) return { ok: false, error: "userId가 없습니다." };
  if (!items.length) return { ok: true };

  try {
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const itemKey = String(item.item_key || "").trim();
      const qtype = String(item.qtype || "").trim();
      const level = String(item.level || "").trim();

      if (!itemKey || !qtype) continue;

      const payload = {
        user_id: userId,
        app: "kanji",
        item_key: itemKey,
        qtype,
        level,
        status: "active" as const,
        clear_count: 0,
        clear_days: [],
        last_wrong_at: nowIso,
      };

      const { error } = await supabase
        .from("wrong_note_status")
        .upsert(payload, {
          onConflict: "user_id,app,item_key,qtype",
        });

      if (error) {
        console.error(error);
        return { ok: false, error: error.message || "오답 active 처리 실패" };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "오답 active 처리 중 예외 발생" };
  }
}

export async function clearKanjiWrongItemsByReview(params: {
  userId: string;
  items: Array<{
    item_key: string;
    qtype: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, items } = params;

  if (!userId) return { ok: false, error: "userId가 없습니다." };
  if (!items.length) return { ok: true };

  try {
    const today = todayKstDateString();
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const itemKey = String(item.item_key || "").trim();
      const qtype = String(item.qtype || "").trim();

      if (!itemKey || !qtype) continue;

      const { data, error } = await supabase
        .from("wrong_note_status")
        .select(
          "id, user_id, app, item_key, qtype, level, status, clear_count, clear_days, last_wrong_at, last_correct_at, created_at, updated_at"
        )
        .eq("user_id", userId)
        .eq("app", "kanji")
        .eq("item_key", itemKey)
        .eq("qtype", qtype)
        .maybeSingle();

      if (error) {
        console.error(error);
        return { ok: false, error: error.message || "오답 상태 조회 실패" };
      }

      if (!data) {
        continue;
      }

      const clearDays = normalizeClearDays(data.clear_days);
      const alreadyCountedToday = clearDays.includes(today);
      const nextClearDays = alreadyCountedToday
        ? clearDays
        : [...clearDays, today].sort();

      const nextClearCount = nextClearDays.length;
      const nextStatus = nextClearCount >= 2 ? "cleared" : "active";

      const { error: updateError } = await supabase
        .from("wrong_note_status")
        .update({
          clear_days: nextClearDays,
          clear_count: nextClearCount,
          status: nextStatus,
          last_correct_at: nowIso,
        })
        .eq("id", data.id);

      if (updateError) {
        console.error(updateError);
        return {
          ok: false,
          error: updateError.message || "오답 상태 갱신 실패",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "오답 cleared 처리 중 예외 발생" };
  }
}

export async function fetchActiveKanjiWrongKeys(
  userId: string
): Promise<Set<string>> {
  if (!userId) return new Set();

  try {
    const { data, error } = await supabase
      .from("wrong_note_status")
      .select("item_key, qtype")
      .eq("user_id", userId)
      .eq("app", "kanji")
      .eq("status", "active");

    if (error) {
      console.error(error);
      return new Set();
    }

    const keys = new Set<string>();

    for (const row of data ?? []) {
      const itemKey = String(row.item_key || "").trim();
      const qtype = String(row.qtype || "").trim();
      if (!itemKey || !qtype) continue;
      keys.add(`kanji|${qtype}|${itemKey}`);
    }

    return keys;
  } catch (error) {
    console.error(error);
    return new Set();
  }
}

export async function activateWordWrongItems(params: {
  userId: string;
  items: Array<{
    item_key: string;
    qtype: string;
    level?: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, items } = params;

  if (!userId) return { ok: false, error: "userId가 없습니다." };
  if (!items.length) return { ok: true };

  try {
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const itemKey = String(item.item_key || "").trim();
      const qtype = String(item.qtype || "").trim();
      const level = String(item.level || "").trim();

      if (!itemKey || !qtype) continue;

      const payload = {
        user_id: userId,
        app: "word" as const,
        item_key: itemKey,
        qtype,
        level,
        status: "active" as const,
        clear_count: 0,
        clear_days: [],
        last_wrong_at: nowIso,
      };

      const { error } = await supabase
        .from("wrong_note_status")
        .upsert(payload, {
          onConflict: "user_id,app,item_key,qtype",
        });

      if (error) {
        console.error(error);
        return {
          ok: false,
          error: error.message || "단어 오답 active 처리 실패",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "단어 오답 active 처리 중 예외 발생" };
  }
}

export async function clearWordWrongItemsByReview(params: {
  userId: string;
  items: Array<{
    item_key: string;
    qtype: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, items } = params;

  if (!userId) return { ok: false, error: "userId가 없습니다." };
  if (!items.length) return { ok: true };

  try {
    const today = todayKstDateString();
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const itemKey = String(item.item_key || "").trim();
      const qtype = String(item.qtype || "").trim();

      if (!itemKey || !qtype) continue;

      const { data, error } = await supabase
        .from("wrong_note_status")
        .select(
          "id, user_id, app, item_key, qtype, level, status, clear_count, clear_days, last_wrong_at, last_correct_at, created_at, updated_at"
        )
        .eq("user_id", userId)
        .eq("app", "word")
        .eq("item_key", itemKey)
        .eq("qtype", qtype)
        .maybeSingle();

      if (error) {
        console.error(error);
        return {
          ok: false,
          error: error.message || "단어 오답 상태 조회 실패",
        };
      }

      if (!data) {
        continue;
      }

      const clearDays = normalizeClearDays(data.clear_days);
      const alreadyCountedToday = clearDays.includes(today);
      const nextClearDays = alreadyCountedToday
        ? clearDays
        : [...clearDays, today].sort();

      const nextClearCount = nextClearDays.length;
      const nextStatus = nextClearCount >= 2 ? "cleared" : "active";

      const { error: updateError } = await supabase
        .from("wrong_note_status")
        .update({
          clear_days: nextClearDays,
          clear_count: nextClearCount,
          status: nextStatus,
          last_correct_at: nowIso,
        })
        .eq("id", data.id);

      if (updateError) {
        console.error(updateError);
        return {
          ok: false,
          error: updateError.message || "단어 오답 상태 갱신 실패",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "단어 오답 cleared 처리 중 예외 발생" };
  }
}

export async function fetchActiveWordWrongKeys(
  userId: string
): Promise<Set<string>> {
  if (!userId) return new Set();

  try {
    const { data, error } = await supabase
      .from("wrong_note_status")
      .select("item_key, qtype")
      .eq("user_id", userId)
      .eq("app", "word")
      .eq("status", "active");

    if (error) {
      console.error(error);
      return new Set();
    }

    const keys = new Set<string>();

    for (const row of data ?? []) {
      const itemKey = String(row.item_key || "").trim();
      const qtype = String(row.qtype || "").trim();
      if (!itemKey || !qtype) continue;
      keys.add(`word|${qtype}|${itemKey}`);
    }

    return keys;
  } catch (error) {
    console.error(error);
    return new Set();
  }
}

export async function activateKatsuyouWrongItems(params: {
  userId: string;
  items: Array<{
    item_key: string;
    qtype: string;
    level?: string;
    form_key?: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, items } = params;

  if (!userId) return { ok: false, error: "userId가 없습니다." };
  if (!items.length) return { ok: true };

  try {
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const baseItemKey = String(item.item_key || "").trim();
      const formKey = String(item.form_key || "").trim();
      const mergedItemKey = `${baseItemKey}|||${formKey}`;
      const qtype = String(item.qtype || "").trim();
      const level = String(item.level || "").trim();

      if (!baseItemKey || !formKey || !qtype) continue;

      const payload = {
        user_id: userId,
        app: "katsuyou" as const,
        item_key: mergedItemKey,
        qtype,
        level,
        status: "active" as const,
        clear_count: 0,
        clear_days: [],
        last_wrong_at: nowIso,
      };

      const { error } = await supabase
        .from("wrong_note_status")
        .upsert(payload, {
          onConflict: "user_id,app,item_key,qtype",
        });

      if (error) {
        console.error(error);
        return {
          ok: false,
          error: error.message || "활용 오답 active 처리 실패",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "활용 오답 active 처리 중 예외 발생" };
  }
}

export async function clearKatsuyouWrongItemsByReview(params: {
  userId: string;
  items: Array<{
    item_key: string;
    qtype: string;
    form_key?: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, items } = params;

  if (!userId) return { ok: false, error: "userId가 없습니다." };
  if (!items.length) return { ok: true };

  try {
    const today = todayKstDateString();
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const baseItemKey = String(item.item_key || "").trim();
      const formKey = String(item.form_key || "").trim();
      const mergedItemKey = `${baseItemKey}|||${formKey}`;
      const qtype = String(item.qtype || "").trim();

      if (!baseItemKey || !formKey || !qtype) continue;

      const { data, error } = await supabase
        .from("wrong_note_status")
        .select(
          "id, user_id, app, item_key, qtype, level, status, clear_count, clear_days, last_wrong_at, last_correct_at, created_at, updated_at"
        )
        .eq("user_id", userId)
        .eq("app", "katsuyou")
        .eq("item_key", mergedItemKey)
        .eq("qtype", qtype)
        .maybeSingle();

      if (error) {
        console.error(error);
        return {
          ok: false,
          error: error.message || "활용 오답 상태 조회 실패",
        };
      }

      if (!data) continue;

      const clearDays = normalizeClearDays(data.clear_days);
      const alreadyCountedToday = clearDays.includes(today);
      const nextClearDays = alreadyCountedToday
        ? clearDays
        : [...clearDays, today].sort();

      const nextClearCount = nextClearDays.length;
      const nextStatus = nextClearCount >= 2 ? "cleared" : "active";

      const { error: updateError } = await supabase
        .from("wrong_note_status")
        .update({
          clear_days: nextClearDays,
          clear_count: nextClearCount,
          status: nextStatus,
          last_correct_at: nowIso,
        })
        .eq("id", data.id);

      if (updateError) {
        console.error(updateError);
        return {
          ok: false,
          error: updateError.message || "활용 오답 상태 갱신 실패",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "활용 오답 cleared 처리 중 예외 발생" };
  }
}

export async function fetchActiveKatsuyouWrongKeys(
  userId: string
): Promise<Set<string>> {
  if (!userId) return new Set();

  try {
    const { data, error } = await supabase
      .from("wrong_note_status")
      .select("item_key, qtype")
      .eq("user_id", userId)
      .eq("app", "katsuyou")
      .eq("status", "active");

    if (error) {
      console.error(error);
      return new Set();
    }

    const keys = new Set<string>();

    for (const row of data ?? []) {
      const mergedItemKey = String(row.item_key || "").trim();
      const qtype = String(row.qtype || "").trim();
      if (!mergedItemKey || !qtype) continue;
      keys.add(`katsuyou|${qtype}|${mergedItemKey}`);
    }

    return keys;
  } catch (error) {
    console.error(error);
    return new Set();
  }
}

export async function activateTalkWrongItems(params: {
  userId: string;
  items: Array<{
    item_key: string;
    qtype: string;
    level?: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, items } = params;

  if (!userId) return { ok: false, error: "userId가 없습니다." };
  if (!items.length) return { ok: true };

  try {
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const itemKey = String(item.item_key || "").trim();
      const qtype = String(item.qtype || "").trim();
      const level = String(item.level || "").trim();

      if (!itemKey || !qtype) continue;

      const payload = {
        user_id: userId,
        app: "talk" as const,
        item_key: itemKey,
        qtype,
        level,
        status: "active" as const,
        clear_count: 0,
        clear_days: [],
        last_wrong_at: nowIso,
      };

      const { error } = await supabase
        .from("wrong_note_status")
        .upsert(payload, {
          onConflict: "user_id,app,item_key,qtype",
        });

      if (error) {
        console.error(error);
        return {
          ok: false,
          error: error.message || "회화 오답 active 처리 실패",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "회화 오답 active 처리 중 예외 발생" };
  }
}

export async function clearTalkWrongItemsByReview(params: {
  userId: string;
  items: Array<{
    item_key: string;
    qtype: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, items } = params;

  if (!userId) return { ok: false, error: "userId가 없습니다." };
  if (!items.length) return { ok: true };

  try {
    const today = todayKstDateString();
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const itemKey = String(item.item_key || "").trim();
      const qtype = String(item.qtype || "").trim();

      if (!itemKey || !qtype) continue;

      const { data, error } = await supabase
        .from("wrong_note_status")
        .select(
          "id, user_id, app, item_key, qtype, level, status, clear_count, clear_days, last_wrong_at, last_correct_at, created_at, updated_at"
        )
        .eq("user_id", userId)
        .eq("app", "talk")
        .eq("item_key", itemKey)
        .eq("qtype", qtype)
        .maybeSingle();

      if (error) {
        console.error(error);
        return {
          ok: false,
          error: error.message || "회화 오답 상태 조회 실패",
        };
      }

      if (!data) {
        continue;
      }

      const clearDays = normalizeClearDays(data.clear_days);
      const alreadyCountedToday = clearDays.includes(today);
      const nextClearDays = alreadyCountedToday
        ? clearDays
        : [...clearDays, today].sort();

      const nextClearCount = nextClearDays.length;
      const nextStatus = nextClearCount >= 2 ? "cleared" : "active";

      const { error: updateError } = await supabase
        .from("wrong_note_status")
        .update({
          clear_days: nextClearDays,
          clear_count: nextClearCount,
          status: nextStatus,
          last_correct_at: nowIso,
        })
        .eq("id", data.id);

      if (updateError) {
        console.error(updateError);
        return {
          ok: false,
          error: updateError.message || "회화 오답 상태 갱신 실패",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "회화 오답 cleared 처리 중 예외 발생" };
  }
}

export async function fetchActiveTalkWrongKeys(
  userId: string
): Promise<Set<string>> {
  if (!userId) return new Set();

  try {
    const { data, error } = await supabase
      .from("wrong_note_status")
      .select("item_key, qtype")
      .eq("user_id", userId)
      .eq("app", "talk")
      .eq("status", "active");

    if (error) {
      console.error(error);
      return new Set();
    }

    const keys = new Set<string>();

    for (const row of data ?? []) {
      const itemKey = String(row.item_key || "").trim();
      const qtype = String(row.qtype || "").trim();
      if (!itemKey || !qtype) continue;
      keys.add(`talk|${qtype}|${itemKey}`);
    }

    return keys;
  } catch (error) {
    console.error(error);
    return new Set();
  }
}