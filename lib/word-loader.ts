import Papa from "papaparse";
import type { WordRow } from "@/types/word";

function normalizeLevel(raw: string): string {
  const s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = s.match(/N[1-5]/);
  if (m) return m[0];
  if (/^[1-5]$/.test(s)) return `N${s}`;
  return s;
}

function normalizePos(raw: string): string {
  return String(raw || "").trim().toLowerCase();
}

export async function loadWordRows(): Promise<WordRow[]> {
  const res = await fetch("/csv/beginner.csv");
  const csvText = await res.text();

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error(parsed.errors);
    throw new Error("beginner.csv를 읽는 중 오류가 발생했습니다.");
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
        row.jp_word &&
        row.reading &&
        row.meaning &&
        row.pos
    );
}