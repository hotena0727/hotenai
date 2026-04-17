export type TalkCsvRow = {
  item_key?: string;
  qid: string;
  level: string;
  tag: string;
  tag_kr: string;
  sub: string;
  sub_kr: string;
  situation_kr: string;
  partner_jp: string;
  partner_mp3: string;
  partner_kr: string;
  answer_jp: string;
  answer_yomi: string;
  answer_mp3: string;
  answer_kr: string;
  d1_jp: string;
  d2_jp: string;
  d3_jp: string;
  hint_kr: string;
  mode: string;
  section: string;
  stage: string;
  explain_kr: string;
};

export type TalkWrongItem = {
  app?: "talk";
  qtype?: "choice";
  item_key?: string;
  qid: string;
  selected: string;
  correct: string;
};

export type RecentTurn = {
  qid: string;
  situation_kr: string;
  partner_jp: string;
  selected: string;
  correct: string;
  ok: boolean | null;
};

export type ViewMode = "select" | "quiz" | "done";

export type TagOption = {
  value: string;
  label: string;
};

export type SubOption = {
  value: string;
  label: string;
};

export type DailyState = {
  date: string;
  key: string;
  stage: string;
  tag: string;
  sub: string;
  set_qids: string[];
  idx: number;
};