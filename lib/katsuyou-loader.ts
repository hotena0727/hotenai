import type {
  KatsuyouRow,
  KatsuyouPos,
  KrPattern,
  PassiveType,
  VerbGroup,
} from "@/app/types/katsuyou";

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

function normalizeVerbGroup(value: string): VerbGroup | undefined {
  const v = String(value || "").trim().toLowerCase();
  if (v === "godan" || v === "ichidan" || v === "irregular") return v;
  return undefined;
}

function parseYN(value: string): boolean | undefined {
  const v = String(value || "").trim().toUpperCase();
  if (v === "Y") return true;
  if (v === "N") return false;
  return undefined;
}

function parsePassiveType(value: string): PassiveType | undefined {
  const v = String(value || "").trim().toLowerCase();
  if (v === "natural" || v === "descriptive" || v === "none") return v;
  return undefined;
}

function clean(value: string): string | undefined {
  const v = String(value || "").trim();
  return v ? v : undefined;
}

function pickJp(row: CsvRow): string {
  return String(
    row.base_jp || row.jp || row.word_jp || ""
  ).trim();
}

function pickKr(row: CsvRow): string {
  return String(
    row.base_kr || row.kr || row.word_kr || ""
  ).trim();
}

function pickReading(row: CsvRow): string {
  return String(
    row.reading || row.yomi || ""
  ).trim();
}

function toKatsuyouRow(row: CsvRow, index: number): KatsuyouRow | null {
  const pos = normalizePos(row.pos);
  if (!pos) return null;

  const jp = pickJp(row);
  const kr = pickKr(row);
  const reading = pickReading(row);

  if (!jp || !kr) return null;

  const result: KatsuyouRow = {
    id: `${pos}-${index + 1}`,
    pos,
    jp,
    kr,
    reading: reading || undefined,
  };

  if (pos === "i_adj" || pos === "na_adj") {
    result.kr_root = clean(row.kr_root);
    result.kr_pattern = normalizePattern(row.kr_pattern || "");
  }

  if (pos === "verb") {
    result.verb_group = normalizeVerbGroup(row.verb_group || "");

    result.can_potential = parseYN(row.can_potential);
    result.passive_type = parsePassiveType(row.passive_type || "");
    result.can_causative = parseYN(row.can_causative);
    result.can_causative_passive = parseYN(row.can_causative_passive);
    result.can_volitional = parseYN(row.can_volitional);
    result.can_imperative = parseYN(row.can_imperative);

    result.kr_connective_a = clean(row.kr_connective_a);
    result.kr_connective_b = clean(row.kr_connective_b);

    result.kr_passive_override = clean(row.kr_passive_override);
    result.kr_potential_override = clean(row.kr_potential_override);
    result.kr_imperative_override = clean(row.kr_imperative_override);
    result.kr_polite_present_override = clean(row.kr_polite_present_override);
    result.kr_past_override = clean(row.kr_past_override);
  }

  return result;
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

  const naAdjRows = await loadCsvFile("/csv/katsuyou_na_adj.csv");
  all.push(
    ...naAdjRows
      .map((row, idx) => toKatsuyouRow(row, 10000 + idx))
      .filter((row): row is KatsuyouRow => row !== null)
  );

  const verbRows = await loadCsvFile("/csv/katsuyou_verb");
  all.push(
    ...verbRows
      .map((row, idx) => toKatsuyouRow(row, 20000 + idx))
      .filter((row): row is KatsuyouRow => row !== null)
  );

  return all;
}