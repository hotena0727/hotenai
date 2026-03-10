import type { KatsuyouRow } from "@/app/types/katsuyou";

export type VerbKrFormSet = {
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

function stripDa(word: string): string {
  return word.endsWith("다") ? word.slice(0, -1) : word;
}

function isHadaVerb(baseKr: string): boolean {
  return baseKr.endsWith("하다");
}

function stemForHada(baseKr: string): string {
  return baseKr.slice(0, -2);
}

function toPolitePresent(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}합니다`;

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    사: "삽니다",
    놀: "놉니다",
    나가: "나갑니다",
    일어나: "일어납니다",
    열: "엽니다",
    자르: "자릅니다",
    빌리: "빌립니다",
    건너: "건넙니다",
    쓰: "씁니다",
  };
  if (special[root]) return special[root];

  return `${root}습니다`;
}

function toPast(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}했다`;

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    빌리: "빌렸다",
    기다리: "기다렸다",
    내리: "내렸다",
    만나: "만났다",
    알: "알았다",
    들어가: "들어갔다",
    일어나: "일어났다",
    달리: "달렸다",
    쓰: "썼다",
    버리: "버렸다",
    마시: "마셨다",
    서: "섰다",
  };
  if (special[root]) return special[root];

  return `${root}었다`;
}

function toNegative(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하지 않다`;
  return `${stripDa(baseKr)}지 않다`;
}

function toNegativePast(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하지 않았다`;
  return `${stripDa(baseKr)}지 않았다`;
}

function toPotential(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}할 수 있다`;

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    자: "잘 수 있다",
    보: "볼 수 있다",
    사: "살 수 있다",
    놀: "놀 수 있다",
    달리: "달릴 수 있다",
    헤엄치: "헤엄칠 수 있다",
    만들: "만들 수 있다",
    일어나: "일어날 수 있다",
    나가: "나갈 수 있다",
    자르: "자를 수 있다",
    가르치: "가르칠 수 있다",
    건너: "건널 수 있다",
  };
  if (special[root]) return special[root];

  return `${root}을 수 있다`;
}

function toImperative(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}해라`;

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    보: "봐라",
    가지: "가져라",
    먹: "먹어라",
    닫: "닫아라",
    열: "열어라",
    입: "입어라",
    마시: "마셔라",
    가르치: "가르쳐라",
    헤엄치: "헤엄쳐라",
    달리: "달려라",
    놀: "놀아라",
  };
  if (special[root]) return special[root];

  return `${root}라`;
}

function toVolitional(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하자`;
  return `${stripDa(baseKr)}자`;
}

function toPassive(baseKr: string): string {
  const special: Record<string, string> = {
    조사하다: "조사되다",
    샤워하다: "샤워하다(수동형)",
    대답하다: "대답하다(수동형)",
    노래하다: "노래하다(수동형)",
    공부하다: "",
    필요하다: "",
    쓰다: "쓰이다",
    버리다: "버려지다",
    자르다: "잘리다",
    알다: "알려지다",
    믿다: "믿어지다",
    열다: "열리다",
    들어가다: "들어가게 되다",
    돌아가다: "돌아가다(수동형)",
    일어나다: "일어나게 되다",
    가지다: "가지게 되다",
    헤엄치다: "헤엄치다(수동형)",
    달리다: "달리다(수동형)",
    듣다: "듣다(수동형)",
    죽다: "죽다(수동형)",
    마시다: "",
    만나다: "",
  };

  if (baseKr in special) return special[baseKr];

  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}되다`;

  return `${stripDa(baseKr)}되다`;
}

function toCausative(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하게 하다`;
  return `${stripDa(baseKr)}게 하다`;
}

function toCausativePassive(baseKr: string): string {
  if (baseKr === "필요하다") return "";
  if (isHadaVerb(baseKr)) return `(억지로) ${stemForHada(baseKr)}하게 되다`;
  return `(억지로) ${stripDa(baseKr)}게 되다`;
}

function toConnective(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하고`;

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    가: "가서",
    오: "와서",
    보: "봐서",
    자르: "잘라서",
    기다리: "기다려서",
    마시: "마셔서",
    헤엄치: "헤엄쳐서",
    가르치: "가르쳐서",
    일어나: "일어나서",
    들어가: "들어가서",
    내리: "내려서",
    서: "서서",
    놀: "놀아서",
    건너: "건너서",
    열: "열어서",
  };
  if (special[root]) return special[root];

  return `${root}해서`;
}

const OVERRIDE: Record<string, Partial<VerbKrFormSet>> = {
  가다: {
    polite_present: "갑니다",
    plain_past: "갔다",
    potential: "갈 수 있다",
    imperative: "가라",
    passive: "가게 되다",
    causative: "가게 하다",
    causative_passive: "(억지로) 가게 되다",
    te_form: "가서",
  },
  오다: {
    polite_present: "옵니다",
    plain_past: "왔다",
    potential: "올 수 있다",
    imperative: "오라",
    passive: "오게 되다",
    causative: "오게 하다",
    causative_passive: "(억지로) 오게 되다",
    te_form: "와서",
  },
  하다: {
    passive: "되다",
  },
};

export function buildVerbKrForms(row: KatsuyouRow): VerbKrFormSet {
  const baseKr = row.kr;

  const base: VerbKrFormSet = {
    plain_present: baseKr,
    polite_present: toPolitePresent(baseKr),
    plain_negative: toNegative(baseKr),
    plain_past: toPast(baseKr),
    plain_negative_past: toNegativePast(baseKr),
    te_form: toConnective(baseKr),
    potential: toPotential(baseKr),
    imperative: toImperative(baseKr),
    volitional: toVolitional(baseKr),
    passive: toPassive(baseKr),
    causative: toCausative(baseKr),
    causative_passive: toCausativePassive(baseKr),
  };

  return {
    ...base,
    ...(OVERRIDE[baseKr] ?? {}),
  };
}