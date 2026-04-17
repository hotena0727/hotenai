import { createClient } from "@supabase/supabase-js";

type QuizAttemptRow = {
  id?: string;
  user_id: string;
  wrong_list?: any[];
};

type WrongNoteInsertRow = {
  user_id: string;
  app: "kanji" | "word" | "katsuyou" | "talk";
  item_key: string;
  qtype: string;
  level?: string;
  status: "active";
  clear_count: number;
  clear_days: string[];
  last_wrong_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 없습니다."
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function buildWordRows(attempt: QuizAttemptRow, nowIso: string): WrongNoteInsertRow[] {
  const wrongs = Array.isArray(attempt.wrong_list) ? attempt.wrong_list : [];

  return wrongs
    .map((item) => {
      const itemKey = normalizeString(item?.item_key || item?.jp_word);
      const qtype = normalizeString(item?.qtype);
      const level = normalizeString(item?.level);

      if (!itemKey || !qtype) return null;

      return {
        user_id: attempt.user_id,
        app: "word" as const,
        item_key: itemKey,
        qtype,
        level,
        status: "active" as const,
        clear_count: 0,
        clear_days: [],
        last_wrong_at: nowIso,
      };
    })
    .filter(Boolean) as WrongNoteInsertRow[];
}

function buildKanjiRows(attempt: QuizAttemptRow, nowIso: string): WrongNoteInsertRow[] {
  const wrongs = Array.isArray(attempt.wrong_list) ? attempt.wrong_list : [];

  return wrongs
    .map((item) => {
      const itemKey = normalizeString(item?.item_key || item?.jp_word || item?.kanji);
      const qtype = normalizeString(item?.qtype);
      const level = normalizeString(item?.level);

      if (!itemKey || !qtype) return null;

      return {
        user_id: attempt.user_id,
        app: "kanji" as const,
        item_key: itemKey,
        qtype,
        level,
        status: "active" as const,
        clear_count: 0,
        clear_days: [],
        last_wrong_at: nowIso,
      };
    })
    .filter(Boolean) as WrongNoteInsertRow[];
}

function buildKatsuyouRows(attempt: QuizAttemptRow, nowIso: string): WrongNoteInsertRow[] {
  const wrongs = Array.isArray(attempt.wrong_list) ? attempt.wrong_list : [];

  return wrongs
    .map((item) => {
      const baseItemKey = normalizeString(item?.item_key || item?.jp_word);
      const formKey = normalizeString(item?.form_key);
      const qtype = normalizeString(item?.qtype);
      const level = normalizeString(item?.level);

      if (!baseItemKey || !formKey || !qtype) return null;

      return {
        user_id: attempt.user_id,
        app: "katsuyou" as const,
        item_key: `${baseItemKey}|||${formKey}`,
        qtype,
        level,
        status: "active" as const,
        clear_count: 0,
        clear_days: [],
        last_wrong_at: nowIso,
      };
    })
    .filter(Boolean) as WrongNoteInsertRow[];
}

function buildTalkRows(attempt: QuizAttemptRow, nowIso: string): WrongNoteInsertRow[] {
  const wrongs = Array.isArray(attempt.wrong_list) ? attempt.wrong_list : [];

  return wrongs
    .map((item) => {
      const itemKey = normalizeString(item?.item_key || item?.qid);
      const qtype = normalizeString(item?.qtype || "choice");
      const level = normalizeString(item?.level);

      if (!itemKey || !qtype) return null;

      return {
        user_id: attempt.user_id,
        app: "talk" as const,
        item_key: itemKey,
        qtype,
        level,
        status: "active" as const,
        clear_count: 0,
        clear_days: [],
        last_wrong_at: nowIso,
      };
    })
    .filter(Boolean) as WrongNoteInsertRow[];
}

async function fetchAttemptsByPrefix(prefix: string): Promise<QuizAttemptRow[]> {
  const allRows: QuizAttemptRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("id, user_id, wrong_list")
      .ilike("pos_mode", `${prefix}%`)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as QuizAttemptRow[];
    allRows.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function upsertWrongNoteRows(rows: WrongNoteInsertRow[]) {
  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("wrong_note_status")
    .upsert(rows, {
      onConflict: "user_id,app,item_key,qtype",
    });

  if (error) {
    throw error;
  }

  return rows.length;
}

async function main() {
  const nowIso = new Date().toISOString();

  console.log("백필 시작");

  const [wordAttempts, kanjiAttempts, katsuyouAttempts, talkAttempts] =
    await Promise.all([
      fetchAttemptsByPrefix("단어"),
      fetchAttemptsByPrefix("한자"),
      fetchAttemptsByPrefix("활용"),
      fetchAttemptsByPrefix("회화"),
    ]);

  console.log("단어 attempt 수:", wordAttempts.length);
  console.log("한자 attempt 수:", kanjiAttempts.length);
  console.log("활용 attempt 수:", katsuyouAttempts.length);
  console.log("회화 attempt 수:", talkAttempts.length);

  const wordRows = wordAttempts.flatMap((attempt) => buildWordRows(attempt, nowIso));
  const kanjiRows = kanjiAttempts.flatMap((attempt) => buildKanjiRows(attempt, nowIso));
  const katsuyouRows = katsuyouAttempts.flatMap((attempt) =>
    buildKatsuyouRows(attempt, nowIso)
  );
  const talkRows = talkAttempts.flatMap((attempt) => buildTalkRows(attempt, nowIso));

  console.log("단어 오답 row 수:", wordRows.length);
  console.log("한자 오답 row 수:", kanjiRows.length);
  console.log("활용 오답 row 수:", katsuyouRows.length);
  console.log("회화 오답 row 수:", talkRows.length);

  const total = await Promise.all([
    upsertWrongNoteRows(wordRows),
    upsertWrongNoteRows(kanjiRows),
    upsertWrongNoteRows(katsuyouRows),
    upsertWrongNoteRows(talkRows),
  ]);

  console.log("업서트 완료:", {
    word: total[0],
    kanji: total[1],
    katsuyou: total[2],
    talk: total[3],
  });

  console.log("백필 완료");
}

main().catch((error) => {
  console.error("백필 실패:", error);
  process.exit(1);
});