import type {
  WordQuestion,
  WordWrongItem,
  WordAttemptPayload,
} from "@/app/types/word";

type RawWrongItem = {
  jp_word: string;
  selected: string;
  correct: string;
};

function normalizeLevel(level?: string | null): string {
  return String(level || "").trim().toUpperCase();
}

function inferWordAttemptLevel(
  questions: WordQuestion[],
  explicitLevel?: string
): string {
  const normalizedExplicit = normalizeLevel(explicitLevel);
  if (normalizedExplicit) return normalizedExplicit;

  const levels = Array.from(
    new Set(questions.map((q) => normalizeLevel(q.level)).filter(Boolean))
  );

  if (levels.length === 1) return levels[0];
  return "";
}

export function buildWordWrongList(
  wrongList: RawWrongItem[],
  questions: WordQuestion[]
): WordWrongItem[] {
  return wrongList.map((item) => {
    const row = questions.find((q) => q.jp_word === item.jp_word);

    return {
      app: "word",
      qtype: row?.qtype || "meaning",
      item_key: row?.jp_word || item.jp_word,
      jp_word: row?.jp_word || item.jp_word,
      reading: row?.reading || "",
      meaning_kr: row?.meaning || "",
      pos: row?.pos || "",
      level: normalizeLevel(row?.level || ""),
      selected: item.selected,
      correct: item.correct,
      example_jp: row?.example_jp || "",
      example_kr: row?.example_kr || "",
    };
  });
}

export function buildWordAttemptPayload(params: {
  user_id: string;
  user_email?: string;
  level?: string;
  pos_mode: string;
  quiz_len: number;
  score: number;
  wrongList: RawWrongItem[];
  questions: WordQuestion[];
}): WordAttemptPayload {
  const wrong_list = buildWordWrongList(params.wrongList, params.questions);
  const resolvedLevel = inferWordAttemptLevel(params.questions, params.level);
  const question_keys = params.questions.map((q) => q.jp_word);

  return {
    user_id: params.user_id,
    user_email: params.user_email ?? "",
    level: resolvedLevel,
    pos_mode: params.pos_mode,
    quiz_len: Number(params.quiz_len || 0),
    score: Number(params.score || 0),
    wrong_count: wrong_list.length,
    wrong_list,
    question_keys,
  };
}