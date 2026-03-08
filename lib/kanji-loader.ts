import Papa from "papaparse";
import type { KanjiRow } from "@/app/types/kanji";

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

export async function loadKanjiRows(): Promise<KanjiRow[]> {
  const res = await fetch("/csv/words_kanji.csv");
  const csvText = await res.text();

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error(parsed.errors);
    throw new Error("words_kanji.csv를 읽는 중 오류가 발생했습니다.");
  }

  return parsed.data
    .map((row) => ({
      level: normalizeLevel(row.level || ""),
      jp_word: String(row.jp_word || "").trim(),
      reading: String(row.reading || "").trim(),
      meaning: String(row.meaning || "").trim(),
      pos: normalizePos(row.pos || ""),
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