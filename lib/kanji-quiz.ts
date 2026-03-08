import type { KanjiQType, KanjiQuestion, KanjiRow } from "@/app/types/kanji";

const QUIZ_SET_SIZE = 10;

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

function isVerbLike(pos: string): boolean {
  return String(pos || "").toLowerCase() === "verb";
}

function isAdjILike(pos: string): boolean {
  return String(pos || "").toLowerCase() === "adj_i";
}

function isAdjNaLike(pos: string): boolean {
  return String(pos || "").toLowerCase() === "adj_na";
}

function isVerbOrAdj(pos: string): boolean {
  return isVerbLike(pos) || isAdjILike(pos) || isAdjNaLike(pos);
}

function kanaRowChar(ch: string): string {
  const map: Record<string, string> = {
    あ: "a", か: "k", さ: "s", た: "t", な: "n", は: "h", ま: "m", や: "y", ら: "r", わ: "w",
    い: "a", き: "k", し: "s", ち: "t", に: "n", ひ: "h", み: "m", り: "r",
    う: "a", く: "k", す: "s", つ: "t", ぬ: "n", ふ: "h", む: "m", ゆ: "y", る: "r",
    え: "a", け: "k", せ: "s", て: "t", ね: "n", へ: "h", め: "m", れ: "r",
    お: "a", こ: "k", そ: "s", と: "t", の: "n", ほ: "h", も: "m", よ: "y", ろ: "r", を: "w",
    が: "k", ぎ: "k", ぐ: "k", げ: "k", ご: "k",
    ざ: "s", じ: "s", ず: "s", ぜ: "s", ぞ: "s",
    だ: "t", ぢ: "t", づ: "t", で: "t", ど: "t",
    ば: "h", び: "h", ぶ: "h", べ: "h", ぼ: "h",
    ぱ: "h", ぴ: "h", ぷ: "h", ぺ: "h", ぽ: "h",
    ん: "n",
    っ: "x", ゃ: "y", ゅ: "y", ょ: "y", ー: "-"
  };
  return map[ch] || ch;
}

function uniqueByReading(rows: KanjiRow[]): KanjiRow[] {
  const seen = new Set<string>();
  const out: KanjiRow[] = [];

  for (const row of rows) {
    const key = cleanKana(row.reading);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function pickDistinctLastCharRows(rows: KanjiRow[], count: number): KanjiRow[] {
  const shuffled = shuffleArray(rows);
  const used = new Set<string>();
  const picked: KanjiRow[] = [];

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

function pickReadingWrongRows(correctRow: KanjiRow, poolPos: KanjiRow[]): KanjiRow[] {
  const pos = String(correctRow.pos || "").toLowerCase();
  const correctReading = cleanKana(correctRow.reading);

  const base = uniqueByReading(
    poolPos.filter(
      (row) =>
        row.jp_word !== correctRow.jp_word &&
        cleanKana(row.reading) !== correctReading
    )
  );

  if (base.length < 3) {
    return [];
  }

  if (isVerbOrAdj(pos)) {
    const tail2 = lastN(correctReading, 2);
    const tail1 = lastN(correctReading, 1);
    const rowKey = kanaRowChar(lastChar(correctReading));

    const picked: KanjiRow[] = [];

    const takeFrom = (candidates: KanjiRow[]) => {
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

    if (picked.length < 3 && rowKey) {
      takeFrom(
        base.filter(
          (row) => kanaRowChar(lastChar(cleanKana(row.reading))) === rowKey
        )
      );
    }

    if (picked.length < 3) {
      takeFrom(base);
    }

    return picked.slice(0, 3);
  }

  return pickDistinctLastCharRows(base, 3);
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
  let choices: string[] = [];

  if (qtype === "reading") {
    prompt = `${jp}의 발음은?`;
    correct = rd;

    const wrongRows = pickReadingWrongRows(row, poolPos);
    if (wrongRows.length < 3) {
      throw new Error(`오답 후보 부족: qtype=${qtype}, pos=${pos}, word=${jp}`);
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
      throw new Error(`오답 후보 부족: qtype=${qtype}, pos=${pos}, word=${jp}`);
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
      throw new Error(`오답 후보 부족: qtype=${qtype}, pos=${pos}, word=${jp}`);
    }

    const wrongs = shuffleArray(candidates).slice(0, 3);
    choices = shuffleArray([...wrongs, correct]);
  }

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
  let baseLevel = rows.filter(
    (row) => String(row.level || "").trim().toUpperCase() === lv
  );

  if (qtype === "reading") {
    baseLevel = baseLevel.filter((row) => hasKanji(row.jp_word));
  }

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

  try {
    return sampled.map((row) => makeKanjiQuestion(row, qtype, rows));
  } catch (error) {
    console.error("[buildKanjiQuiz] failed:", error);
    return [];
  }
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

  let retryRows = shuffleArray(rows.filter((row) => keys.includes(row.jp_word)));

  if (qtype === "reading") {
    retryRows = retryRows.filter((row) => hasKanji(row.jp_word));
  }

  try {
    return retryRows.map((row) => makeKanjiQuestion(row, qtype, rows));
  } catch (error) {
    console.error("[buildKanjiQuizFromWordKeys] failed:", error);
    return [];
  }
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