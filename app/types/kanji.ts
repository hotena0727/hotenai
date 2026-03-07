export type KanjiQType = "reading" | "meaning" | "kr2jp";

export type KanjiRow = {
  level: string;
  jp_word: string;
  reading: string;
  meaning: string;
  pos: string;
};

export type KanjiQuestion = {
  app: "kanji";
  qtype: KanjiQType;
  prompt: string;
  choices: string[];
  correct_text: string;

  jp_word: string;
  reading: string;
  meaning: string;
  level: string;
  pos: string;
};

export type KanjiWrongItem = {
  app: "kanji";
  qtype: KanjiQType;
  item_key: string; // jp_word
  jp_word: string;
  reading: string;
  meaning_kr: string;
  pos: string;
  level: string;
  selected: string;
  correct: string;
};

export type KanjiAttemptPayload = {
  user_id: string;
  user_email?: string;
  level?: string;
  pos_mode: string;
  quiz_len: number;
  score: number;
  wrong_count: number;
  wrong_list: KanjiWrongItem[];
};