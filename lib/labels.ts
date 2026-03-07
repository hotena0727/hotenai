
export type AppKind = "talk" | "word" | "kanji" | "unknown";

export function detectAppKind(posMode?: string): AppKind {
  const raw = String(posMode || "").trim();

  if (!raw) return "unknown";

  if (raw.startsWith("회화")) return "talk";
  if (raw.startsWith("단어")) return "word";
  if (raw.startsWith("한자")) return "kanji";

  return "unknown";
}

export function getAppLabel(appKind: AppKind): string {
  switch (appKind) {
    case "talk":
      return "회화";
    case "word":
      return "단어";
    case "kanji":
      return "한자";
    default:
      return "기타";
  }
}

export function getAppShortLabel(appKind: AppKind): string {
  switch (appKind) {
    case "talk":
      return "회화";
    case "word":
      return "단어";
    case "kanji":
      return "한자";
    default:
      return "-";
  }
}

export function getAppLabelFromPosMode(posMode?: string): string {
  return getAppLabel(detectAppKind(posMode));
}

export function isTalkAttempt(posMode?: string): boolean {
  return detectAppKind(posMode) === "talk";
}

export function isWordAttempt(posMode?: string): boolean {
  return detectAppKind(posMode) === "word";
}

export function isKanjiAttempt(posMode?: string): boolean {
  return detectAppKind(posMode) === "kanji";
}

export function splitPosMode(posMode?: string): {
  appKind: AppKind;
  appLabel: string;
  parts: string[];
} {
  const raw = String(posMode || "").trim();
  const parts = raw
    .split("·")
    .map((x) => x.trim())
    .filter(Boolean);

  const appKind = detectAppKind(raw);
  const appLabel = getAppLabel(appKind);

  return {
    appKind,
    appLabel,
    parts,
  };
}