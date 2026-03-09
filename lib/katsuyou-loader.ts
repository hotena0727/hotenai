import type { KatsuyouRow, KatsuyouPos, KrPattern } from "@/app/types/katsuyou";

type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: CsvRow = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });

    return row;
  });
}

function normalizePos(value: string): KatsuyouPos | null {
  const v = String(value || "").trim();
  if (v === "i_adj" || v === "na_adj" || v === "verb") return v;
  return null;
}

function normalizePattern(value: string): KrPattern | undefined {
  const v = String(value || "").trim();
  if (v === "it" || v === "eu" || v === "wo" || v === "ha" || v === "reu") {
    return v;
  }
  return undefined;
}

function toKatsuyouRow(row: CsvRow, index: number): KatsuyouRow | null {
  const pos = normalizePos(row.pos);
  if (!pos) return null;

  const jp = String(row.base_jp || "").trim();
  const kr = String(row.base_kr || "").trim();
  const reading = String(row.reading || "").trim();
  const kr_root = String(row.kr_root || "").trim();
  const kr_pattern = normalizePattern(row.kr_pattern || "");

  if (!jp || !kr) return null;

  return {
    id: `${pos}-${index + 1}`,
    pos,
    jp,
    kr,
    reading: reading || undefined,
    kr_root: kr_root || undefined,
    kr_pattern,
  };
}

async function loadCsvFile(path: string): Promise<CsvRow[]> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load CSV: ${path}`);
  }

  const text = await res.text();
  return parseCsv(text);
}

export async function loadKatsuyouRows(): Promise<KatsuyouRow[]> {
  const all: KatsuyouRow[] = [];

  const iAdjRows = await loadCsvFile("/csv/katsuyou_i_adj.csv");
  all.push(
    ...iAdjRows
      .map((row, idx) => toKatsuyouRow(row, idx))
      .filter((row): row is KatsuyouRow => row !== null)
  );

  return all;
}