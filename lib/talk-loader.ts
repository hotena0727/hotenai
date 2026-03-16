import Papa from "papaparse";
import type { SubOption, TagOption, TalkCsvRow } from "@/app/types/talk";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function loadTalkRows(): Promise<TalkCsvRow[]> {
  const res = await fetch("/csv/talk_situations.csv");
  const csvText = await res.text();

  const parsed = Papa.parse<TalkCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error(parsed.errors);
    throw new Error("talk_situations.csv를 읽는 중 오류가 발생했습니다.");
  }

  return parsed.data
    .map((row) => ({
      qid: clean(row.qid),
      level: clean(row.level),
      tag: clean(row.tag),
      tag_kr: clean(row.tag_kr),
      sub: clean(row.sub),
      sub_kr: clean(row.sub_kr),
      situation_kr: clean(row.situation_kr),
      partner_jp: clean(row.partner_jp),
      partner_mp3: clean(row.partner_mp3),
      partner_kr: clean(row.partner_kr),
      answer_jp: clean(row.answer_jp),
      answer_yomi: clean((row as any).answer_yomi),
      answer_mp3: clean(row.answer_mp3),
      answer_kr: clean(row.answer_kr),
      d1_jp: clean(row.d1_jp),
      d2_jp: clean(row.d2_jp),
      d3_jp: clean(row.d3_jp),
      hint_kr: clean(row.hint_kr),
      mode: clean(row.mode),
      section: clean(row.section),
      stage: clean(row.stage),
      explain_kr: clean(row.explain_kr),
    }))
    .filter(
      (row) =>
        row.qid &&
        row.partner_jp &&
        row.answer_jp &&
        row.stage &&
        row.tag &&
        row.sub
    );
}

export function getStageOptions(rows: TalkCsvRow[]): string[] {
  return [...new Set(rows.map((row) => row.stage))].filter(Boolean);
}

export function getTagOptions(rows: TalkCsvRow[], stage: string): TagOption[] {
  const filtered = rows.filter((row) => row.stage === stage);
  const map = new Map<string, string>();

  filtered.forEach((row) => {
    if (row.tag && !map.has(row.tag)) {
      map.set(row.tag, row.tag_kr || row.tag);
    }
  });

  return Array.from(map.entries()).map(([value, label]) => ({
    value,
    label,
  }));
}

export function getSubOptions(
  rows: TalkCsvRow[],
  stage: string,
  tag: string
): SubOption[] {
  const filtered = rows.filter(
    (row) => row.stage === stage && row.tag === tag
  );
  const map = new Map<string, string>();

  filtered.forEach((row) => {
    if (row.sub && !map.has(row.sub)) {
      map.set(row.sub, row.sub_kr || row.sub);
    }
  });

  return Array.from(map.entries()).map(([value, label]) => ({
    value,
    label,
  }));
}