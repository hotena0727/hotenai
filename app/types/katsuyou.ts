export type KatsuyouPos = "i_adj" | "na_adj" | "verb";
export type KatsuyouQType = "kr2jp" | "jp2kr";

export type KatsuyouRow = {
  id?: string;
  pos: KatsuyouPos;
  jp: string;
  kr: string;
  reading?: string;
};

export type KatsuyouQuestion = {
  pos: KatsuyouPos;
  qtype: KatsuyouQType;
  prompt: string;
  choices: string[];
  correct_text: string;
  jp_word: string;
  kr_word: string;
  reading?: string;
};