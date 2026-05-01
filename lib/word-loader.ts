import Papa from "papaparse";
import type { WordRow } from "@/app/types/word";

function normalizeLevel(raw: string): string {
  const s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = s.match(/N[1-5]/);
  if (m) return m[0];
  if (/^[1-5]$/.test(s)) return `N${s}`;
  return s;
}

function normalizePos(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();

  if (["noun", "명사"].includes(s)) return "noun";
  if (["adj_i", "i_adj", "adj-i", "い형용사"].includes(s)) return "adj_i";
  if (["adj_na", "na_adj", "adj-na", "な형용사"].includes(s)) return "adj_na";
  if (["verb", "동사"].includes(s)) return "verb";
  if (["adverb", "부사"].includes(s)) return "adverb";
  if (["particle", "조사"].includes(s)) return "particle";
  if (["conjunction", "접속사"].includes(s)) return "conjunction";
  if (["interjection", "감탄사"].includes(s)) return "interjection";

  return s;
}

const WORD_CSV_FILES = [
  "/csv/beginner.csv",
  "/csv/basic.csv",
];

async function loadOneWordCsv(path: string): Promise<WordRow[]> {
  const res = await fetch(path);

  if (!res.ok) {
    console.error(`[word-loader] CSV 파일을 읽지 못했습니다: ${path}`);
    return [];
  }

  const csvText = await res.text();

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error(`[word-loader] ${path} 파싱 오류`, parsed.errors);
    throw new Error(`${path}를 읽는 중 오류가 발생했습니다.`);
  }

  return parsed.data
    .map((row) => ({
      level: normalizeLevel(row.level || ""),
      pos: normalizePos(row.pos || ""),
      jp_word: String(row.jp_word || "").trim(),
      reading: String(row.reading || "").trim(),
      meaning: String(row.meaning || "").trim(),
      example_jp: String(row.example_jp || "").trim(),
      example_kr: String(row.example_kr || "").trim(),
    }))
    .filter(
      (row) =>
        row.level &&
        row.jp_word &&
        row.reading &&
        row.meaning &&
        row.pos
    );
}

export async function loadWordRows(): Promise<WordRow[]> {
  const allRows = await Promise.all(
    WORD_CSV_FILES.map((path) => loadOneWordCsv(path))
  );

  return allRows.flat();
}