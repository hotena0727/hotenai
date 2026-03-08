export type AppKind = "talk" | "word" | "kanji" | "unknown";

const TALK_CODE_LABELS: Record<string, string> = {
  aisatsu: "인사말",
  jikoshoukai: "자기소개",
  shumi: "취미",
  riyuu: "이유",
  language_exchange: "언어교환(모임)",
  meetup: "언어교환(모임)",
};

const NORMALIZED_CODE_LABELS: Record<string, string> = {
  ...TALK_CODE_LABELS,
};

function normalizeToken(value?: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function detectAppKind(posMode?: string): AppKind {
  const raw = String(posMode || "").trim().toLowerCase();

  if (!raw) return "unknown";

  if (raw.startsWith("회화") || raw.startsWith("talk:") || raw === "talk") {
    return "talk";
  }
  if (raw.startsWith("단어") || raw.startsWith("word:") || raw === "word") {
    return "word";
  }
  if (raw.startsWith("한자") || raw.startsWith("kanji:") || raw === "kanji") {
    return "kanji";
  }

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

export function getPrettySubLabel(posMode?: string): string {
  const raw = String(posMode || "").trim();
  if (!raw) return "-";

  if (raw.includes("·")) {
    const parts = raw
      .split("·")
      .map((x) => x.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return parts[1];
    }
  }

  const lower = raw.toLowerCase();

  if (lower.includes(":")) {
    const token = normalizeToken(lower.split(":").pop());
    return NORMALIZED_CODE_LABELS[token] || token || raw;
  }

  const token = normalizeToken(lower);
  return NORMALIZED_CODE_LABELS[token] || raw;
}

export function getPrettyPosModeLabel(posMode?: string): string {
  const raw = String(posMode || "").trim();
  if (!raw) return "-";

  if (raw.includes("·")) {
    return raw;
  }

  const appKind = detectAppKind(raw);
  const appLabel = getAppLabel(appKind);

  if (raw.toLowerCase().includes(":")) {
    const token = normalizeToken(raw.split(":").pop());
    const subLabel = NORMALIZED_CODE_LABELS[token] || token;
    if (appKind !== "unknown") {
      return `${appLabel} · ${subLabel}`;
    }
    return subLabel || raw;
  }

  const token = normalizeToken(raw);
  const subLabel = NORMALIZED_CODE_LABELS[token];
  if (subLabel && appKind !== "unknown") {
    return `${appLabel} · ${subLabel}`;
  }
  if (subLabel) {
    return subLabel;
  }

  return raw;
}
