export type WordQType = "reading" | "meaning" | "kr2jp";

export type WordRow = {
  level: string;
  pos: string;
  jp_word: string;
  reading: string;
  meaning: string;
  example_jp?: string;
  example_kr?: string;
};

export type WordQuestion = {
  app: "word";
  qtype: WordQType;
  prompt: string;
  choices: string[];
  correct_text: string;

  jp_word: string;
  reading: string;
  meaning: string;
  level: string;
  pos: string;

  example_jp?: string;
  example_kr?: string;
};

export type WordWrongItem = {
  app: "word";
  qtype: WordQType;
  item_key: string; // jp_word
  jp_word: string;
  reading: string;
  meaning_kr: string;
  pos: string;
  level: string;
  selected: string;
  correct: string;
  example_jp?: string;
  example_kr?: string;
};

export type WordAttemptPayload = {
  user_id: string;
  user_email?: string;
  level?: string;
  pos_mode: string;
  quiz_len: number;
  score: number;
  wrong_count: number;
  wrong_list: WordWrongItem[];
  question_keys: string[];
};