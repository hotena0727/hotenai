import type { WordQType, WordQuestion, WordRow } from "@/app/types/word";

const QUIZ_SET_SIZE = 10;

const POS_GROUP_MAP: Record<string, string[]> = {
  noun: ["noun"],
  verb: ["verb"],
  adj_i: ["adj_i"],
  adj_na: ["adj_na"],
  adverb: ["adverb"],
  particle: ["particle"],
  conjunction: ["conjunction"],
  interjection: ["interjection"],
};

function shuffleArray<T>(arr: T[]): T[] {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function hasKanji(text: string): boolean {
  return /[\u4E00-\u9FFF]/.test(String(text || ""));
}

export function getPosFilters(posGroup: string): string[] {
  return POS_GROUP_MAP[String(posGroup || "").trim().toLowerCase()] || [];
}

export function makeWordQuestion(
  row: WordRow,
  qtype: WordQType,
  pool: WordRow[]
): WordQuestion {
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
    app: "word",
    qtype,
    prompt,
    choices,
    correct_text: correct,
    jp_word: jp,
    reading: rd,
    meaning: mn,
    level: lvl,
    pos,
    example_jp: row.example_jp || "",
    example_kr: row.example_kr || "",
  };
}

export function buildWordQuiz(params: {
  rows: WordRow[];
  qtype: WordQType;
  posGroup: string;
  seenWords?: string[];
  masteredWords?: string[];
  excludedWords?: string[];
  size?: number;
}): WordQuestion[] {
  const {
    rows,
    qtype,
    posGroup,
    seenWords = [],
    masteredWords = [],
    excludedWords = [],
    size = QUIZ_SET_SIZE,
  } = params;

  const posFilters = getPosFilters(posGroup);
  let base = rows.filter((row) => posFilters.includes(row.pos));

  if (qtype === "reading") {
    base = base.filter((row) => hasKanji(row.jp_word));
  }

  const blocked = new Set([
    ...seenWords.map(String),
    ...masteredWords.map(String),
    ...excludedWords.map(String),
  ]);

  if (blocked.size > 0) {
    base = base.filter((row) => !blocked.has(row.jp_word));
  }

  if (base.length < size) return [];

  const sampled = shuffleArray(base).slice(0, size);
  return sampled.map((row) => makeWordQuestion(row, qtype, rows));
}

export function buildWordQuizFromWordKeys(params: {
  rows: WordRow[];
  wordKeys: string[];
  qtype: WordQType;
  posGroup: string;
}): WordQuestion[] {
  const { rows, wordKeys, qtype, posGroup } = params;

  const keys = Array.from(new Set(wordKeys.map(String).map((x) => x.trim()).filter(Boolean)));
  if (keys.length === 0) return [];

  const posFilters = getPosFilters(posGroup);
  let retryRows = rows.filter(
    (row) => keys.includes(row.jp_word) && posFilters.includes(row.pos)
  );

  if (qtype === "reading") {
    retryRows = retryRows.filter((row) => hasKanji(row.jp_word));
  }

  return shuffleArray(retryRows).map((row) => makeWordQuestion(row, qtype, rows));
}

export function buildWordQuizFromWrongs(params: {
  rows: WordRow[];
  wrongList: Array<{ item_key?: string; jp_word?: string; app?: string; qtype?: string }>;
  qtype: WordQType;
  posGroup: string;
}): WordQuestion[] {
  const wordKeys = params.wrongList
    .filter((item) => item.app === "word")
    .map((item) => String(item.item_key || item.jp_word || "").trim())
    .filter(Boolean);

  return buildWordQuizFromWordKeys({
    rows: params.rows,
    wordKeys,
    qtype: params.qtype,
    posGroup: params.posGroup,
  });
}