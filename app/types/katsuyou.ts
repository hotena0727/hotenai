export type KatsuyouPos = "i_adj" | "na_adj" | "verb";
export type KatsuyouQType = "kr2jp" | "jp2kr";
export type KrPattern = "it" | "eu" | "wo" | "ha" | "reu";
export type VerbGroup = "ichidan" | "godan" | "irregular";

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
  kr_root?: string;
  kr_pattern?: KrPattern;
  verb_group?: VerbGroup;
};

export type KatsuyouQuestion = {
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