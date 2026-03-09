import type { QuizAttemptRow } from "@/lib/attempts";

export type AppKind = "word" | "kanji" | "katsuyou" | "talk" | "unknown";

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function getPosMode(rowOrPosMode?: QuizAttemptRow | string): string {
  if (typeof rowOrPosMode === "string" || rowOrPosMode == null) {
    return normalize(rowOrPosMode);
  }
  return normalize(rowOrPosMode.pos_mode);
}

export function isWordAttempt(rowOrPosMode?: QuizAttemptRow | string): boolean {
  const posMode = getPosMode(rowOrPosMode);
  return posMode.includes("단어");
}

export function isKanjiAttempt(rowOrPosMode?: QuizAttemptRow | string): boolean {
  const posMode = getPosMode(rowOrPosMode);
  return posMode.includes("한자");
}

export function isKatsuyouAttempt(rowOrPosMode?: QuizAttemptRow | string): boolean {
  const posMode = getPosMode(rowOrPosMode);
  return posMode.includes("활용");
}

export function isTalkAttempt(rowOrPosMode?: QuizAttemptRow | string): boolean {
  const posMode = getPosMode(rowOrPosMode);
  return posMode.includes("회화");
}

export function detectAppKind(row: QuizAttemptRow): AppKind {
  if (isKatsuyouAttempt(row)) return "katsuyou";
  if (isWordAttempt(row)) return "word";
  if (isKanjiAttempt(row)) return "kanji";
  if (isTalkAttempt(row)) return "talk";
  return "unknown";
}

export function getAppLabelFromPosMode(posMode?: string): string {
  const value = normalize(posMode);

  if (value.includes("활용")) return "활용";
  if (value.includes("단어")) return "단어";
  if (value.includes("한자")) return "한자";
  if (value.includes("회화")) return "회화";

  return "학습";
}

export function getPrettyPosModeLabel(posMode?: string): string {
  const value = normalize(posMode);
  if (!value) return "학습";

  let pretty = value;
  pretty = pretty.replace(/\bi_adj\b/g, "い형용사");
  pretty = pretty.replace(/\bna_adj\b/g, "な형용사");
  pretty = pretty.replace(/\bverb\b/g, "동사");
  pretty = pretty.replace(/\bkr2jp\b/g, "한→일");
  pretty = pretty.replace(/\bjp2kr\b/g, "일→한");

  return pretty;
}