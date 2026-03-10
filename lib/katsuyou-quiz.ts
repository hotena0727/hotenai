import type {
  GeneratedForm,
  KatsuyouFormKey,
  KatsuyouPos,
  KatsuyouQType,
  KatsuyouQuestion,
  KatsuyouRow,
  KrForms,
  KrPattern,
} from "@/app/types/katsuyou";
import { buildVerbKrForms } from "@/lib/katsuyou-kr-verb";

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

/* =========================
 * い형용사 한국어 생성 보조
 * ========================= */

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
    맵: { past: "매웠다", polite: "맵습니다", te: "매워" },
    차갑: { past: "차가웠다", polite: "차갑습니다", te: "차가워" },
    무섭: { past: "무서웠다", polite: "무섭습니다", te: "무서워" },
    어둡: { past: "어두웠다", polite: "어둡습니다", te: "어두워" },
    뜨겁: { past: "뜨거웠다", polite: "뜨겁습니다", te: "뜨거워" },
    춥: { past: "추웠다", polite: "춥습니다", te: "추워" },
    무겁: { past: "무거웠다", polite: "무겁습니다", te: "무거워" },
    가볍: { past: "가벼웠다", polite: "가볍습니다", te: "가벼워" },
    가깝: { past: "가까웠다", polite: "가깝습니다", te: "가까워" },
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

const KR_OVERRIDE_FORMS: Record<string, Partial<KrForms>> = {
  졸리: {
    polite_present: "졸립니다",
    plain_past: "졸렸다",
    polite_past: "졸렸습니다",
    te_form_a: "졸리고",
    te_form_b: "졸려서",
  },
  싸: {
    polite_present: "쌉니다",
    plain_past: "쌌다",
    polite_past: "쌌습니다",
    te_form_a: "싸고",
    te_form_b: "싸서",
  },
  비싸: {
    polite_present: "비쌉니다",
    plain_past: "비쌌다",
    polite_past: "비쌌습니다",
    te_form_a: "비싸고",
    te_form_b: "비싸서",
  },
  짜: {
    polite_present: "짭니다",
    plain_past: "짰다",
    polite_past: "짰습니다",
    te_form_a: "짜고",
    te_form_b: "짜서",
  },
  아프: {
    polite_present: "아픕니다",
    plain_past: "아팠다",
    polite_past: "아팠습니다",
    te_form_a: "아프고",
    te_form_b: "아파서",
  },
};

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

  let forms: KrForms;

  if (pattern === "it") {
    forms = {
      ...common,
      polite_present: `${root}습니다`,
      plain_past: `${root}었다`,
      polite_past: `${root}었습니다`,
      te_form_a: `${root}고`,
      te_form_b: `${root}어서`,
    };
  } else if (pattern === "eu") {
    const f = euForms(root);
    forms = {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.past.replace(/다$/, "습니다"),
      te_form_a: `${root}고`,
      te_form_b: `${f.te}서`,
    };
  } else if (pattern === "wo") {
    const f = woForms(root);
    forms = {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.past.replace(/다$/, "습니다"),
      te_form_a: `${root}고`,
      te_form_b: `${f.te}서`,
    };
  } else if (pattern === "ha") {
    const f = haForms(root);
    forms = {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.past.replace(/다$/, "습니다"),
      te_form_a: `${root}고`,
      te_form_b: `${f.te}서`,
    };
  } else {
    const f = reuForms(root);
    forms = {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.past.replace(/다$/, "습니다"),
      te_form_a: `${root}고`,
      te_form_b: `${f.te}서`,
    };
  }

  const override = KR_OVERRIDE_FORMS[root];
  if (override) {
    forms = {
      ...forms,
      ...override,
    };
  }

  return forms;
}

/* =========================
 * い형용사 문제 생성
 * ========================= */

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

/* =========================
 * な형용사 문제 생성
 * ========================= */

type NaKrOverride = {
  plain_present: string;
  polite_present: string;
  plain_negative: string;
  polite_negative: string;
  plain_past: string;
  polite_past: string;
  plain_negative_past: string;
  polite_negative_past: string;
  te_form: string;
};

const NA_KR_OVERRIDE: Record<string, NaKrOverride> = {
  苦手: {
    plain_present: "서툴다",
    polite_present: "서툽니다",
    plain_negative: "서툴지 않다",
    polite_negative: "서툴지 않습니다",
    plain_past: "서툴렀다",
    polite_past: "서툴렀습니다",
    plain_negative_past: "서툴지 않았다",
    polite_negative_past: "서툴지 않았습니다",
    te_form: "서툴고",
  },
  下手: {
    plain_present: "서투르다",
    polite_present: "서투릅니다",
    plain_negative: "서투르지 않다",
    polite_negative: "서투르지 않습니다",
    plain_past: "서투렀다",
    polite_past: "서투렀습니다",
    plain_negative_past: "서투르지 않았다",
    polite_negative_past: "서투르지 않았습니다",
    te_form: "서투르고",
  },
  得意: {
    plain_present: "능숙하다",
    polite_present: "능숙합니다",
    plain_negative: "능숙하지 않다",
    polite_negative: "능숙하지 않습니다",
    plain_past: "능숙했다",
    polite_past: "능숙했습니다",
    plain_negative_past: "능숙하지 않았다",
    polite_negative_past: "능숙하지 않았습니다",
    te_form: "능숙하고",
  },
  快適: {
    plain_present: "쾌적하다",
    polite_present: "쾌적합니다",
    plain_negative: "쾌적하지 않다",
    polite_negative: "쾌적하지 않습니다",
    plain_past: "쾌적했다",
    polite_past: "쾌적했습니다",
    plain_negative_past: "쾌적하지 않았다",
    polite_negative_past: "쾌적하지 않았습니다",
    te_form: "쾌적하고",
  },
  最高: {
    plain_present: "최고다",
    polite_present: "최고입니다",
    plain_negative: "최고이지 않다",
    polite_negative: "최고이지 않습니다",
    plain_past: "최고였다",
    polite_past: "최고였습니다",
    plain_negative_past: "최고이지 않았다",
    polite_negative_past: "최고이지 않았습니다",
    te_form: "최고이고",
  },
  最低: {
    plain_present: "최악이다",
    polite_present: "최악입니다",
    plain_negative: "최악이 아니다",
    polite_negative: "최악이 아닙니다",
    plain_past: "최악이었다",
    polite_past: "최악이었습니다",
    plain_negative_past: "최악이 아니었다",
    polite_negative_past: "최악이 아니었습니다",
    te_form: "최악이고",
  },
  残念: {
    plain_present: "유감이다",
    polite_present: "유감입니다",
    plain_negative: "유감이 아니다",
    polite_negative: "유감이 아닙니다",
    plain_past: "유감이었다",
    polite_past: "유감이었습니다",
    plain_negative_past: "유감이 아니었다",
    polite_negative_past: "유감이 아니었습니다",
    te_form: "유감이고",
  },
  不満: {
    plain_present: "불만이다",
    polite_present: "불만입니다",
    plain_negative: "불만이 아니다",
    polite_negative: "불만이 아닙니다",
    plain_past: "불만이었다",
    polite_past: "불만이었습니다",
    plain_negative_past: "불만이 아니었다",
    polite_negative_past: "불만이 아니었습니다",
    te_form: "불만이고",
  },
};

function buildNaAdjForms(row: KatsuyouRow): GeneratedForm[] {
  if (row.pos !== "na_adj") return [];

  const baseJp = row.jp;
  const baseKr = row.kr;
  const reading = row.reading;

  const override = NA_KR_OVERRIDE[baseJp];

  const isHada = baseKr.endsWith("하다");
  const stem = isHada
    ? baseKr.slice(0, -2)
    : baseKr.endsWith("다")
      ? baseKr.slice(0, -1)
      : baseKr;

  const plain_present = override?.plain_present ?? baseKr;
  const polite_present = override?.polite_present ?? (isHada ? `${stem}합니다` : `${stem}습니다`);
  const plain_negative = override?.plain_negative ?? (isHada ? `${stem}하지 않다` : `${stem}지 않다`);
  const polite_negative =
    override?.polite_negative ?? (isHada ? `${stem}하지 않습니다` : `${stem}지 않습니다`);
  const plain_past = override?.plain_past ?? (isHada ? `${stem}했다` : `${stem}였다`);
  const polite_past = override?.polite_past ?? (isHada ? `${stem}했습니다` : `${stem}였습니다`);
  const plain_negative_past =
    override?.plain_negative_past ?? (isHada ? `${stem}하지 않았다` : `${stem}지 않았다`);
  const polite_negative_past =
    override?.polite_negative_past ?? (isHada ? `${stem}하지 않았습니다` : `${stem}지 않았습니다`);
  const te_form = override?.te_form ?? (isHada ? `${stem}하고` : `${stem}고`);

  return [
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "plain_present",
      promptKr: plain_present,
      answerJp: `${baseJp}だ`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "polite_present",
      promptKr: polite_present,
      answerJp: `${baseJp}です`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "plain_negative",
      promptKr: plain_negative,
      answerJp: `${baseJp}ではない`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "polite_negative",
      promptKr: polite_negative,
      answerJp: `${baseJp}ではありません`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "plain_past",
      promptKr: plain_past,
      answerJp: `${baseJp}だった`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "polite_past",
      promptKr: polite_past,
      answerJp: `${baseJp}でした`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "plain_negative_past",
      promptKr: plain_negative_past,
      answerJp: `${baseJp}ではなかった`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "polite_negative_past",
      promptKr: polite_negative_past,
      answerJp: `${baseJp}ではありませんでした`,
      baseJp,
      baseKr,
      reading,
    },
    {
      pos: "na_adj",
      qtype: "kr2jp",
      formKey: "te_form",
      promptKr: te_form,
      answerJp: `${baseJp}で`,
      baseJp,
      baseKr,
      reading,
    },
  ];
}

/* =========================
 * 동사 문제 생성
 * ========================= */

type VerbJpFormSet = {
  plain_present: string;
  polite_present: string;
  plain_negative: string;
  plain_past: string;
  plain_negative_past: string;
  te_form: string;
  potential: string;
  imperative: string;
  volitional: string;
  passive: string;
  causative: string;
  causative_passive: string;
};

function godanBase(row: KatsuyouRow): string {
  return row.jp.slice(0, -1);
}

function godanEnding(row: KatsuyouRow): string {
  return row.jp.slice(-1);
}

function buildVerbJpForms(row: KatsuyouRow): VerbJpFormSet | null {
  const baseJp = row.jp;
  const group = row.verb_group;

  if (!group) return null;

  if (group === "ichidan") {
    const stem = baseJp.slice(0, -1);
    return {
      plain_present: baseJp,
      polite_present: `${stem}ます`,
      plain_negative: `${stem}ない`,
      plain_past: `${stem}た`,
      plain_negative_past: `${stem}なかった`,
      te_form: `${stem}て`,
      potential: `${stem}られる`,
      imperative: `${stem}ろ`,
      volitional: `${stem}よう`,
      passive: `${stem}られる`,
      causative: `${stem}させる`,
      causative_passive: `${stem}させられる`,
    };
  }

  if (group === "irregular") {
    if (baseJp === "する") {
      return {
        plain_present: "する",
        polite_present: "します",
        plain_negative: "しない",
        plain_past: "した",
        plain_negative_past: "しなかった",
        te_form: "して",
        potential: "できる",
        imperative: "しろ",
        volitional: "しよう",
        passive: "される",
        causative: "させる",
        causative_passive: "させられる",
      };
    }

    if (baseJp === "来る") {
      return {
        plain_present: "来る",
        polite_present: "来ます",
        plain_negative: "来ない",
        plain_past: "来た",
        plain_negative_past: "来なかった",
        te_form: "来て",
        potential: "来られる",
        imperative: "来い",
        volitional: "来よう",
        passive: "来られる",
        causative: "来させる",
        causative_passive: "来させられる",
      };
    }

    if (baseJp.endsWith("する")) {
      const stem = baseJp.slice(0, -2);
      return {
        plain_present: baseJp,
        polite_present: `${stem}します`,
        plain_negative: `${stem}しない`,
        plain_past: `${stem}した`,
        plain_negative_past: `${stem}しなかった`,
        te_form: `${stem}して`,
        potential: `${stem}できる`,
        imperative: `${stem}しろ`,
        volitional: `${stem}しよう`,
        passive: `${stem}される`,
        causative: `${stem}させる`,
        causative_passive: `${stem}させられる`,
      };
    }

    return null;
  }

  const stem = godanBase(row);
  const end = godanEnding(row);

  const map = {
    う: { i: "い", a: "わ", e: "え", o: "お", te: "って", ta: "った" },
    く: { i: "き", a: "か", e: "け", o: "こ", te: "いて", ta: "いた" },
    ぐ: { i: "ぎ", a: "が", e: "げ", o: "ご", te: "いで", ta: "いだ" },
    す: { i: "し", a: "さ", e: "せ", o: "そ", te: "して", ta: "した" },
    つ: { i: "ち", a: "た", e: "て", o: "と", te: "って", ta: "った" },
    ぬ: { i: "に", a: "な", e: "ね", o: "の", te: "んで", ta: "んだ" },
    む: { i: "み", a: "ま", e: "め", o: "も", te: "んで", ta: "んだ" },
    ぶ: { i: "び", a: "ば", e: "べ", o: "ぼ", te: "んで", ta: "んだ" },
    る: { i: "り", a: "ら", e: "れ", o: "ろ", te: "って", ta: "った" },
  } as const;

  const rule = map[end as keyof typeof map];
  if (!rule) return null;

  const teForm = baseJp === "行く" ? "行って" : `${stem}${rule.te}`;
  const taForm = baseJp === "行く" ? "行った" : `${stem}${rule.ta}`;

  return {
    plain_present: baseJp,
    polite_present: `${stem}${rule.i}ます`,
    plain_negative: `${stem}${rule.a}ない`,
    plain_past: taForm,
    plain_negative_past: `${stem}${rule.a}なかった`,
    te_form: teForm,
    potential: `${stem}${rule.e}る`,
    imperative: `${stem}${rule.e}`,
    volitional: `${stem}${rule.o}う`,
    passive: `${stem}${rule.a}れる`,
    causative: `${stem}${rule.a}せる`,
    causative_passive: `${stem}${rule.a}せられる`,
  };
}

function pushVerbForm(
  acc: GeneratedForm[],
  row: KatsuyouRow,
  formKey: KatsuyouFormKey,
  promptKr: string,
  answerJp: string
) {
  if (!promptKr || !answerJp) return;

  acc.push({
    pos: "verb",
    qtype: "kr2jp",
    formKey,
    promptKr,
    answerJp,
    baseJp: row.jp,
    baseKr: row.kr,
    reading: row.reading,
  });
}

function buildVerbForms(row: KatsuyouRow): GeneratedForm[] {
  if (row.pos !== "verb") return [];

  const jp = buildVerbJpForms(row);
  if (!jp) return [];

  const kr = buildVerbKrForms(row);
  const forms: GeneratedForm[] = [];

  pushVerbForm(forms, row, "plain_present", kr.plain_present, jp.plain_present);
  pushVerbForm(forms, row, "polite_present", kr.polite_present, jp.polite_present);
  pushVerbForm(forms, row, "plain_negative", kr.plain_negative, jp.plain_negative);
  pushVerbForm(forms, row, "plain_past", kr.plain_past, jp.plain_past);
  pushVerbForm(forms, row, "plain_negative_past", kr.plain_negative_past, jp.plain_negative_past);
  pushVerbForm(forms, row, "te_form", kr.te_form, jp.te_form);
  pushVerbForm(forms, row, "potential", kr.potential, jp.potential);
  pushVerbForm(forms, row, "imperative", kr.imperative, jp.imperative);
  pushVerbForm(forms, row, "volitional", kr.volitional, jp.volitional);
  pushVerbForm(forms, row, "passive", kr.passive, jp.passive);
  pushVerbForm(forms, row, "causative", kr.causative, jp.causative);
  pushVerbForm(forms, row, "causative_passive", kr.causative_passive, jp.causative_passive);

  return forms;
}

/* =========================
 * 공통 선택지 생성
 * ========================= */

function getAltEquivalentAnswers(form: GeneratedForm): string[] {
  if (form.pos === "i_adj") {
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
  }

  return [];
}

function buildChoicesForJpAnswer(form: GeneratedForm, siblings: GeneratedForm[]): string[] {
  const excludedEquivalent = new Set(getAltEquivalentAnswers(form));

  const pool = siblings
    .map((item) => item.answerJp)
    .filter((v) => v !== form.answerJp)
    .filter((v) => !excludedEquivalent.has(v));

  const wrongs = shuffleArray(uniqueStrings(pool)).slice(0, 3);
  const merged = uniqueStrings([form.answerJp, ...wrongs]);

  return shuffleArray(merged).slice(0, 4);
}

function buildChoicesForKrAnswer(form: GeneratedForm, siblings: GeneratedForm[]): string[] {
  const pool = siblings
    .map((item) => item.promptKr)
    .filter((v) => v !== form.promptKr);

  const wrongs = shuffleArray(uniqueStrings(pool)).slice(0, 3);
  const merged = uniqueStrings([form.promptKr, ...wrongs]);

  return shuffleArray(merged).slice(0, 4);
}

/* =========================
 * 최종 퀴즈 생성
 * ========================= */

function buildFormsForRow(row: KatsuyouRow): GeneratedForm[] {
  if (row.pos === "i_adj") return buildIAdjForms(row);
  if (row.pos === "na_adj") return buildNaAdjForms(row);
  if (row.pos === "verb") return buildVerbForms(row);
  return [];
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
  const excludedSet = new Set(excludedWords);
  const filteredRows = rows.filter((row) => row.pos === pos && !excludedSet.has(row.jp));
  const fallbackRows = rows.filter((row) => row.pos === pos);
  const sourceRows = filteredRows.length >= Math.min(size, 4) ? filteredRows : fallbackRows;

  if (sourceRows.length === 0) return [];

  const pickedRows = shuffleArray(sourceRows).slice(0, Math.min(size, sourceRows.length));
  const questions: KatsuyouQuestion[] = [];

  for (const row of pickedRows) {
    const forms = buildFormsForRow(row);
    if (!forms.length) continue;

    const pickedForm = shuffleArray(forms)[0];

    if (qtype === "kr2jp") {
      const choices = buildChoicesForJpAnswer(pickedForm, forms);
      if (choices.length < 4) continue;

      questions.push({
        pos: row.pos,
        qtype: "kr2jp",
        formKey: pickedForm.formKey,
        prompt: pickedForm.promptKr,
        choices,
        correct_text: pickedForm.answerJp,
        jp_word: pickedForm.baseJp,
        kr_word: pickedForm.baseKr,
        reading: pickedForm.reading,
      });
    } else {
      const choices = buildChoicesForKrAnswer(pickedForm, forms);
      if (choices.length < 4) continue;

      questions.push({
        pos: row.pos,
        qtype: "jp2kr",
        formKey: pickedForm.formKey,
        prompt: pickedForm.answerJp,
        choices,
        correct_text: pickedForm.promptKr,
        jp_word: pickedForm.baseJp,
        kr_word: pickedForm.baseKr,
        reading: pickedForm.reading,
      });
    }
  }

  return questions;
}