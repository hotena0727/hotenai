import type { KatsuyouPos, KatsuyouQuestion } from "@/app/types/katsuyou";

type WrongItem = {
  jp_word: string;
  selected: string;
  correct: string;
};

export function buildKatsuyouAttemptPayload({
  user_id,
  user_email,
  pos,
  pos_mode,
  quiz_len,
  score,
  wrongList,
  questions,
}: {
  user_id: string;
  user_email: string;
  pos: KatsuyouPos;
  pos_mode: string;
  quiz_len: number;
  score: number;
  wrongList: WrongItem[];
  questions: KatsuyouQuestion[];
}) {
  return {
    user_id,
    user_email,
    app_kind: "katsuyou",
    quiz_type: "katsuyou",
    pos,
    pos_mode,
    quiz_len,
    score,
    wrong_count: wrongList.length,
    wrong_answers: wrongList,
    questions,
    meta: {
      category: "활용",
      pos,
    },
  };
}