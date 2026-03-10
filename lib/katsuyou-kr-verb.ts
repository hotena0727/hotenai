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

function lastChar(word: string): string {
  return word[word.length - 1] ?? "";
}

function hasBatchim(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function vowelOf(ch: string): number | null {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const base = code - 0xac00;
  return Math.floor((base % 588) / 28);
}

function jongOf(ch: string): number | null {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const base = code - 0xac00;
  return base % 28;
}

function makeSyllable(cho: number, jung: number, jong: number): string {
  return String.fromCharCode(0xac00 + cho * 588 + jung * 28 + jong);
}

function splitSyllable(ch: string): { cho: number; jung: number; jong: number } | null {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const base = code - 0xac00;
  return {
    cho: Math.floor(base / 588),
    jung: Math.floor((base % 588) / 28),
    jong: base % 28,
  };
}

function replaceLast(word: string, ch: string): string {
  return word.slice(0, -1) + ch;
}

function mergeNoBatchimWithSuffix(last: string, suffixVowelChar: "아" | "어"): string | null {
  const s = splitSyllable(last);
  if (!s || s.jong !== 0) return null;

  if (suffixVowelChar === "아") {
    if (s.jung === 8) return makeSyllable(s.cho, 9, 0); // ㅗ + ㅏ = ㅘ
    if (s.jung === 0) return last; // ㅏ + 아 = ㅏ
  }

  if (suffixVowelChar === "어") {
    if (s.jung === 13) return makeSyllable(s.cho, 14, 0); // ㅜ + ㅓ = ㅝ
    if (s.jung === 4) return makeSyllable(s.cho, 5, 0); // ㅓ + 어 = ㅓ
    if (s.jung === 20) return makeSyllable(s.cho, 5, 0); // ㅣ + 어 = ㅕ
    if (s.jung === 5) return last; // ㅔ + 어 -> mostly 유지
  }

  return null;
}

function chooseAeo(root: string): "아" | "어" {
  const v = vowelOf(lastChar(root));
  if (v === 0 || v === 8) return "아"; // ㅏ, ㅗ
  return "어";
}

function makeEoyoForm(root: string): string {
  const special: Record<string, string> = {
    보: "봐",
    쓰: "써",
    사: "사",
    자: "자",
    서: "서",
    켜: "켜",
  };
  if (special[root]) return special[root];

  if (root.endsWith("르")) {
    const front = root.slice(0, -1); // ...르 -> ...르
    const before = front.slice(0, -1); // ... (drop 르)
    const prev = lastChar(before);
    const s = splitSyllable(prev);
    if (s) {
      const withRieul = makeSyllable(s.cho, s.jung, 8); // ㄹ 받침
      const before2 = replaceLast(before, withRieul);
      const aeo = chooseAeo(before2);
      return `${before2}${aeo}`;
    }
  }

  const last = lastChar(root);
  const aeo = chooseAeo(root);
  const merged = mergeNoBatchimWithSuffix(last, aeo);
  if (merged) {
    return replaceLast(root, merged);
  }

  if (hasBatchim(last)) {
    return `${root}${aeo}`;
  }

  return `${root}${aeo}`;
}

function makePastForm(root: string): string {
  const eoYo = makeEoyoForm(root);

  const special: Record<string, string> = {
    사: "샀다",
    보: "봤다",
    쓰: "썼다",
    서: "섰다",
    고르: "골랐다",
    모르: "몰랐다",
    자르: "잘랐다",
    서두르: "서둘렀다",
    빌리: "빌렸다",
    기다리: "기다렸다",
    마시: "마셨다",
    세우: "세웠다",
    배우: "배웠다",
    깨우: "깨웠다",
    주: "줬다",
    두: "뒀다",
    버리: "버렸다",
    내리: "내렸다",
    만나: "만났다",
    알: "알았다",
    들어가: "들어갔다",
    일어나: "일어났다",
    달리: "달렸다",
  };
  if (special[root]) return special[root];

  if (eoYo.endsWith("아") || eoYo.endsWith("어") || eoYo.endsWith("여")) {
    return `${eoYo}ㅆ다`
      .replace("아ㅆ다", "았다")
      .replace("어ㅆ다", "었다")
      .replace("여ㅆ다", "였다");
  }

  if (eoYo.endsWith("와")) return `${eoYo.slice(0, -1)}왔다`;
  if (eoYo.endsWith("워")) return `${eoYo.slice(0, -1)}웠다`;
  if (eoYo.endsWith("려")) return `${eoYo}ㅆ다`.replace("려ㅆ다", "렸다");
  if (eoYo.endsWith("셔")) return `${eoYo}ㅆ다`.replace("셔ㅆ다", "셨다");
  if (eoYo.endsWith("켜")) return `${eoYo}ㅆ다`.replace("켜ㅆ다", "켰다");
  if (eoYo.endsWith("춰")) return `${eoYo}ㅆ다`.replace("춰ㅆ다", "췄다");
  if (eoYo.endsWith("워")) return `${eoYo}ㅆ다`.replace("워ㅆ다", "웠다");
  if (eoYo.endsWith("와")) return `${eoYo}ㅆ다`.replace("와ㅆ다", "왔다");
  if (eoYo.endsWith("봐")) return "봤다";
  if (eoYo.endsWith("써")) return "썼다";

  return `${eoYo}서`.replace(/서$/, "었다");
}

function makePolitePresent(root: string): string {
  const special: Record<string, string> = {
    보: "봅니다",
    쓰: "씁니다",
    사: "삽니다",
    놀: "놉니다",
    나가: "나갑니다",
    일어나: "일어납니다",
    열: "엽니다",
    자르: "자릅니다",
    빌리: "빌립니다",
    건너: "건넙니다",
    만나: "만납니다",
    마시: "마십니다",
    고르: "고릅니다",
    세우: "세웁니다",
    배우: "배웁니다",
    깨우: "깨웁니다",
  };
  if (special[root]) return special[root];

  const last = lastChar(root);
  return hasBatchim(last) ? `${root}습니다` : `${root}ㅂ니다`.replace("ㅂ니다", "ㅂ니다");
}

function makePotential(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}할 수 있다`;

  const root = stripDa(baseKr);

  const blocked = new Set([
    "필요하다",
    "만나다",
    "가지다",
    "죽다",
    "알다",
    "믿다",
    "일어나다",
    "들어가다",
    "돌아가다",
    "서두르다",
    "빌리다",
    "사다",
  ]);
  if (blocked.has(baseKr)) return "";

  const special: Record<string, string> = {
    쓰: "쓸 수 있다",
    보: "볼 수 있다",
    자: "잘 수 있다",
    읽: "읽을 수 있다",
    먹: "먹을 수 있다",
    듣: "들을 수 있다",
    닫: "닫을 수 있다",
    열: "열 수 있다",
    놀: "놀 수 있다",
    달리: "달릴 수 있다",
    헤엄치: "헤엄칠 수 있다",
    만들: "만들 수 있다",
    가르치: "가르칠 수 있다",
    기다리: "기다릴 수 있다",
    건너: "건널 수 있다",
    세우: "세울 수 있다",
    깨우: "깨울 수 있다",
    배우: "배울 수 있다",
    고르: "고를 수 있다",
    자르: "자를 수 있다",
    넣: "넣을 수 있다",
    꺼내: "꺼낼 수 있다",
    돌려주: "돌려줄 수 있다",
    도우: "도울 수 있다",
    멈추: "멈출 수 있다",
    타: "탈 수 있다",
    오: "올 수 있다",
    가: "갈 수 있다",
    마시: "마실 수 있다",
  };
  if (special[root]) return special[root];

  if (baseKr.endsWith("르다")) {
    return `${baseKr.slice(0, -2)}를 수 있다`;
  }

  const last = lastChar(root);
  return hasBatchim(last) ? `${root}을 수 있다` : `${root}ㄹ 수 있다`.replace("ㄹ 수 있다", "ㄹ 수 있다");
}

function makeImperative(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}해라`;

  const blocked = new Set([
    "필요하다",
    "죽다",
    "믿다",
    "알다",
    "만나다",
    "가지다",
  ]);
  if (blocked.has(baseKr)) return "";

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    쓰: "써라",
    보: "봐라",
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
    빌리: "빌려라",
    세우: "세워라",
    고르: "골라라",
    사: "사라",
    깨우: "깨워라",
    배우: "배워라",
    자르: "잘라라",
    말하: "말해라",
  };
  if (special[root]) return special[root];

  const eoYo = makeEoyoForm(root);
  return `${eoYo}라`;
}

function makeVolitional(baseKr: string): string {
  const blocked = new Set([
    "필요하다",
    "죽다",
    "믿다",
    "알다",
    "가지다",
  ]);
  if (blocked.has(baseKr)) return "";

  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하자`;
  return `${stripDa(baseKr)}자`;
}

function makePassive(baseKr: string): string {
  const blocked = new Set([
    "만나다",
    "마시다",
    "필요하다",
    "공부하다",
  ]);
  if (blocked.has(baseKr)) return "";

  const natural: Record<string, string> = {
    쓰다: "쓰이다",
    버리다: "버려지다",
    자르다: "잘리다",
    알다: "알려지다",
    믿다: "믿어지다",
    열다: "열리다",
    세우다: "세워지다",
    조사하다: "조사되다",
  };
  if (natural[baseKr]) return natural[baseKr];

  const descriptive: Record<string, string> = {
    사다: "사다(수동형)",
    빌리다: "빌리다(수동형)",
    가지다: "가지다(수동형)",
    헤엄치다: "헤엄치다(수동형)",
    달리다: "달리다(수동형)",
    듣다: "듣다(수동형)",
    죽다: "죽다(수동형)",
    돌아가다: "돌아가다(수동형)",
    대답하다: "대답하다(수동형)",
    노래하다: "노래하다(수동형)",
    샤워하다: "샤워하다(수동형)",
    서두르다: "서두르다(수동형)",
    들어가다: "들어가게 되다",
    일어나다: "일어나지다",
  };
  if (descriptive[baseKr]) return descriptive[baseKr];

  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}되다`;
  return `${stripDa(baseKr)}되다`;
}

function makeCausative(baseKr: string): string {
  const blocked = new Set([
    "필요하다",
    "죽다",
    "만나다",
    "가지다",
    "알다",
    "믿다",
  ]);
  if (blocked.has(baseKr)) return "";

  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하게 하다`;
  return `${stripDa(baseKr)}게 하다`;
}

function makeCausativePassive(baseKr: string): string {
  const blocked = new Set([
    "필요하다",
    "죽다",
    "만나다",
    "마시다",
    "가지다",
    "알다",
    "믿다",
    "빌리다",
    "헤엄치다",
    "달리다",
    "답하다",
    "노래하다",
  ]);
  if (blocked.has(baseKr)) return "";

  if (isHadaVerb(baseKr)) return `(억지로) ${stemForHada(baseKr)}하게 되다`;
  return `(억지로) ${stripDa(baseKr)}게 되다`;
}

function makeConnectiveA(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}하고`;
  return `${stripDa(baseKr)}고`;
}

function makeConnectiveB(baseKr: string): string {
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
    세우: "세워서",
    깨우: "깨워서",
    배우: "배워서",
    고르: "골라서",
    자르: "잘라서",
    사: "사서",
    말하: "말해서",
  };
  if (special[root]) return special[root];

  const eoYo = makeEoyoForm(root);
  return `${eoYo}서`;
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

function gate(value: string, allowed?: boolean): string {
  if (allowed === false) return "";
  return value;
}

function passiveGate(value: string, passiveType?: KatsuyouRow["passive_type"]): string {
  if (passiveType === "none") return "";
  return value;
}

export function buildVerbKrForms(row: KatsuyouRow): VerbKrFormSet {
  const baseKr = row.kr;

  if (baseKr === "필요하다") {
    return buildRestrictedNeedForms();
  }

  const polite_present = row.kr_polite_present_override || makePolitePresent(stripDa(baseKr));
  const plain_past = row.kr_past_override || makePastForm(stripDa(baseKr));

  const connective_a = row.kr_connective_a || makeConnectiveA(baseKr);
  const connective_b = row.kr_connective_b || makeConnectiveB(baseKr);

  const potential = gate(
    row.kr_potential_override || makePotential(baseKr),
    row.can_potential
  );

  const imperative = gate(
    row.kr_imperative_override || makeImperative(baseKr),
    row.can_imperative
  );

  const volitional = gate(
    makeVolitional(baseKr),
    row.can_volitional
  );

  const passive = passiveGate(
    row.kr_passive_override || makePassive(baseKr),
    row.passive_type
  );

  const causative = gate(
    makeCausative(baseKr),
    row.can_causative
  );

  const causative_passive = gate(
    makeCausativePassive(baseKr),
    row.can_causative_passive
  );

  return {
    plain_present: baseKr,
    polite_present,
    plain_negative: isHadaVerb(baseKr)
      ? `${stemForHada(baseKr)}하지 않다`
      : `${stripDa(baseKr)}지 않다`,
    plain_past,
    plain_negative_past: isHadaVerb(baseKr)
      ? `${stemForHada(baseKr)}하지 않았다`
      : `${stripDa(baseKr)}지 않았다`,
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