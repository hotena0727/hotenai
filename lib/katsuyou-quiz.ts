import type {
  GeneratedForm,
  KatsuyouPos,
  KatsuyouQType,
  KatsuyouQuestion,
  KatsuyouRow,
  KrForms,
  KrPattern,
} from "@/app/types/katsuyou";

function shuffleArray<T>(arr: T[]): T[] {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getIAdjStem(baseJp: string): string {
  return baseJp.endsWith("い") ? baseJp.slice(0, -1) : baseJp;
}

function euForms(root: string) {
  const map: Record<string, { past: string; polite: string; te: string }> = {
    슬프: { past: "슬펐다", polite: "슬픕니다", te: "슬퍼" },
    바쁘: { past: "바빴다", polite: "바쁩니다", te: "바빠" },
    기쁘: { past: "기뻤다", polite: "기쁩니다", te: "기뻐" },
  };

  return map[root] ?? {
    past: `${root}었다`,
    polite: `${root}습니다`,
    te: `${root}어`,
  };
}

function woForms(root: string) {
  const map: Record<string, { past: string; polite: string; te: string }> = {
    어렵: { past: "어려웠다", polite: "어렵습니다", te: "어려워" },
    즐겁: { past: "즐거웠다", polite: "즐겁습니다", te: "즐거워" },
    새롭: { past: "새로웠다", polite: "새롭습니다", te: "새로워" },
    외롭: { past: "외로웠다", polite: "외롭습니다", te: "외로워" },
    드물: { past: "드물었다", polite: "드뭅니다", te: "드물어" },
  };

  return map[root] ?? {
    past: `${root}었다`,
    polite: `${root}습니다`,
    te: `${root}어`,
  };
}

function haForms(root: string) {
  const stem = root.slice(0, -1);
  return {
    past: `${stem}했다`,
    polite: `${stem}합니다`,
    te: `${stem}해`,
  };
}

function reuForms(root: string) {
  const map: Record<string, { past: string; polite: string; te: string }> = {
    빠르: { past: "빨랐다", polite: "빠릅니다", te: "빨라" },
    가늘: { past: "가늘었다", polite: "가늘습니다", te: "가늘어" },
  };

  return map[root] ?? {
    past: `${root}었다`,
    polite: `${root}습니다`,
    te: `${root}어`,
  };
}

function buildKrFormsByPattern(
  baseKr: string,
  root: string,
  pattern: KrPattern
): KrForms {
  const common = {
    plain_present: baseKr,
    plain_negative: `${root}지 않다`,
    polite_negative: `${root}지 않습니다`,
    plain_negative_past: `${root}지 않았다`,
    polite_negative_past: `${root}지 않았습니다`,
    adverbial: `${root}게`,
  };

  if (pattern === "it") {
    return {
      ...common,
      polite_present: `${root}습니다`,
      plain_past: `${root}었다`,
      polite_past: `${root}었습니다`,
      te_form_a: `${root}고`,
      te_form_b: `${root}어서`,
    };
  }

  if (pattern === "eu") {
    const f = euForms(root);
    return {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.past.replace(/다$/, "습니다"),
      te_form_a: `${root}고`,
      te_form_b: `${f.te}서`,
    };
  }

  if (pattern === "wo") {
    const f = woForms(root);
    return {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.past.replace(/다$/, "습니다"),
      te_form_a: `${root}고`,
      te_form_b: `${f.te}서`,
    };
  }

  if (pattern === "ha") {
    const f = haForms(root);
    return {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.past.replace(/다$/, "습니다"),
      te_form_a: `${root}고`,
      te_form_b: `${f.te}서`,
    };
  }

  const f = reuForms(root);
  return {
    ...common,
    polite_present: f.polite,
    plain_past: f.past,
    polite_past: f.past.replace(/다$/, "습니다"),
    te_form_a: `${root}고`,
    te_form_b: `${f.te}서`,
  };
}

function buildIAdjForms(row: KatsuyouRow): GeneratedForm[] {
  if (row.pos !== "i_adj") return [];
  if (!row.kr_root || !row.kr_pattern) return [];

  const baseJp = row.jp;
  const baseKr = row.kr;
  const reading = row.reading;

  const stemJp = getIAdjStem(baseJp);
  const krForms = buildKrFormsByPattern(baseKr, row.kr_root, row.kr_pattern);

  const politeNegativeJp = pickOne([
    `${stemJp}くないです`,
    `${stemJp}くありません`,
  ] as const);

  const politeNegativePastJp = pickOne([
    `${stemJp}くなかったです`,
    `${stemJp}くありませんでした`,
  ] as const);

  const tePromptKr = pickOne([krForms.te_form_a, krForms.te_form_b] as const);

  return [
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "plain_present",
      promptKr: krForms.plain_present,
      answerJp: baseJp,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "polite_present",
      promptKr: krForms.polite_present,
      answerJp: `${baseJp}です`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "plain_negative",
      promptKr: krForms.plain_negative,
      answerJp: `${stemJp}くない`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "polite_negative",
      promptKr: krForms.polite_negative,
      answerJp: politeNegativeJp,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "plain_past",
      promptKr: krForms.plain_past,
      answerJp: `${stemJp}かった`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "polite_past",
      promptKr: krForms.polite_past,
      answerJp: `${stemJp}かったです`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "plain_negative_past",
      promptKr: krForms.plain_negative_past,
      answerJp: `${stemJp}くなかった`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "polite_negative_past",
      promptKr: krForms.polite_negative_past,
      answerJp: politeNegativePastJp,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "adverbial",
      promptKr: krForms.adverbial,
      answerJp: `${stemJp}く`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: "te_form",
      promptKr: tePromptKr,
      answerJp: `${stemJp}くて`,
      baseJp,
      baseKr,
      reading,
    },
  ];
}

function getAltEquivalentAnswers(form: GeneratedForm): string[] {
  const base = getIAdjStem(form.baseJp);

  if (form.formKey === "polite_negative") {
    return [`${base}くないです`, `${base}くありません`].filter(
      (v) => v !== form.answerJp
    );
  }

  if (form.formKey === "polite_negative_past") {
    return [`${base}くなかったです`, `${base}くありませんでした`].filter(
      (v) => v !== form.answerJp
    );
  }

  return [];
}

function buildChoicesForForm(form: GeneratedForm, siblings: GeneratedForm[]): string[] {
  const excludedEquivalent = new Set(getAltEquivalentAnswers(form));

  const pool = siblings
    .map((item) => item.answerJp)
    .filter((v) => v !== form.answerJp)
    .filter((v) => !excludedEquivalent.has(v));

  const wrongs = shuffleArray(uniqueStrings(pool)).slice(0, 3);
  const merged = uniqueStrings([form.answerJp, ...wrongs]);

  return shuffleArray(merged).slice(0, 4);
}

function buildLegacyQuiz({
  rows,
  qtype,
  pos,
  excludedWords = [],
  size = 10,
}: {
  rows: KatsuyouRow[];
  qtype: KatsuyouQType;
  pos: KatsuyouPos;
  excludedWords?: string[];
  size?: number;
}): KatsuyouQuestion[] {
  const excludedSet = new Set(excludedWords);

  const filtered = rows.filter((row) => row.pos === pos && !excludedSet.has(row.jp));
  const fallback = rows.filter((row) => row.pos === pos);
  const source = filtered.length >= Math.min(size, 4) ? filtered : fallback;

  if (source.length === 0) return [];

  const picked = shuffleArray(source).slice(0, Math.min(size, source.length));

  return picked.map((row) => {
    const correctText = qtype === "kr2jp" ? row.jp : row.kr;

    const pool =
      qtype === "kr2jp"
        ? rows.filter((r) => r.pos === pos).map((r) => r.jp)
        : rows.filter((r) => r.pos === pos).map((r) => r.kr);

    const wrongChoices = shuffleArray(
      uniqueStrings(pool).filter((choice) => choice !== correctText)
    ).slice(0, 3);

    const choices = shuffleArray(uniqueStrings([correctText, ...wrongChoices])).slice(0, 4);

    const safeChoices =
      choices.length === 4
        ? choices
        : shuffleArray(
            uniqueStrings([correctText, ...pool.filter((v) => v !== correctText)])
          ).slice(0, 4);

    const prompt = qtype === "kr2jp" ? row.kr : row.jp;

    return {
      pos: row.pos,
      qtype,
      formKey: "plain_present",
      prompt,
      choices: safeChoices,
      correct_text: correctText,
      jp_word: row.jp,
      kr_word: row.kr,
      reading: row.reading,
    };
  });
}

export function buildKatsuyouQuiz({
  rows,
  qtype,
  pos,
  excludedWords = [],
  size = 10,
}: {
  rows: KatsuyouRow[];
  qtype: KatsuyouQType;
  pos: KatsuyouPos;
  excludedWords?: string[];
  size?: number;
}): KatsuyouQuestion[] {
  if (pos !== "i_adj" || qtype !== "kr2jp") {
    return buildLegacyQuiz({
      rows,
      qtype,
      pos,
      excludedWords,
      size,
    });
  }

  const excludedSet = new Set(excludedWords);
  const filteredRows = rows.filter(
    (row) => row.pos === "i_adj" && !excludedSet.has(row.jp)
  );
  const fallbackRows = rows.filter((row) => row.pos === "i_adj");
  const sourceRows = filteredRows.length >= Math.min(size, 4) ? filteredRows : fallbackRows;

  if (sourceRows.length === 0) return [];

  const pickedRows = shuffleArray(sourceRows).slice(0, Math.min(size, sourceRows.length));
  const questions: KatsuyouQuestion[] = [];

  for (const row of pickedRows) {
    const forms = buildIAdjForms(row);
    if (!forms.length) continue;

    const pickedForm = shuffleArray(forms)[0];
    const choices = buildChoicesForForm(pickedForm, forms);

    if (choices.length < 4) continue;

    questions.push({
      pos: "i_adj",
      qtype: "kr2jp",
      formKey: pickedForm.formKey,
      prompt: pickedForm.promptKr,
      choices,
      correct_text: pickedForm.answerJp,
      jp_word: pickedForm.baseJp,
      kr_word: pickedForm.baseKr,
      reading: pickedForm.reading,
    });
  }

  return questions;
}