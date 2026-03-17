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

function cleanKana(text: string): string {
  return String(text || "").trim().replace(/\s+/g, "");
}

function lastN(text: string, n: number): string {
  const s = cleanKana(text);
  return s.slice(-n);
}

function lastChar(text: string): string {
  return lastN(text, 1);
}

function kanaRowChar(ch: string): string {
  const map: Record<string, string> = {
    あ: "a",
    か: "k",
    さ: "s",
    た: "t",
    な: "n",
    は: "h",
    ま: "m",
    や: "y",
    ら: "r",
    わ: "w",
    い: "a",
    き: "k",
    し: "s",
    ち: "t",
    に: "n",
    ひ: "h",
    み: "m",
    り: "r",
    う: "a",
    く: "k",
    す: "s",
    つ: "t",
    ぬ: "n",
    ふ: "h",
    む: "m",
    ゆ: "y",
    る: "r",
    え: "a",
    け: "k",
    せ: "s",
    て: "t",
    ね: "n",
    へ: "h",
    め: "m",
    れ: "r",
    お: "a",
    こ: "k",
    そ: "s",
    と: "t",
    の: "n",
    ほ: "h",
    も: "m",
    よ: "y",
    ろ: "r",
    を: "w",
    が: "k",
    ぎ: "k",
    ぐ: "k",
    げ: "k",
    ご: "k",
    ざ: "s",
    じ: "s",
    ず: "s",
    ぜ: "s",
    ぞ: "s",
    だ: "t",
    ぢ: "t",
    づ: "t",
    で: "t",
    ど: "t",
    ば: "h",
    び: "h",
    ぶ: "h",
    べ: "h",
    ぼ: "h",
    ぱ: "h",
    ぴ: "h",
    ぷ: "h",
    ぺ: "h",
    ぽ: "h",
    ん: "n",
    っ: "x",
    ゃ: "y",
    ゅ: "y",
    ょ: "y",
    ー: "-",
  };
  return map[ch] || ch;
}

function uniqueByReading(rows: WordRow[]): WordRow[] {
  const seen = new Set<string>();
  const out: WordRow[] = [];

  for (const row of rows) {
    const key = cleanKana(row.reading);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function isVerbLike(pos: string): boolean {
  return String(pos || "").toLowerCase() === "verb";
}

function isAdjILike(pos: string): boolean {
  return String(pos || "").toLowerCase() === "adj_i";
}

function isAdjNaLike(pos: string): boolean {
  return String(pos || "").toLowerCase() === "adj_na";
}

function endsWithSuru(text: string): boolean {
  return String(text || "").trim().endsWith("する");
}

function normalizeLevel(level?: string | null): string {
  return String(level || "").trim().toUpperCase();
}

function pickDistinctLastCharRows(rows: WordRow[], count: number): WordRow[] {
  const shuffled = shuffleArray(rows);
  const used = new Set<string>();
  const picked: WordRow[] = [];

  for (const row of shuffled) {
    const tail = lastChar(row.reading);
    if (!tail || used.has(tail)) continue;
    used.add(tail);
    picked.push(row);
    if (picked.length >= count) return picked;
  }

  for (const row of shuffled) {
    if (picked.find((x) => x.jp_word === row.jp_word)) continue;
    picked.push(row);
    if (picked.length >= count) return picked;
  }

  return picked;
}

function pickVerbReadingWrongRows(correctRow: WordRow, poolPos: WordRow[]): WordRow[] {
  const correctReading = cleanKana(correctRow.reading);
  const correctJp = String(correctRow.jp_word || "").trim();
  const suruLike = endsWithSuru(correctJp);

  const base = uniqueByReading(
    poolPos.filter(
      (row) =>
        row.jp_word !== correctRow.jp_word &&
        cleanKana(row.reading) !== correctReading
    )
  );

  if (base.length < 3) return [];

  const preferred = suruLike
    ? base.filter((row) => endsWithSuru(row.jp_word))
    : base.filter((row) => !endsWithSuru(row.jp_word));

  const fallback = suruLike
    ? base.filter((row) => !endsWithSuru(row.jp_word))
    : base.filter((row) => endsWithSuru(row.jp_word));

  const tail2 = lastN(correctReading, 2);
  const tail1 = lastN(correctReading, 1);
  const rowKey = kanaRowChar(lastChar(correctReading));

  const picked: WordRow[] = [];

  const takeFrom = (candidates: WordRow[]) => {
    for (const row of shuffleArray(candidates)) {
      if (picked.find((x) => x.jp_word === row.jp_word)) continue;
      picked.push(row);
      if (picked.length >= 3) return;
    }
  };

  if (tail2.length === 2) {
    takeFrom(preferred.filter((row) => lastN(row.reading, 2) === tail2));
  }
  if (picked.length < 3 && tail1) {
    takeFrom(preferred.filter((row) => lastN(row.reading, 1) === tail1));
  }
  if (picked.length < 3 && rowKey) {
    takeFrom(
      preferred.filter(
        (row) => kanaRowChar(lastChar(cleanKana(row.reading))) === rowKey
      )
    );
  }
  if (picked.length < 3) {
    takeFrom(preferred);
  }

  if (picked.length < 3 && tail2.length === 2) {
    takeFrom(fallback.filter((row) => lastN(row.reading, 2) === tail2));
  }
  if (picked.length < 3 && tail1) {
    takeFrom(fallback.filter((row) => lastN(row.reading, 1) === tail1));
  }
  if (picked.length < 3 && rowKey) {
    takeFrom(
      fallback.filter(
        (row) => kanaRowChar(lastChar(cleanKana(row.reading))) === rowKey
      )
    );
  }
  if (picked.length < 3) {
    takeFrom(fallback);
  }

  return picked.slice(0, 3);
}

function pickAdjIReadingWrongRows(correctRow: WordRow, poolPos: WordRow[]): WordRow[] {
  const correctReading = cleanKana(correctRow.reading);

  const base = uniqueByReading(
    poolPos.filter(
      (row) =>
        row.jp_word !== correctRow.jp_word &&
        cleanKana(row.reading) !== correctReading
    )
  );

  if (base.length < 3) return [];

  const preferred = base.filter((row) => cleanKana(row.reading).endsWith("い"));
  const fallback = base.filter((row) => !cleanKana(row.reading).endsWith("い"));

  const tail2 = lastN(correctReading, 2);
  const tail1 = lastN(correctReading, 1);

  const picked: WordRow[] = [];

  const takeFrom = (candidates: WordRow[]) => {
    for (const row of shuffleArray(candidates)) {
      if (picked.find((x) => x.jp_word === row.jp_word)) continue;
      picked.push(row);
      if (picked.length >= 3) return;
    }
  };

  if (tail2.length === 2) {
    takeFrom(preferred.filter((row) => lastN(row.reading, 2) === tail2));
  }
  if (picked.length < 3 && tail1) {
    takeFrom(preferred.filter((row) => lastN(row.reading, 1) === tail1));
  }
  if (picked.length < 3) {
    takeFrom(preferred);
  }
  if (picked.length < 3) {
    takeFrom(fallback);
  }

  return picked.slice(0, 3);
}

function pickAdjNaReadingWrongRows(correctRow: WordRow, poolPos: WordRow[]): WordRow[] {
  const correctReading = cleanKana(correctRow.reading);

  const base = uniqueByReading(
    poolPos.filter(
      (row) =>
        row.jp_word !== correctRow.jp_word &&
        cleanKana(row.reading) !== correctReading
    )
  );

  if (base.length < 3) return [];

  const tail2 = lastN(correctReading, 2);
  const tail1 = lastN(correctReading, 1);

  const picked: WordRow[] = [];

  const takeFrom = (candidates: WordRow[]) => {
    for (const row of shuffleArray(candidates)) {
      if (picked.find((x) => x.jp_word === row.jp_word)) continue;
      picked.push(row);
      if (picked.length >= 3) return;
    }
  };

  if (tail2.length === 2) {
    takeFrom(base.filter((row) => lastN(row.reading, 2) === tail2));
  }
  if (picked.length < 3 && tail1) {
    takeFrom(base.filter((row) => lastN(row.reading, 1) === tail1));
  }
  if (picked.length < 3) {
    takeFrom(base);
  }

  return picked.slice(0, 3);
}

function pickOtherReadingWrongRows(correctRow: WordRow, poolPos: WordRow[]): WordRow[] {
  const correctReading = cleanKana(correctRow.reading);

  const base = uniqueByReading(
    poolPos.filter(
      (row) =>
        row.jp_word !== correctRow.jp_word &&
        cleanKana(row.reading) !== correctReading
    )
  );

  if (base.length < 3) return [];
  return pickDistinctLastCharRows(base, 3);
}

function pickReadingWrongRows(correctRow: WordRow, poolPos: WordRow[]): WordRow[] {
  const pos = String(correctRow.pos || "").toLowerCase();

  if (isVerbLike(pos)) {
    return pickVerbReadingWrongRows(correctRow, poolPos);
  }
  if (isAdjILike(pos)) {
    return pickAdjIReadingWrongRows(correctRow, poolPos);
  }
  if (isAdjNaLike(pos)) {
    return pickAdjNaReadingWrongRows(correctRow, poolPos);
  }
  return pickOtherReadingWrongRows(correctRow, poolPos);
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

  const normalizedLevel = normalizeLevel(lvl);
  const poolPos = pool.filter(
    (item) =>
      item.pos === pos && normalizeLevel(item.level) === normalizedLevel
  );

  let prompt = "";
  let correct = "";
  let choices: string[] = [];

  if (qtype === "reading") {
    prompt = `${jp}의 발음은?`;
    correct = rd;

    const wrongRows = pickReadingWrongRows(row, poolPos);
    if (wrongRows.length < 3) {
      throw new Error(`오답 후보 부족: qtype=${qtype}, pos=${pos}, level=${normalizedLevel}, word=${jp}`);
    }

    const wrongs = wrongRows.map((item) => item.reading);
    choices = shuffleArray([...wrongs, correct]);
  } else if (qtype === "meaning") {
    prompt = `${jp}의 뜻은?`;
    correct = mn;

    const candidates = Array.from(
      new Set(
        poolPos
          .filter((item) => item.meaning !== correct)
          .map((item) => item.meaning)
          .filter(Boolean)
      )
    );

    if (candidates.length < 3) {
      throw new Error(`오답 후보 부족: qtype=${qtype}, pos=${pos}, level=${normalizedLevel}, word=${jp}`);
    }

    const wrongs = shuffleArray(candidates).slice(0, 3);
    choices = shuffleArray([...wrongs, correct]);
  } else {
    prompt = `'${mn}'의 일본어(한자)는?`;
    correct = jp;

    const candidates = Array.from(
      new Set(
        poolPos
          .filter((item) => item.jp_word !== correct)
          .map((item) => item.jp_word)
          .filter(Boolean)
      )
    );

    if (candidates.length < 3) {
      throw new Error(`오답 후보 부족: qtype=${qtype}, pos=${pos}, level=${normalizedLevel}, word=${jp}`);
    }

    const wrongs = shuffleArray(candidates).slice(0, 3);
    choices = shuffleArray([...wrongs, correct]);
  }

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
  level?: string;
  seenWords?: string[];
  masteredWords?: string[];
  excludedWords?: string[];
  size?: number;
}): WordQuestion[] {
  const {
    rows,
    qtype,
    posGroup,
    level = "",
    seenWords = [],
    masteredWords = [],
    excludedWords = [],
    size = QUIZ_SET_SIZE,
  } = params;

  const normalizedLevel = normalizeLevel(level);
  const posFilters = getPosFilters(posGroup);

  let base = rows.filter((row) => posFilters.includes(row.pos));

  if (normalizedLevel) {
    base = base.filter(
      (row) => normalizeLevel(row.level) === normalizedLevel
    );
  }

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

  try {
    return sampled.map((row) => makeWordQuestion(row, qtype, rows));
  } catch (error) {
    console.error("[buildWordQuiz] failed:", error);
    return [];
  }
}

export function buildWordQuizFromWordKeys(params: {
  rows: WordRow[];
  wordKeys: string[];
  qtype: WordQType;
  posGroup: string;
  level?: string;
}): WordQuestion[] {
  const { rows, wordKeys, qtype, posGroup, level = "" } = params;

  const keys = Array.from(
    new Set(
      wordKeys
        .map(String)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );

  if (keys.length === 0) return [];

  const normalizedLevel = normalizeLevel(level);
  const posFilters = getPosFilters(posGroup);

  let retryRows = rows.filter(
    (row) => keys.includes(row.jp_word) && posFilters.includes(row.pos)
  );

  if (normalizedLevel) {
    retryRows = retryRows.filter(
      (row) => normalizeLevel(row.level) === normalizedLevel
    );
  }

  if (qtype === "reading") {
    retryRows = retryRows.filter((row) => hasKanji(row.jp_word));
  }

  const shuffled = shuffleArray(retryRows);

  try {
    return shuffled.map((row) => makeWordQuestion(row, qtype, rows));
  } catch (error) {
    console.error("[buildWordQuizFromWordKeys] failed:", error);
    return [];
  }
}

export function buildWordQuizFromWrongs(params: {
  rows: WordRow[];
  wrongList: Array<{ item_key?: string; jp_word?: string; app?: string; qtype?: string }>;
  qtype: WordQType;
  posGroup: string;
  level?: string;
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
    level: params.level,
  });
}