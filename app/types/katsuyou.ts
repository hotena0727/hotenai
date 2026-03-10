export type KatsuyouPos = "i_adj" | "na_adj" | "verb";
export type KatsuyouQType = "kr2jp" | "jp2kr";
export type KrPattern = "it" | "eu" | "wo" | "ha" | "reu";
export type PassiveType = "natural" | "descriptive" | "none";
export type VerbGroup = "godan" | "ichidan" | "irregular";

export type KatsuyouFormKey =
  | "plain_present"
  | "polite_present"
  | "plain_negative"
  | "polite_negative"
  | "plain_past"
  | "polite_past"
  | "plain_negative_past"
  | "polite_negative_past"
  | "adverbial"
  | "te_form"
  | "connective_a"
  | "connective_b"
  | "potential"
  | "imperative"
  | "volitional"
  | "passive"
  | "causative"
  | "causative_passive";

export type KatsuyouRow = {
  id?: string;
  pos: KatsuyouPos;
  jp: string;
  kr: string;
  reading?: string;

  // i-adj / na-adj
  kr_root?: string;
  kr_pattern?: KrPattern;

  // verb
  verb_group?: VerbGroup;

  can_potential?: boolean;
  passive_type?: PassiveType;
  can_causative?: boolean;
  can_causative_passive?: boolean;
  can_volitional?: boolean;
  can_imperative?: boolean;

  kr_connective_a?: string;
  kr_connective_b?: string;

  kr_passive_override?: string;
  kr_potential_override?: string;
  kr_imperative_override?: string;
  kr_polite_present_override?: string;
  kr_past_override?: string;
};

export type KatsuyouQuestion = {
  item_key?: string;  
  pos: KatsuyouPos;
  qtype: KatsuyouQType;
  formKey: KatsuyouFormKey;
  prompt: string;
  choices: string[];
  correct_text: string;
  jp_word: string;
  kr_word: string;
  reading?: string;
};

export type GeneratedForm = {
  pos: KatsuyouPos;
  qtype: KatsuyouQType;
  formKey: KatsuyouFormKey;
  promptKr: string;
  answerJp: string;
  baseJp: string;
  baseKr: string;
  reading?: string;
};

export type KrForms = {
  plain_present: string;
  polite_present: string;
  plain_negative: string;
  polite_negative: string;
  plain_past: string;
  polite_past: string;
  plain_negative_past: string;
  polite_negative_past: string;
  adverbial: string;
  te_form_a: string;
  te_form_b: string;
};

export type VerbKrFormSet = {
  plain_present: string;
  polite_present: string;
  plain_negative: string;
  plain_past: string;
  plain_negative_past: string;
  connective_a: string; // ~고
  connective_b: string; // ~아서/~어서/~해서
  potential: string;
  imperative: string;
  volitional: string;
  passive: string;
  causative: string;
  causative_passive: string;
};

export type VerbJpFormSet = {
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