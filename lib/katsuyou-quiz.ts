import type {
  KatsuyouPos,
  KatsuyouQType,
  KatsuyouQuestion,
  KatsuyouRow,
} from "@/app/types/katsuyou";

function shuffleArray<T>(arr: T[]): T[] {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

export function buildKatsuyouQuiz({
  rows,
  qtype,
  pos,
  excludedWords = [],
  size = 10,
}: {
  rows: KatsuyouRow[];
  qtype: KatsuyouQType;
  pos: KatsuyouPos;
  excludedWords?: string[];
  size?: number;
}): KatsuyouQuestion[] {
  const excludedSet = new Set(excludedWords);

  const filtered = rows.filter((row) => row.pos === pos && !excludedSet.has(row.jp));

  const fallback = rows.filter((row) => row.pos === pos);

  const source = filtered.length >= Math.min(size, 4) ? filtered : fallback;

  if (source.length === 0) return [];

  const picked = shuffleArray(source).slice(0, Math.min(size, source.length));

  return picked.map((row) => {
    const correctText = qtype === "kr2jp" ? row.jp : row.kr;

    const pool =
      qtype === "kr2jp"
        ? rows.filter((r) => r.pos === pos).map((r) => r.jp)
        : rows.filter((r) => r.pos === pos).map((r) => r.kr);

    const wrongChoices = shuffleArray(
      uniqueStrings(pool).filter((choice) => choice !== correctText)
    ).slice(0, 3);

    const choices = shuffleArray(uniqueStrings([correctText, ...wrongChoices])).slice(0, 4);

    const safeChoices =
      choices.length === 4
        ? choices
        : shuffleArray(uniqueStrings([correctText, ...pool.filter((v) => v !== correctText)])).slice(0, 4);

    const prompt = qtype === "kr2jp" ? row.kr : row.jp;

    return {
      pos: row.pos,
      qtype,
      prompt,
      choices: safeChoices,
      correct_text: correctText,
      jp_word: row.jp,
      kr_word: row.kr,
      reading: row.reading,
    };
  });
}