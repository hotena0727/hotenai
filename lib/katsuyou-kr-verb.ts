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

function vowelIndex(ch: string): number | null {
  const s = splitSyllable(ch);
  return s ? s.jung : null;
}

function addBieupBatchim(word: string): string {
  const ch = lastChar(word);
  const s = splitSyllable(ch);
  if (!s || s.jong !== 0) return word;
  return word.slice(0, -1) + makeSyllable(s.cho, s.jung, 17);
}

function addRieulBatchim(word: string): string {
  const ch = lastChar(word);
  const s = splitSyllable(ch);
  if (!s || s.jong !== 0) return word;
  return word.slice(0, -1) + makeSyllable(s.cho, s.jung, 8);
}

function chooseAeo(root: string): "아" | "어" {
  const v = vowelIndex(lastChar(root));
  if (v === 0 || v === 8) return "아";
  return "어";
}

function mergeNoBatchim(root: string, suffix: "아" | "어"): string | null {
  const ch = lastChar(root);
  const s = splitSyllable(ch);
  if (!s || s.jong !== 0) return null;

  if (suffix === "아") {
    if (s.jung === 0) return root;
    if (s.jung === 8) return replaceLast(root, makeSyllable(s.cho, 9, 0));
  }

  if (suffix === "어") {
    if (s.jung === 4) return root;
    if (s.jung === 13) return replaceLast(root, makeSyllable(s.cho, 14, 0));
    if (s.jung === 20) return replaceLast(root, makeSyllable(s.cho, 5, 0));
  }

  return null;
}

function makeEoAStem(root: string): string {
  const direct: Record<string, string> = {
    보: "봐",
    쓰: "써",
    주: "줘",
    두: "둬",
    마시: "마셔",
    빌리: "빌려",
    기다리: "기다려",
    세우: "세워",
    배우: "배워",
    깨우: "깨워",
    내리: "내려",
    헤엄치: "헤엄쳐",
    가르치: "가르쳐",
    달리: "달려",
    고르: "골라",
    자르: "잘라",
    서두르: "서둘러",
    돌려주: "돌려줘",
    꺼내: "꺼내",
    넣: "넣어",
    돌아가: "돌아가",
    가지: "가져",
    돕: "도와",
    듣: "들어",
  };
  if (direct[root]) return direct[root];

  if (root.endsWith("르")) {
    const front = root.slice(0, -1);
    const before = front.slice(0, -1);
    const withRieul = addRieulBatchim(before);
    const aeo = chooseAeo(withRieul);
    return `${withRieul}${aeo}`;
  }

  const aeo = chooseAeo(root);
  const merged = mergeNoBatchim(root, aeo);
  if (merged) return merged;

  return `${root}${aeo}`;
}

function makePolitePresent(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}합니다`;

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    가: "갑니다",
    오: "옵니다",
    보: "봅니다",
    쓰: "씁니다",
    사: "삽니다",
    놀: "놉니다",
    만들: "만듭니다",
    알: "압니다",
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
    가지: "가집니다",
    돌려주: "돌려줍니다",
    꺼내: "꺼냅니다",
    넣: "넣습니다",
  };
  if (special[root]) return special[root];

  const last = lastChar(root);
  if (hasBatchim(last)) return `${root}습니다`;

  return `${addBieupBatchim(root)}니다`;
}

function makePast(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}했다`;

  const root = stripDa(baseKr);

  const special: Record<string, string> = {
    빌리: "빌렸다",
    기다리: "기다렸다",
    내리: "내렸다",
    만나: "만났다",
    알: "알았다",
    만들: "만들었다",
    들어가: "들어갔다",
    돌아가: "돌아갔다",
    일어나: "일어났다",
    달리: "달렸다",
    쓰: "썼다",
    버리: "버렸다",
    마시: "마셨다",
    서: "섰다",
    서두르: "서둘렀다",
    사: "샀다",
    보: "봤다",
    고르: "골랐다",
    자르: "잘랐다",
    세우: "세웠다",
    배우: "배웠다",
    깨우: "깨웠다",
    주: "줬다",
    두: "뒀다",
    돌려주: "돌려줬다",
    넣: "넣었다",
    꺼내: "꺼냈다",
    가지: "가졌다",
    듣: "들었다",
    돕: "도왔다",
    타: "탔다",
    건너: "건넜다",
  };
  if (special[root]) return special[root];

  const eoa = makeEoAStem(root);

  if (eoa.endsWith("아")) return `${eoa.slice(0, -1)}았다`;
  if (eoa.endsWith("어")) return `${eoa.slice(0, -1)}었다`;
  if (eoa.endsWith("여")) return `${eoa.slice(0, -1)}였다`;
  if (eoa.endsWith("봐")) return "봤다";
  if (eoa.endsWith("써")) return "썼다";
  if (eoa.endsWith("워")) return `${eoa.slice(0, -1)}웠다`;
  if (eoa.endsWith("와")) return `${eoa.slice(0, -1)}왔다`;
  if (eoa.endsWith("려")) return `${eoa.slice(0, -1)}렸다`;
  if (eoa.endsWith("셔")) return `${eoa.slice(0, -1)}셨다`;
  if (eoa.endsWith("쳐")) return `${eoa.slice(0, -1)}쳤다`;
  if (eoa.endsWith("켜")) return `${eoa.slice(0, -1)}켰다`;

  return `${root}었다`;
}

function makePotential(baseKr: string): string {
  if (isHadaVerb(baseKr)) return `${stemForHada(baseKr)}할 수 있다`;

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
  ]);
  if (blocked.has(baseKr)) return "";

  const root = stripDa(baseKr);

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
    돕: "도울 수 있다",
    멈추: "멈출 수 있다",
    타: "탈 수 있다",
    오: "올 수 있다",
    가: "갈 수 있다",
    마시: "마실 수 있다",
    빌리: "빌릴 수 있다",
    사: "살 수 있다",
  };
  if (special[root]) return special[root];

  if (baseKr.endsWith("르다")) return `${baseKr.slice(0, -2)}를 수 있다`;

  const last = lastChar(root);
  if (hasBatchim(last)) return `${root}을 수 있다`;
  return `${addRieulBatchim(root)} 수 있다`;
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
    듣: "들어라",
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
    버리: "버려라",
    세우: "세워라",
    고르: "골라라",
    사: "사라",
    깨우: "깨워라",
    배우: "배워라",
    자르: "잘라라",
    말하: "말해라",
    서두르: "서둘러라",
    돌려주: "돌려줘라",
    꺼내: "꺼내라",
    넣: "넣어라",
    돕: "도와라",
  };
  if (special[root]) return special[root];

  return `${makeEoAStem(root)}라`;
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

  const semantic: Record<string, string> = {
    돌려주다: "돌려받다",
  };
  if (semantic[baseKr]) return semantic[baseKr];

  const natural: Record<string, string> = {
    쓰다: "쓰이다",
    버리다: "버려지다",
    자르다: "잘리다",
    알다: "알려지다",
    믿다: "믿어지다",
    보다: "보여지다",
    만들다: "만들어지다",
    열다: "열리다",
    세우다: "세워지다",
    깨우다: "일으켜지다",
    조사하다: "조사되다",
    넣다: "넣어지다",
    꺼내다: "꺼내지다",
    읽다: "읽히다",
    타다: "타지다",
    가르치다: "가르쳐지다",
    먹다: "먹히다",
    멈추다: "멈춰지다",
  };
  if (natural[baseKr]) return natural[baseKr];

  const descriptive: Record<string, string> = {
    사다: "사다(수동형)",
    빌리다: "빌리다(수동형)",
    가지다: "가지다(수동형)",
    고르다: "고르다(수동형)",
    내리다: "내리다(수동형)",
    헤엄치다: "헤엄치다(수동형)",
    달리다: "달리다(수동형)",
    놀다: "놀다(수동형)",
    서다: "서다(수동형)",
    앉다: "앉다(수동형)",
    듣다: "듣다(수동형)",
    죽다: "죽다(수동형)",
    돌아가다: "돌아가다(수동형)",
    대답하다: "대답하다(수동형)",
    노래하다: "노래하다(수동형)",
    샤워하다: "샤워하다(수동형)",
    서두르다: "서두르다(수동형)",
    기다리다: "기다리다(수동형)",
    들어가다: "들어가지다",
    일어나다: "일어나지다",
    돕다: "돕다(수동형)",
    건너다: "건너다(수동형)",
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
    "대답하다",
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
    듣: "들어서",
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
    돌려주: "돌려줘서",
    노래하: "노래해서",
    꺼내: "꺼내서",
    넣: "넣어서",
    돌아가: "돌아가서",
    가지: "가져서",
    돕: "도와서",
  };
  if (special[root]) return special[root];

  return `${makeEoAStem(root)}서`;
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

  if (baseKr === "필요하다" || row.kr_root === "필요하") {
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

  if (baseKr === "가지다" || row.kr_root === "가지") {
    return {
      plain_present: "가지다",
      polite_present: "가집니다",
      plain_negative: "가지지 않다",
      plain_past: "가졌다",
      plain_negative_past: "가지지 않았다",
      connective_a: "갖고",
      connective_b: "가져서",
      potential: "",
      imperative: "",
      volitional: "",
      passive: "가지다(수동형)",
      causative: "",
      causative_passive: "",
    };
  }

  const polite_present = row.kr_polite_present_override || makePolitePresent(baseKr);
  const plain_past = row.kr_past_override || makePast(baseKr);

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