import type { KatsuyouPos, KatsuyouQuestion } from "@/app/types/katsuyou";

type WrongItem = {
  question: KatsuyouQuestion;
  selected: string;
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

    // 오답노트 페이지들이 읽는 핵심 필드
    wrong_list: wrongList.map((item) => ({
      app: "katsuyou",
      item_key: String(item.question.item_key || ""),
      jp_word: item.question.jp_word,
      kr_word: item.question.kr_word,
      pos: item.question.pos,
      qtype: item.question.qtype,
      form_key: item.question.formKey,
      reading: item.question.reading || "",
      prompt: item.question.prompt,
      selected: item.selected,
      correct: item.question.correct_text,
    })),

    // 기존 호환용으로 남겨둬도 무방
    wrong_answers: wrongList.map((item) => ({
      jp_word: item.question.jp_word,
      selected: item.selected,
      correct: item.question.correct_text,
    })),

    questions,
    meta: {
      category: "활용",
      pos,
    },
  };
}