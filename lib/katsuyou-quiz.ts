import type {
  GeneratedForm,
  KatsuyouFormKey,
  KatsuyouPos,
  KatsuyouQType,
  KatsuyouQuestion,
  KatsuyouRow,
  KrForms,
  KrPattern,
  VerbJpFormSet,
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
 * 공통 한국어 보조
 * ========================= */

function getLastHangulVowelIndex(text: string): number | null {
  const last = text[text.length - 1];
  if (!last) return null;

  const code = last.charCodeAt(0);
  const HANGUL_BASE = 0xac00;
  const HANGUL_END = 0xd7a3;

  if (code < HANGUL_BASE || code > HANGUL_END) return null;

  const syllableIndex = code - HANGUL_BASE;
  const jung = Math.floor((syllableIndex % 588) / 28);
  return jung;
}

function endsWithBatchim(text: string): boolean {
  const last = text[text.length - 1];
  if (!last) return false;

  const code = last.charCodeAt(0);
  const HANGUL_BASE = 0xac00;
  const HANGUL_END = 0xd7a3;

  if (code < HANGUL_BASE || code > HANGUL_END) return false;

  return (code - HANGUL_BASE) % 28 !== 0;
}

function usesAhSeries(root: string): boolean {
  const jung = getLastHangulVowelIndex(root);
  return jung === 0 || jung === 2 || jung === 8; // ㅏ, ㅑ, ㅗ
}

function normalizeKrPredicateText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, "")
    .trim();
}

function normalizeKrFormText(text: string): string {
  return text
    .replace(/어리습니다/g, "어립니다")
    .replace(/어리었습니다/g, "어렸습니다")
    .replace(/어리었다/g, "어렸다")
    .replace(/어리어서/g, "어려서")
    .replace(/이르습니다/g, "이릅니다")
    .replace(/이르었습니다/g, "일렀습니다")
    .replace(/빠르었습니다/g, "빨랐습니다")
    .replace(/빠르었다/g, "빨랐다")
    .replace(/다르었습니다/g, "달랐습니다")
    .replace(/다르었다/g, "달랐다")
    .replace(/고르었습니다/g, "골랐습니다")
    .replace(/고르었다/g, "골랐다")
    .replace(/누르었습니다/g, "눌렀습니다")
    .replace(/누르었다/g, "눌렀다")
    .replace(/부르었습니다/g, "불렀습니다")
    .replace(/부르었다/g, "불렀다")
    .replace(/모르었습니다/g, "몰랐습니다")
    .replace(/모르었다/g, "몰랐다")

    .replace(/눈부시습니다/g, "눈부십니다")
    .replace(/성가시습니다/g, "성가십니다")
    .replace(/성가시었다/g, "성가셨다")
    .replace(/성가시어서/g, "성가셔서")
    .replace(/성가시었습니다/g, "성가셨습니다")
    .replace(/건방지습니다/g, "건방집니다")
    .replace(/건방지었다/g, "건방졌다")
    .replace(/건방지었습니다/g, "건방졌습니다")
    .replace(/야무지었다/g, "야무졌다")
    .replace(/야무지었습니다/g, "야무졌습니다")

    .replace(/새롭웠다/g, "새로웠다")
    .replace(/새롭웠습니다/g, "새로웠습니다")

    .replace(/밉어서/g, "미워서")
    .replace(/밉었다/g, "미웠다")
    .replace(/밉었습니다/g, "미웠습니다")

    .replace(/아름답어서/g, "아름다워서")
    .replace(/아름답었다/g, "아름다웠다")
    .replace(/아름답었습니다/g, "아름다웠습니다")

    .replace(/그립어서/g, "그리워서")
    .replace(/그립었다/g, "그리웠다")
    .replace(/그립었습니다/g, "그리웠습니다")

    .replace(/달었다/g, "달았다")
    .replace(/달었습니다/g, "달았습니다")
    .replace(/짧었다/g, "짧았다")
    .replace(/짧었습니다/g, "짧았습니다")
    .replace(/같었다/g, "같았다")
    .replace(/같었습니다/g, "같았습니다")
    .replace(/괜찮었다/g, "괜찮았다")
    .replace(/괜찮었습니다/g, "괜찮았습니다")

    .replace(/희습니다/g, "흽니다")

    .replace(/뻔뻔스럽어서/g, "뻔뻔스러워서")
    .replace(/뻔뻔스럽었다/g, "뻔뻔스러웠다")
    .replace(/뻔뻔스럽었습니다/g, "뻔뻔스러웠습니다")
    .replace(/사치스럽어서/g, "사치스러워서")
    .replace(/사치스럽었다/g, "사치스러웠다")
    .replace(/사치스럽었습니다/g, "사치스러웠습니다")
    .replace(/태평스럽었다/g, "태평스러웠다")
    .replace(/태평스럽었습니다/g, "태평스러웠습니다")
    .replace(/태평스럽어서/g, "태평스러워서")

    .replace(/더럽어서/g, "더러워서")
    .replace(/시끄럽어서/g, "시끄러워서")
    .replace(/괴롭어서/g, "괴로워서")
    .replace(/괴롭었다/g, "괴로웠다")
    .replace(/괴롭었습니다/g, "괴로웠습니다")
    .replace(/고통러웠다/g, "고통스러웠다")
    .replace(/고통러웠습니다/g, "고통스러웠습니다")
    .replace(/고통러워서/g, "고통스러워서")
    .replace(/두껍어서/g, "두꺼워서")
    .replace(/두껍었다/g, "두꺼웠다")
    .replace(/두껍었습니다/g, "두꺼웠습니다")
    .replace(/쉽었다/g, "쉬웠다")
    .replace(/쉽었습니다/g, "쉬웠습니다")

    .replace(/귀엽었다/g, "귀여웠다")
    .replace(/귀엽었습니다/g, "귀여웠습니다")
    .replace(/귀엽어서/g, "귀여워서")

    .replace(/쓰었다/g, "썼다")
    .replace(/쓰었습니다/g, "썼습니다")
    .replace(/쓰어서/g, "써서")

    .replace(/느리었다/g, "느렸다")
    .replace(/느리었습니다/g, "느렸습니다")

    .replace(/크었다/g, "컸다")
    .replace(/크었습니다/g, "컸습니다")

    .replace(/노랗았다/g, "노랬다")
    .replace(/노랗았습니다/g, "노랬습니다")
    .replace(/파랗았다/g, "파랬다")
    .replace(/파랗았습니다/g, "파랬습니다")
    .replace(/하얗았다/g, "하얬다")
    .replace(/하얗았습니다/g, "하얬습니다")
    .replace(/빨갛았다/g, "빨갰다")
    .replace(/빨갛았습니다/g, "빨갰습니다")
    .replace(/까맣았다/g, "까맸다")
    .replace(/까맣았습니다/g, "까맸습니다")

    .replace(/폐가 되였다/g, "폐가 되었다")
    .replace(/제멋대로이 아니다/g, "제멋대로가 아니다")
    .replace(/쓸데없였다/g, "쓸데없었다")
    .replace(/품위 있였다/g, "품위 있었다")
    .replace(/소극적였습니다/g, "소극적이었습니다")
    .replace(/적극적였다/g, "적극적이었다")

    .replace(/서투르어서/g, "서툴러서")
    .replace(/서투렀습니다/g, "서툴렀습니다")

    .replace(/엉터리습니다/g, "엉터리입니다")
    .replace(/엉터리었다/g, "엉터리였다")
    .replace(/엉터리었습니다/g, "엉터리였습니다")

    .replace(/자유롭었다/g, "자유로웠다")
    .replace(/자유롭었습니다/g, "자유로웠습니다")
    .replace(/자유롭어서/g, "자유로워서")

    .replace(/무리습니다/g, "무리입니다")
    .replace(/무리었다/g, "무리였다")
    .replace(/무리었습니다/g, "무리였습니다")

    .replace(/덥었다/g, "더웠다")
    .replace(/덥었습니다/g, "더웠습니다")
    .replace(/덥어서/g, "더워서");
}

/* =========================
 * い형용사 한국어 생성 보조
 * ========================= */

function buildItPatternForms(root: string) {
  const ah = usesAhSeries(root);
  const base = root.endsWith("시") ? root.slice(0, -1) : root;

  return {
    polite: root.endsWith("시") ? `${base}십니다` : `${root}습니다`,
    past: root.endsWith("시") ? `${base}셨다` : `${root}${ah ? "았다" : "었다"}`,
    politePast: root.endsWith("시") ? `${base}셨습니다` : `${root}${ah ? "았습니다" : "었습니다"}`,
    te: root.endsWith("시") ? `${base}셔서` : `${root}${ah ? "아서" : "어서"}`,
  };
}

function euForms(root: string) {
  const map: Record<string, { past: string; polite: string; te: string }> = {
    슬프: { past: "슬펐다", polite: "슬픕니다", te: "슬퍼" },
    바쁘: { past: "바빴다", polite: "바쁩니다", te: "바빠" },
    기쁘: { past: "기뻤다", polite: "기쁩니다", te: "기뻐" },
    크: { past: "컸다", polite: "큽니다", te: "커" },
    나쁘: { past: "나빴다", polite: "나쁩니다", te: "나빠" },
  };

  return map[root] ?? {
    past: `${root}었다`,
    polite: `${root}습니다`,
    te: `${root}어`,
  };
}

function buildBieupTeForm(root: string): string {
  if (root.endsWith("스럽")) {
    return `${root.slice(0, -2)}러워`;
  }
  if (root.endsWith("럽")) {
    return `${root.slice(0, -2)}러워`;
  }
  return `${root.slice(0, -1)}워`;
}

function buildBieupPastForm(root: string): string {
  if (root.endsWith("스럽")) {
    return `${root.slice(0, -2)}러웠다`;
  }
  if (root.endsWith("럽")) {
    return `${root.slice(0, -2)}러웠다`;
  }
  return `${root.slice(0, -1)}웠다`;
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
    이르: { past: "일렀다", polite: "이릅니다", te: "일러" },
    다르: { past: "달랐다", polite: "다릅니다", te: "달라" },
    고르: { past: "골랐다", polite: "고릅니다", te: "골라" },
    누르: { past: "눌렀다", polite: "누릅니다", te: "눌러" },
    부르: { past: "불렀다", polite: "부릅니다", te: "불러" },
    모르: { past: "몰랐다", polite: "모릅니다", te: "몰라" },
    어리: { past: "어렸다", polite: "어립니다", te: "어려" },
    가늘: { past: "가늘었다", polite: "가늘습니다", te: "가늘어" },
    느리: { past: "느렸다", polite: "느립니다", te: "느려" },
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
    부럽: { past: "부러웠다", polite: "부럽습니다", te: "부러워" },
    고통스럽: { past: "고통스러웠다", polite: "고통스럽습니다", te: "고통스러워" },
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
    더럽: { past: "더러웠다", polite: "더럽습니다", te: "더러워" },
    시끄럽: { past: "시끄러웠다", polite: "시끄럽습니다", te: "시끄러워" },
    뻔뻔스럽: { past: "뻔뻔스러웠다", polite: "뻔뻔스럽습니다", te: "뻔뻔스러워" },
    희: { past: "희었다", polite: "흽니다", te: "희어" },
    쉽: { past: "쉬웠다", polite: "쉽습니다", te: "쉬워" },
    괴롭: { past: "괴로웠다", polite: "괴롭습니다", te: "괴로워" },
    두껍: { past: "두꺼웠다", polite: "두껍습니다", te: "두꺼워" },
    성가시: { past: "성가셨다", polite: "성가십니다", te: "성가셔" },
    건방지: { past: "건방졌다", polite: "건방집니다", te: "건방져" },
    야무지: { past: "야무졌다", polite: "야무집니다", te: "야무져" },
    밉: { past: "미웠다", polite: "밉습니다", te: "미워" },
    아름답: { past: "아름다웠다", polite: "아름답습니다", te: "아름다워" },
    그립: { past: "그리웠다", polite: "그립습니다", te: "그리워" },
    덥: { past: "더웠다", polite: "덥습니다", te: "더워" },
  };

  if (map[root]) return map[root];

  if (
    root.endsWith("스럽") ||
    root.endsWith("럽") ||
    root.endsWith("롭") ||
    root.endsWith("쉽") ||
    root.endsWith("갑") ||
    root.endsWith("겁") ||
    root.endsWith("깝") ||
    root.endsWith("둡") ||
    root.endsWith("섭") ||
    root.endsWith("춥") ||
    root.endsWith("맵")
  ) {
    const te = buildBieupTeForm(root);
    const past = buildBieupPastForm(root);
    return {
      past,
      polite: `${root}습니다`,
      te,
    };
  }

  return {
    past: `${root}었다`,
    polite: `${root}습니다`,
    te: `${root}어`,
  };
}

function hIrregularForms(root: string) {
  const map: Record<string, { past: string; polite: string; te: string }> = {
    노랗: { past: "노랬다", polite: "노랗습니다", te: "노래" },
    파랗: { past: "파랬다", polite: "파랗습니다", te: "파래" },
    하얗: { past: "하얬다", polite: "하얗습니다", te: "하얘" },
    빨갛: { past: "빨갰다", polite: "빨갛습니다", te: "빨개" },
    까맣: { past: "까맸다", polite: "까맣습니다", te: "까매" },
    누렇: { past: "누렜다", polite: "누렇습니다", te: "누래" },
    허옇: { past: "허옜다", polite: "허옇습니다", te: "허예" },
    뿌옇: { past: "뿌옜다", polite: "뿌옇습니다", te: "뿌예" },
  };

  return map[root] ?? {
    past: `${root}었다`,
    polite: `${root}습니다`,
    te: `${root}어`,
  };
}

const H_IRREGULAR_ROOTS = new Set([
  "노랗",
  "파랗",
  "하얗",
  "빨갛",
  "까맣",
  "누렇",
  "허옇",
  "뿌옇",
]);

const KR_OVERRIDE_FORMS: Record<string, Partial<KrForms>> = {
  졸리: {
    polite_present: "졸립니다",
    plain_past: "졸렸다",
    polite_past: "졸렸습니다",
    te_form_a: "졸리고",
    te_form_b: "졸려서",
  },
  느리: {
    polite_present: "느립니다",
    plain_past: "느렸다",
    polite_past: "느렸습니다",
    te_form_a: "느리고",
    te_form_b: "느려서",
  },
  두껍: {
    plain_past: "두꺼웠다",
    polite_past: "두꺼웠습니다",
    te_form_a: "두껍고",
    te_form_b: "두꺼워서",
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
  눈부시: {
    polite_present: "눈부십니다",
    plain_past: "눈부셨다",
    polite_past: "눈부셨습니다",
    te_form_a: "눈부시고",
    te_form_b: "눈부셔서",
  },
  성가시: {
    polite_present: "성가십니다",
    plain_past: "성가셨다",
    polite_past: "성가셨습니다",
    te_form_a: "성가시고",
    te_form_b: "성가셔서",
  },
  건방지: {
    polite_present: "건방집니다",
    plain_past: "건방졌다",
    polite_past: "건방졌습니다",
    te_form_a: "건방지고",
    te_form_b: "건방져서",
  },
  야무지: {
    polite_present: "야무집니다",
    plain_past: "야무졌다",
    polite_past: "야무졌습니다",
    te_form_a: "야무지고",
    te_form_b: "야무져서",
  },
  새롭: {
    plain_past: "새로웠다",
    polite_past: "새로웠습니다",
    te_form_a: "새롭고",
    te_form_b: "새로워서",
  },
  달: {
    plain_past: "달았다",
    polite_past: "달았습니다",
    te_form_a: "달고",
    te_form_b: "달아서",
  },
  짧: {
    plain_past: "짧았다",
    polite_past: "짧았습니다",
    te_form_a: "짧고",
    te_form_b: "짧아서",
  },
  뻔뻔스럽: {
    plain_past: "뻔뻔스러웠다",
    polite_past: "뻔뻔스러웠습니다",
    te_form_a: "뻔뻔스럽고",
    te_form_b: "뻔뻔스러워서",
  },
  괴롭: {
    plain_past: "괴로웠다",
    polite_past: "괴로웠습니다",
    te_form_a: "괴롭고",
    te_form_b: "괴로워서",
  },
  쉽: {
    plain_past: "쉬웠다",
    polite_past: "쉬웠습니다",
    te_form_a: "쉽고",
    te_form_b: "쉬워서",
  },
  크: {
    polite_present: "큽니다",
    plain_past: "컸다",
    polite_past: "컸습니다",
    te_form_a: "크고",
    te_form_b: "커서",
  },
  노랗: {
    polite_present: "노랗습니다",
    plain_past: "노랬다",
    polite_past: "노랬습니다",
    te_form_a: "노랗고",
    te_form_b: "노래서",
  },
  파랗: {
    polite_present: "파랗습니다",
    plain_past: "파랬다",
    polite_past: "파랬습니다",
    te_form_a: "파랗고",
    te_form_b: "파래서",
  },
  하얗: {
    polite_present: "하얗습니다",
    plain_past: "하얬다",
    polite_past: "하얬습니다",
    te_form_a: "하얗고",
    te_form_b: "하얘서",
  },
  빨갛: {
    polite_present: "빨갛습니다",
    plain_past: "빨갰다",
    polite_past: "빨갰습니다",
    te_form_a: "빨갛고",
    te_form_b: "빨개서",
  },
  까맣: {
    polite_present: "까맣습니다",
    plain_past: "까맸다",
    polite_past: "까맸습니다",
    te_form_a: "까맣고",
    te_form_b: "까매서",
  },
  괜찮: {
    plain_past: "괜찮았다",
    polite_past: "괜찮았습니다",
    te_form_a: "괜찮고",
    te_form_b: "괜찮아서",
  },
  사치스럽: {
    plain_past: "사치스러웠다",
    polite_past: "사치스러웠습니다",
    te_form_a: "사치스럽고",
    te_form_b: "사치스러워서",
  },
  태평스럽: {
    plain_past: "태평스러웠다",
    polite_past: "태평스러웠습니다",
    te_form_a: "태평스럽고",
    te_form_b: "태평스러워서",
  },
  같: {
    plain_past: "같았다",
    polite_past: "같았습니다",
    te_form_a: "같고",
    te_form_b: "같아서",
  },
  부럽: {
    plain_past: "부러웠다",
    polite_past: "부러웠습니다",
    te_form_a: "부럽고",
    te_form_b: "부러워서",
  },
  고통스럽: {
    plain_past: "고통스러웠다",
    polite_past: "고통스러웠습니다",
    te_form_a: "고통스럽고",
    te_form_b: "고통스러워서",
  },
  덥: {
    plain_past: "더웠다",
    polite_past: "더웠습니다",
    te_form_a: "덥고",
    te_form_b: "더워서",
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

  if (H_IRREGULAR_ROOTS.has(root)) {
    const f = hIrregularForms(root);

    forms = {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.past.replace(/다$/, "습니다"),
      te_form_a: `${root}고`,
      te_form_b: `${f.te}서`,
    };
  } else if (pattern === "it") {
    const f = buildItPatternForms(root);

    forms = {
      ...common,
      polite_present: f.polite,
      plain_past: f.past,
      polite_past: f.politePast,
      te_form_a: `${root}고`,
      te_form_b: f.te,
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

  return {
    ...forms,
    plain_present: normalizeKrFormText(forms.plain_present),
    polite_present: normalizeKrFormText(forms.polite_present),
    plain_negative: normalizeKrFormText(forms.plain_negative),
    polite_negative: normalizeKrFormText(forms.polite_negative),
    plain_past: normalizeKrFormText(forms.plain_past),
    polite_past: normalizeKrFormText(forms.polite_past),
    plain_negative_past: normalizeKrFormText(forms.plain_negative_past),
    polite_negative_past: normalizeKrFormText(forms.polite_negative_past),
    adverbial: normalizeKrFormText(forms.adverbial),
    te_form_a: normalizeKrFormText(forms.te_form_a),
    te_form_b: normalizeKrFormText(forms.te_form_b),
  };
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
  te_form_a: string;
  te_form_b: string;
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
    te_form_a: "서툴고",
    te_form_b: "서툴어서",
  },
  下手: {
    plain_present: "서툴다",
    polite_present: "서툽니다",
    plain_negative: "서툴지 않다",
    polite_negative: "서툴지 않습니다",
    plain_past: "서툴렀다",
    polite_past: "서툴렀습니다",
    plain_negative_past: "서툴지 않았다",
    polite_negative_past: "서툴지 않았습니다",
    te_form_a: "서툴고",
    te_form_b: "서툴러서",
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
    te_form_a: "능숙하고",
    te_form_b: "능숙해서",
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
    te_form_a: "쾌적하고",
    te_form_b: "쾌적해서",
  },
  最高: {
    plain_present: "최고다",
    polite_present: "최고입니다",
    plain_negative: "최고가 아니다",
    polite_negative: "최고가 아닙니다",
    plain_past: "최고였다",
    polite_past: "최고였습니다",
    plain_negative_past: "최고가 아니었다",
    polite_negative_past: "최고가 아니었습니다",
    te_form_a: "최고이고",
    te_form_b: "최고라서",
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
    te_form_a: "최악이고",
    te_form_b: "최악이라서",
  },
  残念: {
    plain_present: "아쉽다",
    polite_present: "아쉽습니다",
    plain_negative: "아쉽지 않다",
    polite_negative: "아쉽지 않습니다",
    plain_past: "아쉬웠다",
    polite_past: "아쉬웠습니다",
    plain_negative_past: "아쉽지 않았다",
    polite_negative_past: "아쉽지 않았습니다",
    te_form_a: "아쉽고",
    te_form_b: "아쉬워서",
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
    te_form_a: "불만이고",
    te_form_b: "불만이라서",
  },
  素敵: {
    plain_present: "멋지다",
    polite_present: "멋집니다",
    plain_negative: "멋지지 않다",
    polite_negative: "멋지지 않습니다",
    plain_past: "멋졌다",
    polite_past: "멋졌습니다",
    plain_negative_past: "멋지지 않았다",
    polite_negative_past: "멋지지 않았습니다",
    te_form_a: "멋지고",
    te_form_b: "멋져서",
  },
  生意気: {
    plain_present: "건방지다",
    polite_present: "건방집니다",
    plain_negative: "건방지지 않다",
    polite_negative: "건방지지 않습니다",
    plain_past: "건방졌다",
    polite_past: "건방졌습니다",
    plain_negative_past: "건방지지 않았다",
    polite_negative_past: "건방지지 않았습니다",
    te_form_a: "건방지고",
    te_form_b: "건방져서",
  },
  器用: {
    plain_present: "야무지다",
    polite_present: "야무집니다",
    plain_negative: "야무지지 않다",
    polite_negative: "야무지지 않습니다",
    plain_past: "야무졌다",
    polite_past: "야무졌습니다",
    plain_negative_past: "야무지지 않았다",
    polite_negative_past: "야무지지 않았습니다",
    te_form_a: "야무지고",
    te_form_b: "야무져서",
  },
  でたらめ: {
    plain_present: "엉터리다",
    polite_present: "엉터리입니다",
    plain_negative: "엉터리가 아니다",
    polite_negative: "엉터리가 아닙니다",
    plain_past: "엉터리였다",
    polite_past: "엉터리였습니다",
    plain_negative_past: "엉터리가 아니었다",
    polite_negative_past: "엉터리가 아니었습니다",
    te_form_a: "엉터리고",
    te_form_b: "엉터리라서",
  },
  自由: {
    plain_present: "자유롭다",
    polite_present: "자유롭습니다",
    plain_negative: "자유롭지 않다",
    polite_negative: "자유롭지 않습니다",
    plain_past: "자유로웠다",
    polite_past: "자유로웠습니다",
    plain_negative_past: "자유롭지 않았다",
    polite_negative_past: "자유롭지 않았습니다",
    te_form_a: "자유롭고",
    te_form_b: "자유로워서",
  },
  無理: {
    plain_present: "무리다",
    polite_present: "무리입니다",
    plain_negative: "무리가 아니다",
    polite_negative: "무리가 아닙니다",
    plain_past: "무리였다",
    polite_past: "무리였습니다",
    plain_negative_past: "무리가 아니었다",
    polite_negative_past: "무리가 아니었습니다",
    te_form_a: "무리고",
    te_form_b: "무리라서",
  },
};

function buildNaKrPredicateForms(baseKrRaw: string) {
  const baseKr = normalizeKrPredicateText(baseKrRaw);

  if (baseKr.endsWith("하다")) {
    const stem = baseKr.slice(0, -2);
    return {
      plain_present: baseKr,
      polite_present: `${stem}합니다`,
      plain_negative: `${stem}하지 않다`,
      polite_negative: `${stem}하지 않습니다`,
      plain_past: `${stem}했다`,
      polite_past: `${stem}했습니다`,
      plain_negative_past: `${stem}하지 않았다`,
      polite_negative_past: `${stem}하지 않았습니다`,
      te_form_a: `${stem}하고`,
      te_form_b: `${stem}해서`,
    };
  }

  if (baseKr.endsWith("이다")) {
    const stem = baseKr.slice(0, -2);
    const subjectParticle = endsWithBatchim(stem) ? "이" : "가";
    const pastCopula = endsWithBatchim(stem) ? "이었다" : "였다";
    const politePastCopula = endsWithBatchim(stem) ? "이었습니다" : "였습니다";
    const teCopulaA = endsWithBatchim(stem) ? "이고" : "고";
    const teCopulaB = endsWithBatchim(stem) ? "이라서" : "라서";

    return {
      plain_present: baseKr,
      polite_present: `${stem}입니다`,
      plain_negative: `${stem}${subjectParticle} 아니다`,
      polite_negative: `${stem}${subjectParticle} 아닙니다`,
      plain_past: `${stem}${pastCopula}`,
      polite_past: `${stem}${politePastCopula}`,
      plain_negative_past: `${stem}${subjectParticle} 아니었다`,
      polite_negative_past: `${stem}${subjectParticle} 아니었습니다`,
      te_form_a: `${stem}${teCopulaA}`,
      te_form_b: `${stem}${teCopulaB}`,
    };
  }

  if (baseKr.endsWith("되다")) {
    const stem = baseKr.slice(0, -1);
    return {
      plain_present: baseKr,
      polite_present: `${stem}ㅂ니다`.replace(/되ㅂ니다/g, "됩니다"),
      plain_negative: `${stem}지 않다`,
      polite_negative: `${stem}지 않습니다`,
      plain_past: `${stem}었다`,
      polite_past: `${stem}었습니다`,
      plain_negative_past: `${stem}지 않았다`,
      polite_negative_past: `${stem}지 않았습니다`,
      te_form_a: `${stem}고`,
      te_form_b: `${stem}어서`.replace(/되어서/g, "돼서"),
    };
  }

  if (baseKr.endsWith("있다")) {
    const stem = baseKr.slice(0, -2);
    return {
      plain_present: baseKr,
      polite_present: `${stem}있습니다`,
      plain_negative: `${stem}있지 않다`,
      polite_negative: `${stem}있지 않습니다`,
      plain_past: `${stem}있었다`,
      polite_past: `${stem}있었습니다`,
      plain_negative_past: `${stem}있지 않았다`,
      polite_negative_past: `${stem}있지 않았습니다`,
      te_form_a: `${stem}있고`,
      te_form_b: `${stem}있어서`,
    };
  }

  if (baseKr.endsWith("없다")) {
    const stem = baseKr.slice(0, -2);
    return {
      plain_present: baseKr,
      polite_present: `${stem}없습니다`,
      plain_negative: `${stem}없지 않다`,
      polite_negative: `${stem}없지 않습니다`,
      plain_past: `${stem}없었다`,
      polite_past: `${stem}없었습니다`,
      plain_negative_past: `${stem}없지 않았다`,
      polite_negative_past: `${stem}없지 않았습니다`,
      te_form_a: `${stem}없고`,
      te_form_b: `${stem}없어서`,
    };
  }

  if (baseKr.endsWith("다")) {
    const stem = baseKr.slice(0, -1);

    if (stem === "같") {
      return {
        plain_present: "같다",
        polite_present: "같습니다",
        plain_negative: "같지 않다",
        polite_negative: "같지 않습니다",
        plain_past: "같았다",
        polite_past: "같았습니다",
        plain_negative_past: "같지 않았다",
        polite_negative_past: "같지 않았습니다",
        te_form_a: "같고",
        te_form_b: "같아서",
      };
    }

    return {
      plain_present: baseKr,
      polite_present: `${stem}습니다`,
      plain_negative: `${stem}지 않다`,
      polite_negative: `${stem}지 않습니다`,
      plain_past: `${stem}었다`,
      polite_past: `${stem}었습니다`,
      plain_negative_past: `${stem}지 않았다`,
      polite_negative_past: `${stem}지 않았습니다`,
      te_form_a: `${stem}고`,
      te_form_b: `${stem}어서`,
    };
  }

  return {
    plain_present: baseKr,
    polite_present: `${baseKr}입니다`,
    plain_negative: `${baseKr}이 아니다`,
    polite_negative: `${baseKr}이 아닙니다`,
    plain_past: `${baseKr}였다`,
    polite_past: `${baseKr}였습니다`,
    plain_negative_past: `${baseKr}이 아니었다`,
    polite_negative_past: `${baseKr}이 아니었습니다`,
    te_form_a: `${baseKr}이고`,
    te_form_b: `${baseKr}이라서`,
  };
}

function buildNaAdjForms(row: KatsuyouRow): GeneratedForm[] {
  if (row.pos !== "na_adj") return [];

  const baseJp = row.jp;
  const baseKr = normalizeKrPredicateText(row.kr);
  const reading = row.reading;

  const override = NA_KR_OVERRIDE[baseJp];
  const built = buildNaKrPredicateForms(baseKr);

  const plain_present = normalizeKrFormText(override?.plain_present ?? built.plain_present);
  const polite_present = normalizeKrFormText(override?.polite_present ?? built.polite_present);
  const plain_negative = normalizeKrFormText(override?.plain_negative ?? built.plain_negative);
  const polite_negative = normalizeKrFormText(override?.polite_negative ?? built.polite_negative);
  const plain_past = normalizeKrFormText(override?.plain_past ?? built.plain_past);
  const polite_past = normalizeKrFormText(override?.polite_past ?? built.polite_past);
  const plain_negative_past = normalizeKrFormText(
    override?.plain_negative_past ?? built.plain_negative_past
  );
  const polite_negative_past = normalizeKrFormText(
    override?.polite_negative_past ?? built.polite_negative_past
  );
  const te_form_a = normalizeKrFormText(override?.te_form_a ?? built.te_form_a);
  const te_form_b = normalizeKrFormText(override?.te_form_b ?? built.te_form_b);
  const tePromptKr = pickOne([te_form_a, te_form_b] as const);

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
      promptKr: tePromptKr,
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
  pushVerbForm(forms, row, "connective_a", kr.connective_a, jp.te_form);
  pushVerbForm(forms, row, "connective_b", kr.connective_b, jp.te_form);
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

function isConnectiveFormKey(formKey: KatsuyouFormKey): boolean {
  return formKey === "connective_a" || formKey === "connective_b" || formKey === "te_form";
}

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

function isSameJapaneseSurfaceConflict(a: GeneratedForm, b: GeneratedForm): boolean {
  return a.answerJp === b.answerJp;
}

function isConnectiveConflict(a: GeneratedForm, b: GeneratedForm): boolean {
  return isConnectiveFormKey(a.formKey) && isConnectiveFormKey(b.formKey);
}

function shouldExcludeChoiceForJpAnswer(correct: GeneratedForm, candidate: GeneratedForm): boolean {
  if (candidate.answerJp === correct.answerJp) return true;
  if (isConnectiveConflict(correct, candidate)) return true;

  const excludedEquivalent = new Set(getAltEquivalentAnswers(correct));
  if (excludedEquivalent.has(candidate.answerJp)) return true;

  return false;
}

function shouldExcludeChoiceForKrAnswer(correct: GeneratedForm, candidate: GeneratedForm): boolean {
  if (candidate.promptKr === correct.promptKr) return true;

  // 같은 일본어 표면형의 다른 의미(가능/수동 등) 중복 방지
  if (isSameJapaneseSurfaceConflict(correct, candidate)) return true;

  // 연결형은 한 문제에서 하나만 노출
  if (isConnectiveConflict(correct, candidate)) return true;

  return false;
}

function buildChoicesForJpAnswer(form: GeneratedForm, siblings: GeneratedForm[]): string[] {
  const pool = siblings
    .filter((item) => !shouldExcludeChoiceForJpAnswer(form, item))
    .map((item) => item.answerJp);

  const wrongs = shuffleArray(uniqueStrings(pool)).slice(0, 3);
  const merged = uniqueStrings([form.answerJp, ...wrongs]);

  return shuffleArray(merged).slice(0, 4);
}

function buildChoicesForKrAnswer(form: GeneratedForm, siblings: GeneratedForm[]): string[] {
  const pool = siblings
    .filter((item) => !shouldExcludeChoiceForKrAnswer(form, item))
    .map((item) => item.promptKr);

  const wrongs = shuffleArray(uniqueStrings(pool)).slice(0, 3);
  const merged = uniqueStrings([form.promptKr, ...wrongs]);

  return shuffleArray(merged).slice(0, 4);
}

function buildChoicesForForm(
  form: GeneratedForm,
  siblings: GeneratedForm[],
  qtype: KatsuyouQType
): string[] {
  return qtype === "kr2jp"
    ? buildChoicesForJpAnswer(form, siblings)
    : buildChoicesForKrAnswer(form, siblings);
}

function pickValidFormForQuestion(
  forms: GeneratedForm[],
  qtype: KatsuyouQType
): { form: GeneratedForm; choices: string[] } | null {
  const shuffledForms = shuffleArray(forms);

  for (const form of shuffledForms) {
    const choices = buildChoicesForForm(form, forms, qtype);
    if (choices.length >= 4) {
      return { form, choices };
    }
  }

  return null;
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

    const picked = pickValidFormForQuestion(forms, qtype);
    if (!picked) continue;

    const { form: pickedForm, choices } = picked;

    questions.push({
      item_key: String(row.id ?? ""),
      pos: row.pos,
      qtype,
      formKey: pickedForm.formKey,
      prompt: qtype === "kr2jp" ? pickedForm.promptKr : pickedForm.answerJp,
      choices,
      correct_text: qtype === "kr2jp" ? pickedForm.answerJp : pickedForm.promptKr,
      jp_word: pickedForm.baseJp,
      kr_word: pickedForm.baseKr,
      reading: pickedForm.reading,
    });
  }

  return questions;
}

export function buildKatsuyouReviewQuiz({
  rows,
  targets,
}: {
  rows: KatsuyouRow[];
  targets: Array<{
    item_key: string;
    form_key: string;
    qtype: string;
  }>;
}): KatsuyouQuestion[] {
  const questions: KatsuyouQuestion[] = [];

  for (const target of targets) {
    const row = rows.find(
      (r) => String(r.id ?? "").trim() === String(target.item_key).trim()
    );
    if (!row) continue;

    const forms = buildFormsForRow(row);
    if (!forms.length) continue;

    const targetFormKey = String(target.form_key || "").trim();
    const targetQType = String(target.qtype || "").trim() as KatsuyouQType;

    // 1) 먼저 formKey로 원본 form 찾기
    const baseForm = forms.find(
      (form) => String(form.formKey || "").trim() === targetFormKey
    );

    if (!baseForm) continue;

    // 2) 저장된 qtype 기준으로 문제/정답 방향을 다시 구성
    const prompt =
      targetQType === "kr2jp" ? baseForm.promptKr : baseForm.answerJp;

    const correctText =
      targetQType === "kr2jp" ? baseForm.answerJp : baseForm.promptKr;

    if (!prompt || !correctText) continue;

    // 3) 선택지도 저장된 qtype 기준으로 다시 생성
    const siblingPool = forms.filter(
      (form) => String(form.formKey || "").trim() !== targetFormKey
    );

    let choices: string[] = [];

    if (targetQType === "kr2jp") {
      const wrongs = shuffleArray(
        uniqueStrings(
          siblingPool
            .map((form) => form.answerJp)
            .filter((v) => v && v !== correctText)
        )
      ).slice(0, 3);

      choices = shuffleArray(uniqueStrings([correctText, ...wrongs]));
    } else {
      const wrongs = shuffleArray(
        uniqueStrings(
          siblingPool
            .map((form) => form.promptKr)
            .filter((v) => v && v !== correctText)
        )
      ).slice(0, 3);

      choices = shuffleArray(uniqueStrings([correctText, ...wrongs]));
    }

    if (choices.length < 4) {
      const fallbackChoices = buildChoicesForForm(
        {
          ...baseForm,
          qtype: targetQType,
        },
        forms,
        targetQType
      );

      if (fallbackChoices.length >= 4) {
        choices = fallbackChoices;
      }
    }

    if (choices.length < 4) continue;

    questions.push({
      item_key: String(row.id ?? ""),
      pos: row.pos,
      qtype: targetQType,
      formKey: baseForm.formKey,
      prompt,
      choices,
      correct_text: correctText,
      jp_word: baseForm.baseJp,
      kr_word: baseForm.baseKr,
      reading: baseForm.reading,
    });
  }

  return questions;
}