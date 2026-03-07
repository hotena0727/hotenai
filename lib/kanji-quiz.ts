import type { KanjiQType, KanjiQuestion, KanjiRow } from "@/types/kanji";

const QUIZ_SET_SIZE = 10;

function shuffleArray<T>(arr: T[]): T[] {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

export function makeKanjiQuestion(
  row: KanjiRow,
  qtype: KanjiQType,
  pool: KanjiRow[]
): KanjiQuestion {
  const jp = row.jp_word;
  const rd = row.reading;
  const mn = row.meaning;
  const lvl = row.level;
  const pos = row.pos;

  const poolPos = pool.filter((item) => item.pos === pos);

  let prompt = "";
  let correct = "";
  let candidates: string[] = [];

  if (qtype === "reading") {
    prompt = `${jp}의 발음은?`;
    correct = rd;
    candidates = Array.from(
      new Set(
        poolPos
          .filter((item) => item.reading !== correct)
          .map((item) => item.reading)
          .filter(Boolean)
      )
    );
  } else if (qtype === "meaning") {
    prompt = `${jp}의 뜻은?`;
    correct = mn;
    candidates = Array.from(
      new Set(
        poolPos
          .filter((item) => item.meaning !== correct)
          .map((item) => item.meaning)
          .filter(Boolean)
      )
    );
  } else {
    prompt = `'${mn}'의 일본어(한자)는?`;
    correct = jp;
    candidates = Array.from(
      new Set(
        poolPos
          .filter((item) => item.jp_word !== correct)
          .map((item) => item.jp_word)
          .filter(Boolean)
      )
    );
  }

  if (candidates.length < 3) {
    throw new Error(`오답 후보 부족: qtype=${qtype}, pos=${pos}, word=${jp}`);
  }

  const wrongs = shuffleArray(candidates).slice(0, 3);
  const choices = shuffleArray([...wrongs, correct]);

  return {
    app: "kanji",
    qtype,
    prompt,
    choices,
    correct_text: correct,
    jp_word: jp,
    reading: rd,
    meaning: mn,
    level: lvl,
    pos,
  };
}

export function buildKanjiQuiz(params: {
  rows: KanjiRow[];
  qtype: KanjiQType;
  level: string;
  masteredWords?: string[];
  excludedWords?: string[];
  size?: number;
}): KanjiQuestion[] {
  const {
    rows,
    qtype,
    level,
    masteredWords = [],
    excludedWords = [],
    size = QUIZ_SET_SIZE,
  } = params;

  const lv = String(level || "").trim().toUpperCase();
  const baseLevel = rows.filter(
    (row) => String(row.level || "").trim().toUpperCase() === lv
  );

  const blocked = new Set([
    ...masteredWords.map(String),
    ...excludedWords.map(String),
  ]);

  const base =
    blocked.size > 0
      ? baseLevel.filter((row) => !blocked.has(row.jp_word))
      : baseLevel;

  if (base.length < size) return [];

  const sampled = shuffleArray(base).slice(0, size);
  return sampled.map((row) => makeKanjiQuestion(row, qtype, rows));
}

export function buildKanjiQuizFromWordKeys(params: {
  rows: KanjiRow[];
  wordKeys: string[];
  qtype: KanjiQType;
}): KanjiQuestion[] {
  const { rows, wordKeys, qtype } = params;

  const keys = Array.from(
    new Set(wordKeys.map(String).map((x) => x.trim()).filter(Boolean))
  );
  if (keys.length === 0) return [];

  const retryRows = shuffleArray(
    rows.filter((row) => keys.includes(row.jp_word))
  );

  return retryRows.map((row) => makeKanjiQuestion(row, qtype, rows));
}

export function buildKanjiQuizFromWrongs(params: {
  rows: KanjiRow[];
  wrongList: Array<{ item_key?: string; jp_word?: string; app?: string; qtype?: string }>;
  qtype: KanjiQType;
}): KanjiQuestion[] {
  const wordKeys = params.wrongList
    .filter((item) => item.app === "kanji")
    .map((item) => String(item.item_key || item.jp_word || "").trim())
    .filter(Boolean);

  return buildKanjiQuizFromWordKeys({
    rows: params.rows,
    wordKeys,
    qtype: params.qtype,
  });
}