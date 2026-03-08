import Papa from "papaparse";
import type { PatternOption, PatternRow } from "@/types/pattern";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePosGroup(raw: string): string {
  return clean(raw).toLowerCase();
}

function posGroupLabel(posGroup: string): string {
  switch (posGroup) {
    case "noun":
      return "명사";
    case "verb":
      return "동사";
    case "adj_i":
      return "い형용사";
    case "adj_na":
      return "な형용사";
    case "adverb":
      return "부사";
    case "particle":
      return "조사";
    case "conjunction":
      return "접속사";
    case "interjection":
      return "감탄사";
    default:
      return posGroup || "-";
  }
}

export async function loadPatternRows(): Promise<PatternRow[]> {
  const res = await fetch("/csv/patterns_beginner.csv");
  const csvText = await res.text();

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error(parsed.errors);
    throw new Error("patterns_beginner.csv를 읽는 중 오류가 발생했습니다.");
  }

  return parsed.data
    .map((row) => ({
      pos_group: normalizePosGroup(row.pos_group || ""),
      title: clean(row.title),
      jp: clean(row.jp),
      kr: clean(row.kr),
      ex1_jp: clean(row.ex1_jp),
      ex1_kr: clean(row.ex1_kr),
      ex2_jp: clean(row.ex2_jp),
      ex2_kr: clean(row.ex2_kr),
    }))
    .filter((row) => row.pos_group && row.title && row.jp && row.kr);
}

export function getPatternPosOptions(rows: PatternRow[]): PatternOption[] {
  const values = Array.from(
    new Set(rows.map((row) => row.pos_group).filter(Boolean))
  );

  return values.map((value) => ({
    value,
    label: posGroupLabel(value),
  }));
}

export function filterPatternRows(
  rows: PatternRow[],
  posGroup: string,
  keyword = ""
): PatternRow[] {
  const q = clean(keyword).toLowerCase();

  return rows.filter((row) => {
    const posOk = !posGroup || posGroup === "전체" || row.pos_group === posGroup;

    const haystack = [
      row.title,
      row.jp,
      row.kr,
      row.ex1_jp,
      row.ex1_kr,
      row.ex2_jp,
      row.ex2_kr,
    ]
      .join(" ")
      .toLowerCase();

    const searchOk = !q || haystack.includes(q);

    return posOk && searchOk;
  });
}