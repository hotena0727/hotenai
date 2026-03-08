import type { TalkCsvRow, TalkWrongItem } from "@/app/types/talk";

export type TalkAttemptWrongItem = {
  app: "talk";
  qtype: "choice";
  item_key: string; // qid
  qid: string;
  selected: string;
  correct: string;

  stage: string;
  tag: string;
  tag_kr: string;
  sub: string;
  sub_kr: string;

  situation_kr: string;
  partner_jp: string;
  partner_kr: string;
  answer_jp: string;
  answer_kr: string;
  explain_kr: string;
};

export type TalkAttemptPayload = {
  user_id: string;
  user_email?: string;
  level?: string;
  pos_mode: string;
  quiz_len: number;
  score: number;
  wrong_count: number;
  wrong_list: TalkAttemptWrongItem[];
};

export function buildTalkWrongList(
  wrongList: TalkWrongItem[],
  questions: TalkCsvRow[]
): TalkAttemptWrongItem[] {
  return wrongList.map((item) => {
    const row = questions.find((q) => q.qid === item.qid);

    return {
      app: "talk",
      qtype: "choice",
      item_key: row?.qid || item.qid,
      qid: row?.qid || item.qid,
      selected: item.selected,
      correct: item.correct,

      stage: row?.stage || "",
      tag: row?.tag || "",
      tag_kr: row?.tag_kr || "",
      sub: row?.sub || "",
      sub_kr: row?.sub_kr || "",

      situation_kr: row?.situation_kr || "",
      partner_jp: row?.partner_jp || "",
      partner_kr: row?.partner_kr || "",
      answer_jp: row?.answer_jp || "",
      answer_kr: row?.answer_kr || "",
      explain_kr: row?.explain_kr || "",
    };
  });
}

export function buildTalkAttemptPayload(params: {
  user_id: string;
  user_email?: string;
  level?: string;
  pos_mode: string;
  quiz_len: number;
  score: number;
  wrongList: TalkWrongItem[];
  questions: TalkCsvRow[];
}): TalkAttemptPayload {
  const wrong_list = buildTalkWrongList(params.wrongList, params.questions);

  return {
    user_id: params.user_id,
    user_email: params.user_email ?? "",
    level: params.level ?? "",
    pos_mode: params.pos_mode,
    quiz_len: Number(params.quiz_len || 0),
    score: Number(params.score || 0),
    wrong_count: wrong_list.length,
    wrong_list,
  };
}