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
  const question_keys = questions
    .map((q) =>
      [
        String(q.item_key || q.jp_word || "").trim(),
        String(q.formKey || "").trim(),
        String(q.qtype || "").trim(),
      ].join("|||")
    )
    .filter((v) => {
      const [itemKey, formKey, qtype] = v.split("|||");
      return Boolean(itemKey && formKey && qtype);
    });

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

    wrong_list: wrongList.map((item) => ({
      app: "katsuyou",
      item_key: String(item.question.item_key || item.question.jp_word || ""),
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

    question_keys,

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