import type { KatsuyouRow, VerbKrFormSet } from "@/app/types/katsuyou";

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
    만나: "만납니다",
    마시: "마십니다",
  };

  return special[root] ?? `${root}습니다`;
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
    서두르: "서둘렀다",
  };

  return special[root] ?? `${root}었다`;
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
    놀: "놀 수 있다",
    달리: "달릴 수 있다",
    헤엄치: "헤엄칠 수 있다",
    만들: "만들 수 있다",
    가르치: "가르칠 수 있다",
    기다리: "기다릴 수 있다",
  };
  if (special[root]) return special[root];

  if (baseKr.endsWith("르다")) {
    return `${baseKr.slice(0, -2)}를 수 있다`;
  }

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
    내리: "내려라",
    쓰: "써라",
  };

  return special[root] ?? `${root}라`;
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
    사다: "사다(수동형)",
    빌리다: "빌리다(수동형)",
    쓰다: "쓰이다",
    버리다: "버려지다",
    자르다: "잘리다",
    알다: "알려지다",
    믿다: "믿어지다",
    열다: "열리다",
    들어가다: "들어가게 되다",
    돌아가다: "돌아가다(수동형)",
    일어나다: "일어나지다",
    가지다: "가지다(수동형)",
    헤엄치다: "헤엄치다(수동형)",
    달리다: "달리다(수동형)",
    듣다: "듣다(수동형)",
    죽다: "죽다(수동형)",
  };

  if (special[baseKr]) return special[baseKr];

  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}되다`;

  return `${stripDa(baseKr)}되다`;
}

function toCausative(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하게 하다`;
  return `${stripDa(baseKr)}게 하다`;
}

function toCausativePassive(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `(억지로) ${stemForHada(baseKr)}하게 되다`;
  return `(억지로) ${stripDa(baseKr)}게 되다`;
}

function toConnectiveA(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하고`;
  return `${stripDa(baseKr)}고`;
}

function toConnectiveB(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}해서`;

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    자: "자서",
    빌리: "빌려서",
    닫: "닫아서",
    죽: "죽어서",
    마시: "마셔서",
    내리: "내려서",
    기다리: "기다려서",
    읽: "읽어서",
    헤엄치: "헤엄쳐서",
    가르치: "가르쳐서",
    달리: "달려서",
    쓰: "써서",
    놀: "놀아서",
    서두르: "서둘러서",
    건너: "건너서",
    열: "열어서",
    보: "봐서",
    와: "와서",
  };

  if (special[root]) return special[root];

  return `${root}어서`;
}

function buildRestrictedNeedForms(): VerbKrFormSet {
  return {
    plain_present: "필요하다",
    polite_present: "필요합니다",
    plain_negative: "필요하지 않다",
    plain_past: "필요했다",
    plain_negative_past: "필요하지 않았다",
    connective_a: "필요하고",
    connective_b: "필요해서",
    potential: "",
    imperative: "",
    volitional: "",
    passive: "",
    causative: "",
    causative_passive: "",
  };
}

function applyBoolGate(value: string, allowed?: boolean): string {
  if (allowed === false) return "";
  return value;
}

function applyPassiveType(value: string, passiveType?: KatsuyouRow["passive_type"]): string {
  if (passiveType === "none") return "";
  return value;
}

export function buildVerbKrForms(row: KatsuyouRow): VerbKrFormSet {
  const baseKr = row.kr;

  if (baseKr === "필요하다") {
    return buildRestrictedNeedForms();
  }

  const polite_present = row.kr_polite_present_override || toPolitePresent(baseKr);
  const plain_past = row.kr_past_override || toPast(baseKr);

  const connective_a = row.kr_connective_a || toConnectiveA(baseKr);
  const connective_b = row.kr_connective_b || toConnectiveB(baseKr);

  const potential = applyBoolGate(
    row.kr_potential_override || toPotential(baseKr),
    row.can_potential
  );

  const imperative = applyBoolGate(
    row.kr_imperative_override || toImperative(baseKr),
    row.can_imperative
  );

  const volitional = applyBoolGate(
    toVolitional(baseKr),
    row.can_volitional
  );

  const passive = applyPassiveType(
    row.kr_passive_override || toPassive(baseKr),
    row.passive_type
  );

  const causative = applyBoolGate(
    toCausative(baseKr),
    row.can_causative
  );

  const causative_passive = applyBoolGate(
    toCausativePassive(baseKr),
    row.can_causative_passive
  );

  return {
    plain_present: baseKr,
    polite_present,
    plain_negative: toNegative(baseKr),
    plain_past,
    plain_negative_past: toNegativePast(baseKr),
    connective_a,
    connective_b,
    potential,
    imperative,
    volitional,
    passive,
    causative,
    causative_passive,
  };
}