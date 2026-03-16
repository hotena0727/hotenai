"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchTodayWordKanjiSetCount, saveQuizAttempt } from "@/lib/attempts";
import type { KanjiQType, KanjiQuestion, KanjiRow } from "@/app/types/kanji";
import { loadKanjiRows } from "@/lib/kanji-loader";
import { buildKanjiQuiz } from "@/lib/kanji-quiz";
import { buildKanjiAttemptPayload } from "@/lib/kanji-payload";
import { isPaidPlan, normalizePlan, type PlanCode } from "@/lib/plans";
import { hasSeenHomeToday } from "@/lib/home-gate";

const LEVEL_OPTIONS = ["N5", "N4", "N3", "N2", "N1"] as const;

const QTYPE_OPTIONS: Array<{ value: KanjiQType; label: string }> = [
  { value: "reading", label: "발음" },
  { value: "meaning", label: "뜻" },
  { value: "kr2jp", label: "한→일" },
];

type AnswerMap = Record<number, string>;
type ExcludedWordMap = Record<string, boolean>;

function qtypeLabel(qtype: KanjiQType): string {
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

const JA_FONT_STYLE = {
  fontFamily: `"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`,
} as const;

const DAILY_FREE_SET_LIMIT = 3;
const PRO_UPGRADE_URL = "/pro";
const BASE_SFX_URL = "https://hotena.com/hotena/app/mp3/sfx";

export default function KanjiPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isReviewMode = searchParams.get("review") === "1";
  const reviewQids = (searchParams.get("qids") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const reviewQtype = (searchParams.get("qtype") || "").trim();
  const reviewLevel = (searchParams.get("level") || "").trim().toUpperCase();

  const [rows, setRows] = useState<KanjiRow[]>([]);
  const [questions, setQuestions] = useState<KanjiQuestion[]>([]);

  const [selectedLevel, setSelectedLevel] = useState<string>("N5");
  const [selectedQType, setSelectedQType] = useState<KanjiQType>("reading");

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [excludedWords, setExcludedWords] = useState<ExcludedWordMap>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const [debugOpen, setDebugOpen] = useState(false);

  const didAutoCreateRef = useRef(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeSfxAudioRef = useRef<HTMLAudioElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [audioLoadingKey, setAudioLoadingKey] = useState("");
  const [audioError, setAudioError] = useState("");

  const [userPlan, setUserPlan] = useState<PlanCode>("free");
  const [todayWordKanjiSets, setTodayWordKanjiSets] = useState(0);
  const [limitMessage, setLimitMessage] = useState("");
  const [planInfoOpen, setPlanInfoOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasSeenHomeToday()) {
      const next = encodeURIComponent(
        `${pathname || "/kanji"}${window.location.search || ""}`
      );
      router.replace(`/?next=${next}`);
    }
  }, [router, pathname]);

  const wrongItems = questions
    .map((q, idx) => ({
      question: q,
      selected: answers[idx] || "",
      index: idx,
    }))
    .filter((item) => submitted && item.selected !== item.question.correct_text);

  const isPerfect =
    submitted && questions.length > 0 && score === questions.length;

  const isDailyLimitReached =
    !isPaidPlan(userPlan) && todayWordKanjiSets >= DAILY_FREE_SET_LIMIT;
  const remainingSets = Math.max(DAILY_FREE_SET_LIMIT - todayWordKanjiSets, 0);

  const playResultSfx = (kind: "perfect" | "correct" | "wrong") => {
    try {
      if (typeof window === "undefined") return;

      if (activeSfxAudioRef.current) {
        activeSfxAudioRef.current.pause();
        activeSfxAudioRef.current.currentTime = 0;
        activeSfxAudioRef.current = null;
      }

      const src =
        kind === "perfect"
          ? `${BASE_SFX_URL}/perfect.mp3`
          : kind === "correct"
            ? `${BASE_SFX_URL}/correct.mp3`
            : `${BASE_SFX_URL}/wrong.mp3`;

      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = 1;
      audio.onended = () => {
        if (activeSfxAudioRef.current === audio)
          activeSfxAudioRef.current = null;
      };
      audio.onerror = () => {
        if (activeSfxAudioRef.current === audio)
          activeSfxAudioRef.current = null;
      };

      activeSfxAudioRef.current = audio;
      void audio.play().catch((error) => {
        console.error("[kanji sfx] play failed:", error);
      });
    } catch (error) {
      console.error("[kanji sfx] unexpected error:", error);
    }
  };

  const levelCounts = useMemo(() => {
    const map: Record<string, number> = {
      N5: 0,
      N4: 0,
      N3: 0,
      N2: 0,
      N1: 0,
    };

    rows.forEach((row) => {
      const lv = String(row.level || "").toUpperCase();
      if (map[lv] !== undefined) map[lv] += 1;
    });

    return map;
  }, [rows]);

  const reviewRows = useMemo(() => {
    if (!isReviewMode || reviewQids.length === 0) return [] as KanjiRow[];

    const qidSet = new Set(reviewQids);

    return rows.filter((row) => {
      const itemKey = String((row as { item_key?: string }).item_key || "").trim();
      const itemKeyOk = itemKey ? qidSet.has(itemKey) : false;
      const jpWordOk = qidSet.has(String(row.jp_word || "").trim());
      const qtypeOk =
        !reviewQtype || reviewQtype === String((row as { qtype?: string }).qtype || "").trim();
      const levelOk =
        !reviewLevel || reviewLevel === String(row.level || "").trim().toUpperCase();

      return (itemKeyOk || jpWordOk) && qtypeOk && levelOk;
    });
  }, [rows, isReviewMode, reviewQids, reviewQtype, reviewLevel]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const loaded = await loadKanjiRows();
        setRows(loaded);
      } catch (error) {
        console.error(error);
        setErrorMsg("한자 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  useEffect(() => {
    if (!isReviewMode) return;

    if (
      reviewQtype === "reading" ||
      reviewQtype === "meaning" ||
      reviewQtype === "kr2jp"
    ) {
      setSelectedQType(reviewQtype);
    }

    if (["N5", "N4", "N3", "N2", "N1"].includes(reviewLevel)) {
      setSelectedLevel(reviewLevel);
    }
  }, [isReviewMode, reviewQtype, reviewLevel]);

  useEffect(() => {
    const loadPlanAndUsage = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;
        if (!user) {
          setUserPlan("free");
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

        const plan = normalizePlan(profileRow?.plan);
        setUserPlan(plan);

        const used = await fetchTodayWordKanjiSetCount(user.id);
        setTodayWordKanjiSets(used);

        if (!isPaidPlan(plan) && used >= DAILY_FREE_SET_LIMIT) {
          setLimitMessage(
            "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어와 한자는 내일 다시 이어서 풀 수 있어요. PRO에서는 제한 없이 이용할 수 있습니다."
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
        if (activeSfxAudioRef.current) {
          activeSfxAudioRef.current.pause();
          activeSfxAudioRef.current.currentTime = 0;
          activeSfxAudioRef.current = null;
        }
      } catch (error) {
        console.error(error);
      }
    };
  }, []);

  useEffect(() => {
    if (!isReviewMode && isDailyLimitReached) {
      setQuestions([]);
      setAnswers({});
      setSubmitted(false);
      setScore(0);
      setSaveMessage("");
    }
  }, [isDailyLimitReached, isReviewMode]);

  useEffect(() => {
    if (!submitted) return;

    setTimeout(() => {
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }, [submitted]);

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

  const generateQuiz = () => {
    try {
      if (isReviewMode) {
        if (reviewRows.length === 0) {
          setQuestions([]);
          setAnswers({});
          setSubmitted(false);
          setScore(0);
          setSaveMessage("복습할 문제가 없습니다.");
          setAudioError("");
          setAudioLoadingKey("");
          return;
        }

        const blockedWords = Object.keys(excludedWords).filter(
          (k) => excludedWords[k]
        );

        const reviewQtypeValue: KanjiQType =
          reviewQtype === "meaning" || reviewQtype === "kr2jp"
            ? reviewQtype
            : "reading";

        const quiz = buildKanjiQuiz({
          rows: reviewRows,
          qtype: reviewQtypeValue,
          level: "",
          excludedWords: blockedWords,
          size: reviewRows.length,
        });

        setQuestions(quiz);
        setAnswers({});
        setSubmitted(false);
        setScore(0);
        setSaveMessage(quiz.length === 0 ? "복습할 문제가 없습니다." : "");
        setAudioError("");
        setAudioLoadingKey("");
        return;
      }

      if (isDailyLimitReached) {
        setLimitMessage(
          "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어와 한자는 내일 다시 이어서 풀 수 있어요. PRO에서는 제한 없이 이용할 수 있습니다."
        );
        setQuestions([]);
        return;
      }

      const blockedWords = Object.keys(excludedWords).filter(
        (k) => excludedWords[k]
      );

      const quiz = buildKanjiQuiz({
        rows,
        qtype: selectedQType,
        level: selectedLevel,
        excludedWords: blockedWords,
        size: 10,
      });

      if (!quiz.length) {
        setQuestions([]);
        return;
      }

      setQuestions(quiz);
      setAnswers({});
      setSubmitted(false);
      setScore(0);
      setSaveMessage("");
      setAudioError("");
      setAudioLoadingKey("");
    } catch (error) {
      console.error(error);
      setQuestions([]);
    }
  };

  useEffect(() => {
    if (loading || rows.length === 0) return;

    if (!didAutoCreateRef.current) {
      didAutoCreateRef.current = true;
    }

    generateQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rows, selectedLevel, selectedQType, isReviewMode, reviewRows, reviewQtype]);

  const makeNewQuiz = () => {
    if (isReviewMode) {
      setSaveMessage("오답노트 복습에서는 전달된 문제만 풉니다.");
      generateQuiz();
      return;
    }

    generateQuiz();
    setSaveMessage("");
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
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

    const accuracy = questions.length > 0 ? nextScore / questions.length : 0;
    if (accuracy === 1) {
      playResultSfx("perfect");
    } else if (accuracy >= 0.7) {
      playResultSfx("correct");
    } else {
      playResultSfx("wrong");
    }

    setSubmitted(true);

    void autoSaveResult({
      currentQuestions: questions,
      currentAnswers: answers,
      nextScore,
    });
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

  const autoSaveResult = async ({
    currentQuestions,
    currentAnswers,
    nextScore,
  }: {
    currentQuestions: KanjiQuestion[];
    currentAnswers: AnswerMap;
    nextScore: number;
  }) => {
    if (currentQuestions.length === 0) return;
    try {
      setSaving(true);
      setSaveMessage("결과 저장 중...");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(userError);
        setSaveMessage("로그인 정보가 없어 결과를 저장하지 못했습니다.");
        return;
      }

      const wrongList = currentQuestions
        .map((q, idx) => ({
          question: q,
          selected: currentAnswers[idx] || "",
        }))
        .filter((item) => item.selected !== item.question.correct_text)
        .map((item) => ({
          jp_word: item.question.jp_word,
          selected: item.selected,
          correct: item.question.correct_text,
        }));

      const payload = buildKanjiAttemptPayload({
        user_id: user.id,
        user_email: user.email ?? "",
        level: selectedLevel,
        pos_mode: `한자 · ${selectedLevel} · ${selectedQType}`,
        quiz_len: currentQuestions.length,
        score: nextScore,
        wrongList,
        questions: currentQuestions,
      });

      const result = await saveQuizAttempt(payload);

      if (!result.ok) {
        setSaveMessage("결과 저장 중 오류가 발생했습니다.");
        return;
      }

      const used = await fetchTodayWordKanjiSetCount(user.id);
      setTodayWordKanjiSets(used);

      if (!isPaidPlan(userPlan) && used >= DAILY_FREE_SET_LIMIT) {
        setLimitMessage(
          "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자는 내일 다시 이어서 풀 수 있어요."
        );
      }

      setSaveMessage("결과가 저장되었습니다.");
    } catch (error) {
      console.error(error);
      setSaveMessage("결과 저장 중 오류가 발생했습니다.");
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
        <h1 className="mt-4 text-4xl font-bold">🈯 한자</h1>

        {isReviewMode ? (
          <p className="mt-3 text-sm font-semibold text-blue-600">
            오답노트 복습 모드 · 선택한 문제만 출제됩니다.
          </p>
        ) : null}

        <div className="mt-8">
          <p className="text-base font-semibold text-gray-700 sm:text-lg">
            ✅ 레벨을 선택하세요
          </p>
          <div className="mt-3 grid grid-cols-5 gap-3">
            {LEVEL_OPTIONS.map((level) => {
              const active = selectedLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSelectedLevel(level)}
                  className={
                    active
                      ? "rounded-2xl border border-red-400 bg-red-500 px-3 py-3 text-sm font-semibold text-white sm:px-4 sm:text-lg"
                      : "rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-900 sm:px-4 sm:text-lg"
                  }
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-base font-semibold text-gray-700 sm:text-lg">
            ✅ 유형을 선택하세요
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {QTYPE_OPTIONS.map((item) => {
              const active = selectedQType === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSelectedQType(item.value)}
                  className={
                    active
                      ? "rounded-2xl border border-red-400 bg-red-500 px-3 py-3 text-sm font-semibold text-white sm:px-4 sm:text-xl"
                      : "rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-900 sm:px-4 sm:text-xl"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={
            !isReviewMode && isDailyLimitReached
              ? "mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:px-4 sm:py-4"
              : "mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 sm:px-4 sm:py-4"
          }
        >
          <button
            type="button"
            onClick={() => setPlanInfoOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <p
                className={
                  !isReviewMode && isDailyLimitReached
                    ? "text-xs font-semibold text-red-700 sm:text-sm"
                    : "text-xs font-semibold text-gray-800 sm:text-sm"
                }
              >
                {isPaidPlan(userPlan)
                  ? `${userPlan.toUpperCase()} · 단어·한자 무제한`
                  : `FREE · 오늘 ${todayWordKanjiSets}/${DAILY_FREE_SET_LIMIT}세트`}
              </p>
              <p
                className={
                  !isReviewMode && isDailyLimitReached
                    ? "mt-1 text-xs text-red-600"
                    : "mt-1 text-xs text-gray-500"
                }
              >
                {isPaidPlan(userPlan)
                  ? "자세한 이용 안내 보기"
                  : !isReviewMode && isDailyLimitReached
                    ? "오늘 이용 완료"
                    : remainingSets === 1
                      ? "오늘 1세트 남음"
                      : `오늘 ${remainingSets}세트 남음`}
              </p>
            </div>
            <span
              className={
                !isReviewMode && isDailyLimitReached
                  ? "shrink-0 text-sm text-red-500 sm:text-base"
                  : "shrink-0 text-sm text-gray-500 sm:text-base"
              }
            >
              {planInfoOpen ? "⌄" : "›"}
            </span>
          </button>

          {planInfoOpen ? (
            <div
              className={
                !isReviewMode && isDailyLimitReached
                  ? "mt-3 border-t border-red-200 pt-3 text-xs leading-6 text-red-700 sm:text-sm"
                  : "mt-3 border-t border-gray-200 pt-3 text-xs leading-6 text-gray-600 sm:text-sm"
              }
            >
              <p>
                {isPaidPlan(userPlan)
                  ? "유료 플랜은 단어와 한자를 제한 없이 이용할 수 있습니다."
                  : !isReviewMode && isDailyLimitReached
                    ? "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어와 한자는 내일 다시 이어서 풀 수 있어요."
                    : `FREE는 단어와 한자를 합산 하루 3세트까지 이용할 수 있습니다. 오늘은 ${remainingSets}세트 더 이용할 수 있습니다.`}
              </p>
            </div>
          ) : null}

          {!isReviewMode && isDailyLimitReached ? (
            <div className="mt-3">
              <a
                href={PRO_UPGRADE_URL}
                className="inline-flex rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Pro 업그레이드
              </a>
            </div>
          ) : null}
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={makeNewQuiz}
              disabled={!isReviewMode && isDailyLimitReached}
              className={
                !isReviewMode && isDailyLimitReached
                  ? "rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-600 sm:px-4 sm:py-4 sm:text-lg"
                  : "rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-800 sm:px-4 sm:py-4 sm:text-lg"
              }
            >
              {!isReviewMode && isDailyLimitReached
                ? "오늘 이용 완료"
                : isReviewMode
                  ? `🔄 선택한 복습 문제 다시 불러오기 (${reviewRows.length}문항)`
                  : "🔄 새문제(랜덤 10문항)"}
            </button>
            <button
              type="button"
              onClick={resetExcludedWords}
              className="rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-800 sm:px-4 sm:py-4 sm:text-lg"
            >
              맞힌 단어 제외 초기화
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-300 bg-white">
          <button
            type="button"
            onClick={() => setDebugOpen((prev) => !prev)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left"
          >
            <span className="text-lg">{debugOpen ? "⌄" : "›"}</span>
            <span className="text-lg font-semibold">🔎 디버그: 레벨별 단어 수</span>
          </button>

          {debugOpen ? (
            <div className="border-t border-gray-200 px-4 py-4">
              <div className="grid grid-cols-5 gap-3 text-center">
                {LEVEL_OPTIONS.map((lv) => (
                  <div key={lv} className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-lg font-bold">{lv}</p>
                    <p className="mt-2 text-sm text-gray-600">{levelCounts[lv]}개</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {questions.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-300 bg-white p-5">
            {audioError ? (
              <p className="mb-4 text-sm text-red-500">{audioError}</p>
            ) : null}

            {saveMessage ? (
              <p className="mb-4 text-sm text-blue-600">{saveMessage}</p>
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
                      <p className="text-xl font-semibold sm:text-2xl">
                        {circleNumber(idx)}{" "}
                        <span lang="ja" style={JA_FONT_STYLE}>
                          {q.prompt}
                        </span>
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
                          {audioLoadingKey === `q-${idx}`
                            ? "재생 중..."
                            : "🔊 발음 듣기"}
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
                            className="flex items-center gap-3 text-base text-gray-900 sm:text-lg"
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
                              <span lang="ja" style={JA_FONT_STYLE}>
                                {choice}
                              </span>
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
                          정답:{" "}
                          <span lang="ja" style={JA_FONT_STYLE}>
                            {correct}
                          </span>
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                          단어:{" "}
                          <span lang="ja" style={JA_FONT_STYLE}>
                            {q.jp_word}
                          </span>{" "}
                          / 읽기:{" "}
                          <span lang="ja" style={JA_FONT_STYLE}>
                            {q.reading}
                          </span>{" "}
                          / 뜻: {q.meaning}
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                          레벨: {q.level} / 유형: {qtypeLabel(q.qtype)}
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
                  className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white sm:px-5 sm:py-4 sm:text-lg"
                >
                  제출하고 채점하기
                </button>
              ) : (
                <>
                  <div ref={resultRef} className="rounded-2xl bg-green-50 p-4">
                    <p className="text-base font-semibold text-green-700 sm:text-lg">
                      점수: {score} / {questions.length}
                    </p>
                  </div>

                  {isPerfect ? (
                    <>
                      <div className="rounded-2xl bg-green-50 p-4">
                        <p className="text-base font-semibold text-green-700 sm:text-lg">
                          🎉 완벽해요! 전부 정답입니다.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-green-50 p-4">
                        <p className="text-base font-semibold text-green-700 sm:text-lg">
                          🎉 Perfect Streak! {questions.length}연속 정답!
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

                  <div className="text-sm text-gray-500">
                    🧠 이번 최고 콤보: {score}연속
                  </div>

                  {wrongItems.length > 0 ? (
                    <div className="mt-2">
                      <h2 className="text-3xl font-bold text-gray-900">
                        ❌ 오답 노트
                      </h2>

                      <div className="mt-4 space-y-4">
                        {wrongItems.slice(0, 3).map((item, i) => (
                          <div
                            key={`${item.question.jp_word}-${i}`}
                            className="rounded-3xl border border-gray-200 bg-white p-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xl font-bold sm:text-2xl">
                                  Q{item.index + 1}.{" "}
                                  <span lang="ja" style={JA_FONT_STYLE}>
                                    {item.question.jp_word}
                                  </span>
                                </p>
                                <p className="mt-1 text-sm text-gray-600">
                                  {item.question.prompt} · 레벨: {item.question.level} · 유형:{" "}
                                  {qtypeLabel(item.question.qtype)}
                                </p>
                              </div>
                              <div className="rounded-full border border-gray-200 px-4 py-1 text-sm font-semibold">
                                오답
                              </div>
                            </div>

                            <div className="mt-4 space-y-1 text-base sm:text-lg">
                              <p>
                                <span className="font-semibold">내 답</span>　
                                <span lang="ja" style={JA_FONT_STYLE}>
                                  {item.selected}
                                </span>
                              </p>
                              <p>
                                <span className="font-semibold">정답</span>　
                                <span lang="ja" style={JA_FONT_STYLE}>
                                  {item.question.correct_text}
                                </span>
                              </p>
                              <p>
                                <span className="font-semibold">발음</span>　
                                <span lang="ja" style={JA_FONT_STYLE}>
                                  {item.question.reading}
                                </span>
                              </p>
                              <p>
                                <span className="font-semibold">뜻</span>　
                                {item.question.meaning}
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
                      className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white sm:px-5 sm:py-4 sm:text-lg"
                    >
                      {isReviewMode
                        ? "선택한 복습 문제 다시 시작하기"
                        : "다음 10문항 시작하기"}
                    </button>

                    <button
                      type="button"
                      onClick={handleRetryWrongOnly}
                      className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 sm:px-5 sm:py-4 sm:text-lg"
                    >
                      ❌ 틀린 문제만 다시 풀기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`mt-6 rounded-2xl border p-5 ${
              !isReviewMode && isDailyLimitReached
                ? "border-red-200 bg-red-50"
                : "border-gray-300 bg-white"
            }`}
          >
            <p
              className={`text-sm ${
                !isReviewMode && isDailyLimitReached
                  ? "text-red-700"
                  : "text-gray-500"
              }`}
            >
              {!isReviewMode && isDailyLimitReached
                ? "오늘 단어·한자 학습은 모두 완료했습니다. 내일 다시 이어서 풀거나 PRO로 계속 이용해 보세요."
                : isReviewMode
                  ? "선택한 오답 문제를 찾지 못했습니다."
                  : "선택한 조건에 맞는 문제가 없습니다."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}