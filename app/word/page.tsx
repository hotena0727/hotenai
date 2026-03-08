"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchTodayWordKanjiSetCount, saveQuizAttempt } from "@/lib/attempts";
import type { WordQType, WordQuestion, WordRow } from "@/app/types/word";
import { loadWordRows } from "@/lib/word-loader";
import { buildWordQuiz } from "@/lib/word-quiz";
import { buildWordAttemptPayload } from "@/lib/word-payload";
import { loadPatternRows, filterPatternRows } from "@/lib/pattern-loader";
import type { PatternRow } from "@/app/types/pattern";

const POS_GROUP_OPTIONS = [
  { value: "noun", label: "명사" },
  { value: "adj_i", label: "い형용사" },
  { value: "adj_na", label: "な형용사" },
  { value: "verb", label: "동사" },
  { value: "other", label: "기타" },
] as const;

const OTHER_POS_OPTIONS = [
  { value: "adverb", label: "부사" },
  { value: "particle", label: "조사" },
  { value: "conjunction", label: "접속사" },
  { value: "interjection", label: "감탄사" },
] as const;

const QTYPE_OPTIONS: Array<{ value: WordQType; label: string }> = [
  { value: "reading", label: "발음" },
  { value: "meaning", label: "뜻" },
  { value: "kr2jp", label: "한→일" },
];

type AnswerMap = Record<number, string>;
type ExcludedWordMap = Record<string, boolean>;

const DAILY_FREE_SET_LIMIT = 3;

function posLabel(pos: string): string {
  const raw = String(pos || "").trim().toLowerCase();
  switch (raw) {
    case "noun":
      return "명사";
    case "adj_i":
      return "い형용사";
    case "adj_na":
      return "な형용사";
    case "verb":
      return "동사";
    case "adverb":
      return "부사";
    case "particle":
      return "조사";
    case "conjunction":
      return "접속사";
    case "interjection":
      return "감탄사";
    default:
      return raw || "-";
  }
}

function qtypeLabel(qtype: WordQType): string {
  switch (qtype) {
    case "reading":
      return "발음";
    case "meaning":
      return "뜻";
    case "kr2jp":
      return "한→일";
    default:
      return qtype;
  }
}

function circleNumber(index: number): string {
  const nums = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  return nums[index] || `${index + 1}.`;
}

export default function WordPage() {
  const [rows, setRows] = useState<WordRow[]>([]);
  const [patternRows, setPatternRows] = useState<PatternRow[]>([]);
  const [questions, setQuestions] = useState<WordQuestion[]>([]);

  const [selectedPosGroup, setSelectedPosGroup] = useState("noun");
  const [selectedQType, setSelectedQType] = useState<WordQType>("reading");

  const [otherPanelOpen, setOtherPanelOpen] = useState(true);
  const [selectedOtherPos, setSelectedOtherPos] = useState<string[]>([
    "adverb",
    "particle",
    "conjunction",
    "interjection",
  ]);

  const [patternOpen, setPatternOpen] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);

  const [excludedWords, setExcludedWords] = useState<ExcludedWordMap>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const didAutoCreateRef = useRef(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [audioLoadingKey, setAudioLoadingKey] = useState("");
  const [audioError, setAudioError] = useState("");

  const [userPlan, setUserPlan] = useState<"FREE" | "PRO">("FREE");
  const [todayWordKanjiSets, setTodayWordKanjiSets] = useState(0);
  const [limitMessage, setLimitMessage] = useState("");

  const visiblePatterns = useMemo(
    () =>
      filterPatternRows(
        patternRows,
        selectedPosGroup === "other" ? "" : selectedPosGroup
      ),
    [patternRows, selectedPosGroup]
  );

  const visibleQtypes =
    selectedPosGroup === "other"
      ? QTYPE_OPTIONS.filter(
          (item) => item.value === "meaning" || item.value === "kr2jp"
        )
      : QTYPE_OPTIONS;

  const wrongItems = questions
    .map((q, idx) => ({
      question: q,
      selected: answers[idx] || "",
      index: idx,
    }))
    .filter((item) => submitted && item.selected !== item.question.correct_text);

  const isPerfect = submitted && questions.length > 0 && score === questions.length;
  const showWrongNote = submitted && wrongItems.length > 0;
  const isDailyLimitReached =
    userPlan === "FREE" && todayWordKanjiSets >= DAILY_FREE_SET_LIMIT;

  useEffect(() => {
    if (selectedPosGroup === "other" && selectedQType === "reading") {
      setSelectedQType("meaning");
    }
  }, [selectedPosGroup, selectedQType]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const [loadedWords, loadedPatterns] = await Promise.all([
          loadWordRows(),
          loadPatternRows(),
        ]);

        setRows(loadedWords);
        setPatternRows(loadedPatterns);
      } catch (error) {
        console.error(error);
        setErrorMsg("단어 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);



  useEffect(() => {
    const loadPlanAndUsage = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;
        if (!user) {
          setUserPlan("FREE");
          setTodayWordKanjiSets(0);
          setLimitMessage("");
          return;
        }

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
        }

        const plan =
          String(profileRow?.plan || "FREE").toUpperCase() === "PRO" ? "PRO" : "FREE";
        setUserPlan(plan);

        const used = await fetchTodayWordKanjiSetCount(user.id);
        setTodayWordKanjiSets(used);

        if (plan === "FREE" && used >= DAILY_FREE_SET_LIMIT) {
          setLimitMessage(
            "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자는 내일 다시 이어서 풀 수 있어요."
          );
        } else {
          setLimitMessage("");
        }
      } catch (error) {
        console.error(error);
      }
    };

    void loadPlanAndUsage();
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (error) {
        console.error(error);
      }
    };
  }, []);

  const speakJapanese = (text: string, key: string) => {
    try {
      const raw = String(text || "").trim();
      if (!raw) return;

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setAudioError("이 브라우저에서는 발음 듣기를 지원하지 않습니다.");
        return;
      }

      window.speechSynthesis.cancel();
      setAudioError("");
      setAudioLoadingKey(key);

      const utter = new SpeechSynthesisUtterance(raw);
      utter.lang = "ja-JP";
      utter.rate = 0.95;
      utter.pitch = 1.0;

      utter.onend = () => {
        setAudioLoadingKey("");
      };

      utter.onerror = () => {
        setAudioError("발음 재생에 실패했습니다.");
        setAudioLoadingKey("");
      };

      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
    } catch (error) {
      console.error(error);
      setAudioError("발음 재생에 실패했습니다.");
      setAudioLoadingKey("");
    }
  };

  const toggleOtherPos = (value: string) => {
    setSelectedOtherPos((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const generateQuiz = () => {
    try {
      if (userPlan === "FREE" && todayWordKanjiSets >= DAILY_FREE_SET_LIMIT) {
        setLimitMessage(
          "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자는 내일 다시 이어서 풀 수 있어요."
        );
        setQuestions([]);
        return;
      }
      const blockedWords = Object.keys(excludedWords).filter(
        (k) => excludedWords[k]
      );

      let quiz: WordQuestion[] = [];

      if (selectedPosGroup === "other") {
        if (selectedOtherPos.length === 0) {
          setQuestions([]);
          return;
        }

        const filteredRows = rows.filter((row) =>
          selectedOtherPos.includes(String(row.pos || "").trim().toLowerCase())
        );

        quiz = buildWordQuiz({
          rows: filteredRows,
          qtype: selectedQType,
          posGroup: "",
          excludedWords: blockedWords,
          size: 10,
        });
      } else {
        quiz = buildWordQuiz({
          rows,
          qtype: selectedQType,
          posGroup: selectedPosGroup,
          excludedWords: blockedWords,
          size: 10,
        });
      }

      if (!quiz.length) {
        setQuestions([]);
        return;
      }

      setQuestions(quiz);
      setAnswers({});
      setSubmitted(false);
      setScore(0);
      setAudioError("");
      setAudioLoadingKey("");
    } catch (error) {
      console.error(error);
      setQuestions([]);
    }
  };

  useEffect(() => {
    if (loading || rows.length === 0) return;
    if (selectedPosGroup === "other" && selectedOtherPos.length === 0) {
      setQuestions([]);
      return;
    }

    if (!didAutoCreateRef.current) {
      didAutoCreateRef.current = true;
    }

    generateQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rows, selectedPosGroup, selectedQType, selectedOtherPos.join("|")]);

  useEffect(() => {
    if (!loading && rows.length > 0) {
      generateQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludedWords]);

  const makeNewQuiz = () => {
    generateQuiz();
  };

  const resetExcludedWords = () => {
    setExcludedWords({});
    alert("맞힌 단어 제외 목록을 초기화했습니다.");
  };

  const handleSelectChoice = (index: number, choice: string) => {
    if (submitted) return;
    setAnswers((prev) => ({
      ...prev,
      [index]: choice,
    }));
  };

  const handleSubmitAll = () => {
    if (questions.length === 0) {
      alert("먼저 문제를 생성해주세요.");
      return;
    }

    const unanswered = questions.filter((_, idx) => !answers[idx]);
    if (unanswered.length > 0) {
      alert("아직 선택하지 않은 문제가 있습니다.");
      return;
    }

    let nextScore = 0;
    const nextExcluded: ExcludedWordMap = { ...excludedWords };

    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_text) {
        nextScore += 1;
        nextExcluded[q.jp_word] = true;
      }
    });

    setScore(nextScore);
    setExcludedWords(nextExcluded);
    setSubmitted(true);
  };

  const handleRetryWrongOnly = () => {
    const nextQuestions = wrongItems.map((item) => item.question);

    if (nextQuestions.length === 0) {
      alert("틀린 문제가 없습니다.");
      return;
    }

    setQuestions(nextQuestions);
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setAudioError("");
    setAudioLoadingKey("");
  };

  const handleSaveResult = async () => {
    if (!submitted || questions.length === 0) return;

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(userError);
        alert("로그인 정보가 없어 결과를 저장하지 못했습니다.");
        return;
      }

      const wrongList = questions
        .map((q, idx) => ({
          question: q,
          selected: answers[idx] || "",
        }))
        .filter((item) => item.selected !== item.question.correct_text)
        .map((item) => ({
          jp_word: item.question.jp_word,
          selected: item.selected,
          correct: item.question.correct_text,
        }));

      const payload = buildWordAttemptPayload({
        user_id: user.id,
        user_email: user.email ?? "",
        level: questions[0]?.level || "",
        pos_mode:
          selectedPosGroup === "other"
            ? `단어 · other · ${selectedQType}`
            : `단어 · ${selectedPosGroup} · ${selectedQType}`,
        quiz_len: questions.length,
        score,
        wrongList,
        questions,
      });

      const result = await saveQuizAttempt(payload);

      if (!result.ok) {
        alert("결과 저장 중 오류가 발생했습니다.");
        return;
      }

      const used = await fetchTodayWordKanjiSetCount(user.id);
      setTodayWordKanjiSets(used);
      if (userPlan === "FREE" && used >= DAILY_FREE_SET_LIMIT) {
        setLimitMessage(
          "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자는 내일 다시 이어서 풀 수 있어요."
        );
      }

      alert("결과가 저장되었습니다.");
    } catch (error) {
      console.error(error);
      alert("결과 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="mt-4 text-4xl font-bold">✨ 단어</h1>

        <div className="mt-8">
          <p className="text-lg font-semibold text-gray-700">✨ 품사를 선택하세요</p>
          <div className="mt-3 grid grid-cols-5 gap-3">
            {POS_GROUP_OPTIONS.map((item) => {
              const active = selectedPosGroup === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSelectedPosGroup(item.value)}
                  className={
                    active
                      ? "rounded-2xl border border-red-400 bg-red-500 px-4 py-3 text-lg font-semibold text-white"
                      : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-lg font-semibold text-gray-900"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {selectedPosGroup === "other" ? (
          <div className="mt-5 rounded-2xl border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => setOtherPanelOpen((prev) => !prev)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left"
            >
              <span className="text-lg">{otherPanelOpen ? "⌄" : "›"}</span>
              <span className="text-lg font-semibold">
                기타 세부 선택 (부사/조사/접속사/감탄사)
              </span>
            </button>

            {otherPanelOpen ? (
              <div className="border-t border-gray-200 px-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  {OTHER_POS_OPTIONS.map((item) => {
                    const checked = selectedOtherPos.includes(item.value);

                    return (
                      <label
                        key={item.value}
                        className="flex items-center gap-3 text-lg text-gray-900"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOtherPos(item.value)}
                          className="h-5 w-5"
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={makeNewQuiz}
                  className="mt-5 w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 text-lg font-semibold text-gray-800"
                >
                  🔄 기타 선택 적용(새 문제)
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          <p className="text-lg font-semibold text-gray-700">✨ 유형을 선택하세요</p>
          <div
            className={
              selectedPosGroup === "other"
                ? "mt-3 grid grid-cols-2 gap-3"
                : "mt-3 grid grid-cols-3 gap-3"
            }
          >
            {visibleQtypes.map((item) => {
              const active = selectedQType === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSelectedQType(item.value)}
                  className={
                    active
                      ? "rounded-2xl border border-red-400 bg-red-500 px-4 py-3 text-xl font-semibold text-white"
                      : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xl font-semibold text-gray-900"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-300 bg-white">
          <button
            type="button"
            onClick={() => setPatternOpen((prev) => !prev)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left"
          >
            <span className="text-lg">{patternOpen ? "⌄" : "›"}</span>
            <span className="text-lg font-semibold">📌 필수패턴 (카드로 빠르게 익히기)</span>
          </button>

          {patternOpen ? (
            <div className="border-t border-gray-200 px-4 py-4">
              {visiblePatterns.length === 0 ? (
                <p className="text-sm text-gray-500">표시할 패턴이 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {visiblePatterns.map((item, idx) => (
                    <div
                      key={`${item.title}-${idx}`}
                      className="rounded-3xl border border-gray-200 p-5"
                    >
                      <p className="text-3xl font-bold">{item.title}</p>
                      <p className="mt-4 text-2xl font-semibold">{item.jp}</p>
                      <p className="mt-2 text-xl text-gray-700">{item.kr}</p>

                      <div className="mt-6">
                        <p className="text-xl font-semibold">{item.ex1_jp}</p>
                        <p className="mt-1 text-lg text-gray-700">{item.ex1_kr}</p>
                      </div>

                      <div className="mt-5">
                        <p className="text-xl font-semibold">{item.ex2_jp}</p>
                        <p className="mt-1 text-lg text-gray-700">{item.ex2_kr}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>



        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
          <p className="text-sm font-semibold text-gray-800">
            {userPlan === "PRO"
              ? "PRO 이용 중 · 단어·한자를 제한 없이 이용할 수 있습니다."
              : `FREE 이용 중 · 오늘 단어+한자 ${todayWordKanjiSets}/${DAILY_FREE_SET_LIMIT}세트`}
          </p>

          {userPlan === "FREE" ? (
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {isDailyLimitReached
                ? "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자는 내일 다시 이어서 풀 수 있어요. talk는 별도로 계속 이용할 수 있습니다."
                : todayWordKanjiSets === DAILY_FREE_SET_LIMIT - 1
                ? "오늘은 1세트 더 이용할 수 있습니다. talk는 이 제한과 별도로 계속 이용할 수 있습니다."
                : "talk는 이 제한과 별도로 계속 이용할 수 있습니다."}
            </p>
          ) : null}

          {limitMessage ? (
            <p className="mt-2 text-sm leading-6 text-gray-600">{limitMessage}</p>
          ) : null}
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={makeNewQuiz}
              disabled={isDailyLimitReached}
              className={
                isDailyLimitReached
                  ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-4 text-lg font-semibold text-gray-400"
                  : "rounded-2xl border border-gray-300 bg-white px-4 py-4 text-lg font-semibold text-gray-800"
              }
            >
              🔄 새문제(랜덤 10문항)
            </button>
            <button
              type="button"
              onClick={resetExcludedWords}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-4 text-lg font-semibold text-gray-800"
            >
              맞힌 단어 제외 초기화
            </button>
          </div>
        </div>

        {questions.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-300 bg-white p-5">
            {audioError ? (
              <p className="mb-4 text-sm text-red-500">{audioError}</p>
            ) : null}

            <div className="space-y-8">
              {questions.map((q, idx) => {
                const selectedChoice = answers[idx] || "";
                const correct = q.correct_text;
                const isRight = submitted && selectedChoice === correct;
                const isWrong = submitted && selectedChoice !== correct;

                return (
                  <div key={`${q.jp_word}-${idx}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-2xl font-semibold">
                        {circleNumber(idx)} {q.prompt}
                      </p>

                      {q.qtype === "meaning" ? (
                        <button
                          type="button"
                          onClick={() =>
                            speakJapanese(q.reading || q.jp_word, `q-${idx}`)
                          }
                          disabled={audioLoadingKey === `q-${idx}`}
                          className="shrink-0 rounded-xl border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                        >
                          {audioLoadingKey === `q-${idx}` ? "재생 중..." : "🔊 발음 듣기"}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-2">
                      {q.choices.map((choice) => {
                        const checked = selectedChoice === choice;
                        const isCorrectChoice = submitted && choice === correct;
                        const isWrongChoice =
                          submitted && checked && choice !== correct;

                        return (
                          <label
                            key={choice}
                            className="flex items-center gap-3 text-lg text-gray-900"
                          >
                            <input
                              type="radio"
                              name={`q-${idx}`}
                              checked={checked}
                              disabled={submitted}
                              onChange={() => handleSelectChoice(idx, choice)}
                              className="h-4 w-4"
                            />
                            <span
                              className={
                                isCorrectChoice
                                  ? "font-semibold text-green-600"
                                  : isWrongChoice
                                  ? "font-semibold text-red-600"
                                  : ""
                              }
                            >
                              {choice}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {submitted ? (
                      <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                        <p
                          className={
                            isRight
                              ? "text-sm font-semibold text-green-600"
                              : isWrong
                              ? "text-sm font-semibold text-red-600"
                              : "text-sm text-gray-500"
                          }
                        >
                          {isRight ? "정답입니다." : "오답입니다."}
                        </p>
                        <p className="mt-2 text-sm text-gray-700">
                          정답: {correct}
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                          단어: {q.jp_word} / 읽기: {q.reading} / 뜻: {q.meaning}
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                          품사: {posLabel(q.pos)} / 유형: {qtypeLabel(q.qtype)}
                        </p>

                        {q.qtype === "meaning" ? (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() =>
                                speakJapanese(q.reading || q.jp_word, `answer-${idx}`)
                              }
                              disabled={audioLoadingKey === `answer-${idx}`}
                              className="rounded-xl border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                            >
                              {audioLoadingKey === `answer-${idx}`
                                ? "재생 중..."
                                : "🔊 정답 발음 듣기"}
                            </button>
                          </div>
                        ) : null}

                        {q.example_jp || q.example_kr ? (
                          <div className="mt-3 rounded-xl bg-blue-50 p-3">
                            <p className="text-sm text-blue-900">{q.example_jp}</p>
                            <p className="mt-1 text-sm text-blue-900">{q.example_kr}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-4">
              {!submitted ? (
                <button
                  type="button"
                  onClick={handleSubmitAll}
                  className="rounded-2xl bg-red-500 px-5 py-4 text-lg font-semibold text-white"
                >
                  제출하고 채점하기
                </button>
              ) : (
                <>
                  <div className="rounded-2xl bg-green-50 p-4">
                    <p className="text-lg font-semibold text-green-700">
                      점수: {score} / {questions.length}
                    </p>
                  </div>

                  {isPerfect ? (
                    <>
                      <div className="rounded-2xl bg-green-50 p-4">
                        <p className="text-lg font-semibold text-green-700">
                          🎉 완벽해요! 전부 정답입니다.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-green-50 p-4">
                        <p className="text-lg font-semibold text-green-700">
                          🎉 Perfect Streak! 10연속 정답!
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl bg-yellow-50 p-4">
                      <p className="text-base font-semibold text-yellow-800">
                        💪 괜찮아요! 틀린 문제는 성장의 재료예요. 다시 한 번 도전해봐요.
                      </p>
                    </div>
                  )}

                  <div className="text-sm text-gray-500">🧠 오늘 최고 콤보: {score}연속</div>

                  {showWrongNote ? (
                    <div className="mt-2">
                      <h2 className="text-3xl font-bold text-gray-900">❌ 오답 노트</h2>

                      <div className="mt-4 space-y-4">
                        {wrongItems.slice(0, 3).map((item, i) => (
                          <div
                            key={`${item.question.jp_word}-${i}`}
                            className="rounded-3xl border border-gray-200 bg-white p-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-2xl font-bold">
                                  Q{item.index + 1}. {item.question.jp_word}
                                </p>
                                <p className="mt-1 text-sm text-gray-600">
                                  {item.question.prompt} · 품사: {posLabel(item.question.pos)} ·
                                  유형: {qtypeLabel(item.question.qtype)}
                                </p>
                              </div>
                              <div className="rounded-full border border-gray-200 px-4 py-1 text-sm font-semibold">
                                오답
                              </div>
                            </div>

                            <div className="mt-4 space-y-1 text-lg">
                              <p>
                                <span className="font-semibold">내 답</span>　{item.selected}
                              </p>
                              <p>
                                <span className="font-semibold">정답</span>　{item.question.correct_text}
                              </p>
                              <p>
                                <span className="font-semibold">발음</span>　{item.question.reading}
                              </p>
                              <p>
                                <span className="font-semibold">뜻</span>　{item.question.meaning}
                              </p>
                            </div>
                          </div>
                        ))}

                        {wrongItems.length > 3 ? (
                          <div className="rounded-2xl border border-gray-300 bg-white px-4 py-4 text-base font-semibold text-gray-700">
                            › 오답 더 보기 (+{wrongItems.length - 3}개)
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <button
                      type="button"
                      onClick={makeNewQuiz}
                      className="rounded-2xl bg-red-500 px-5 py-4 text-lg font-semibold text-white"
                    >
                      다음 10문항 시작하기
                    </button>

                    <button
                      type="button"
                      onClick={handleRetryWrongOnly}
                      className="rounded-2xl border border-gray-300 bg-white px-5 py-4 text-lg font-semibold text-gray-800"
                    >
                      ❌ 틀린 문제만 다시 풀기
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveResult}
                    disabled={saving}
                    className="rounded-2xl bg-black px-5 py-4 text-lg font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "결과 저장"}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-gray-300 bg-white p-5">
            <p className="text-sm text-gray-500">
              선택한 조건에 맞는 문제가 없습니다.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}