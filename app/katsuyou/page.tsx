"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasSeenHomeToday } from "@/lib/home-gate";
import { supabase } from "@/lib/supabase";
import { fetchTodayBasicQuizSetCount, saveQuizAttempt } from "@/lib/attempts";
import type {
  KatsuyouPos,
  KatsuyouQType,
  KatsuyouQuestion,
  KatsuyouRow,
} from "@/app/types/katsuyou";
import { loadKatsuyouRows } from "@/lib/katsuyou-loader";
import { buildKatsuyouQuiz } from "@/lib/katsuyou-quiz";
import { buildKatsuyouAttemptPayload } from "@/lib/katsuyou-payload";
import {
  hasPlan,
  isPaidPlan,
  normalizePlan,
  type PlanCode,
} from "@/lib/plans";
import {
  clearDailyState,
  loadAppProgress,
  loadDailyState,
  saveAppProgress,
  saveDailyState,
  todayKST,
} from "@/lib/progress";

const POS_OPTIONS: Array<{ value: KatsuyouPos; label: string }> = [
  { value: "i_adj", label: "い형용사" },
  { value: "na_adj", label: "な형용사" },
  { value: "verb", label: "동사" },
];

const QTYPE_OPTIONS: Array<{ value: KatsuyouQType; label: string }> = [
  { value: "kr2jp", label: "한→일" },
  { value: "jp2kr", label: "일→한" },
];

type AnswerMap = Record<number, string>;
type ExcludedWordMap = Record<string, boolean>;

type KatsuyouSavedSet = {
  questions: KatsuyouQuestion[];
  answers: AnswerMap;
  selectedPos: KatsuyouPos;
  selectedQType: KatsuyouQType;
  submitted: boolean;
  score: number;
};

function qtypeLabel(qtype: KatsuyouQType): string {
  switch (qtype) {
    case "kr2jp":
      return "한→일";
    case "jp2kr":
      return "일→한";
    default:
      return qtype;
  }
}

function posLabel(pos: KatsuyouPos): string {
  switch (pos) {
    case "i_adj":
      return "い형용사";
    case "na_adj":
      return "な형용사";
    case "verb":
      return "동사";
    default:
      return pos;
  }
}

function circleNumber(index: number): string {
  const nums = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  return nums[index] || `${index + 1}.`;
}

const JA_FONT_STYLE = {
  fontFamily:
    '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
} as const;

const DAILY_FREE_SET_LIMIT = 3;
const PRO_UPGRADE_URL =
  "https://hotena.com/m/study_dan_view.asp?dntGbn=&idx=44";
const BASE_SFX_URL = "https://hotena.com/hotena/app/mp3/sfx";

export default function KatsuyouPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [reviewMode, setReviewMode] = useState(false);
  const [reviewQids, setReviewQids] = useState<string[]>([]);
  const [reviewPos, setReviewPos] = useState("");
  const [reviewQType, setReviewQType] = useState("");
  const [reviewReady, setReviewReady] = useState(false);

  const [rows, setRows] = useState<KatsuyouRow[]>([]);
  const [questions, setQuestions] = useState<KatsuyouQuestion[]>([]);

  const [selectedPos, setSelectedPos] = useState<KatsuyouPos>("i_adj");
  const [selectedQType, setSelectedQType] = useState<KatsuyouQType>("kr2jp");

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);

  const [excludedWords, setExcludedWords] = useState<ExcludedWordMap>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [dailyStateLoaded, setDailyStateLoaded] = useState(false);

  const [debugOpen, setDebugOpen] = useState(false);

  const didAutoCreateRef = useRef(false);
  const restoringRef = useRef(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeSfxAudioRef = useRef<HTMLAudioElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [audioLoadingKey, setAudioLoadingKey] = useState("");
  const [audioError, setAudioError] = useState("");

  const [userPlan, setUserPlan] = useState<PlanCode>("free");
  const [todayWordKanjiSets, setTodayWordKanjiSets] = useState(0);
  const [limitMessage, setLimitMessage] = useState("");
  const [planInfoOpen, setPlanInfoOpen] = useState(false);

  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completionTitle, setCompletionTitle] = useState("");
  const [completionBody, setCompletionBody] = useState("");
  const [completionWrongCount, setCompletionWrongCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasSeenHomeToday()) {
      const fullNext = `${pathname || "/katsuyou"}${window.location.search || ""
        }`;
      router.replace(`/?next=${encodeURIComponent(fullNext)}`);
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

  // FREE는 숨김, LIGHT 이상부터 노출
  const canUseTts = hasPlan(userPlan, "light");

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
        console.error("[katsuyou sfx] play failed:", error);
      });
    } catch (error) {
      console.error("[katsuyou sfx] unexpected error:", error);
    }
  };

  const posCounts = useMemo(() => {
    const map: Record<KatsuyouPos, number> = {
      i_adj: 0,
      na_adj: 0,
      verb: 0,
    };

    rows.forEach((row) => {
      if (row.pos && map[row.pos] !== undefined) {
        map[row.pos] += 1;
      }
    });

    return map;
  }, [rows]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const review = params.get("review") === "1";
    const qids = (params.get("qids") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const pos = params.get("pos") || "";
    const qtype = params.get("qtype") || "";

    setReviewMode(review);
    setReviewQids(qids);
    setReviewPos(pos);
    setReviewQType(qtype);
    setReviewReady(true);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const loaded = await loadKatsuyouRows();
        setRows(loaded);
      } catch (error) {
        console.error(error);
        setErrorMsg("활용 데이터를 불러오지 못했습니다.");
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

        const used = await fetchTodayBasicQuizSetCount(user.id);
        setTodayWordKanjiSets(used);

        if (!isPaidPlan(plan) && used >= DAILY_FREE_SET_LIMIT) {
          setLimitMessage(
            "오늘 무료 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자·활용은 내일 다시 이어서 풀 수 있어요. 유료 플랜에서는 제한 없이 이용할 수 있습니다."
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
    if (isDailyLimitReached) {
      setQuestions([]);
      setAnswers({});
      setSubmitted(false);
      setScore(0);
      setAudioError("");
      setAudioLoadingKey("");
    }
  }, [isDailyLimitReached]);

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

  const persistKatsuyouSet = async (params?: {
    nextQuestions?: KatsuyouQuestion[];
    nextAnswers?: AnswerMap;
    nextSubmitted?: boolean;
    nextScore?: number;
    nextPos?: KatsuyouPos;
    nextQType?: KatsuyouQType;
  }) => {
    try {
      const qList = params?.nextQuestions ?? questions;
      const aMap = params?.nextAnswers ?? answers;
      const nextSubmitted = params?.nextSubmitted ?? submitted;
      const nextScore = params?.nextScore ?? score;
      const nextPos = params?.nextPos ?? selectedPos;
      const nextQType = params?.nextQType ?? selectedQType;

      if (!qList.length) return;

      const qids = qList
        .map((q) => String(q.item_key || "").trim())
        .filter(Boolean);

      if (!qids.length) return;

      await saveDailyState(
        {
          date: todayKST(),
          key: `${nextPos}|${nextQType}|katsuyou`,
          stage: nextPos,
          tag: nextQType,
          sub: "all",
          set_qids: qids,
          idx: 0,
        },
        "katsuyou"
      );

      const appProgress = await loadAppProgress("katsuyou");
      await saveAppProgress("katsuyou", {
        ...appProgress,
        last_set: {
          questions: qList,
          answers: aMap,
          selectedPos: nextPos,
          selectedQType: nextQType,
          submitted: nextSubmitted,
          score: nextScore,
        },
      });
    } catch (error) {
      console.error(error);
    }
  };

  const clearKatsuyouSavedSet = async () => {
    try {
      await clearDailyState("katsuyou");
      const appProgress = await loadAppProgress("katsuyou");
      const nextProgress = { ...appProgress };
      delete nextProgress.last_set;
      await saveAppProgress("katsuyou", nextProgress);
    } catch (error) {
      console.error(error);
    }
  };

  const canMakeMoreQuizForCurrentCondition = (
    nextExcludedWords: ExcludedWordMap
  ) => {
    const blockedWords = Object.keys(nextExcludedWords).filter(
      (k) => nextExcludedWords[k]
    );

    const nextQuiz = buildKatsuyouQuiz({
      rows,
      qtype: selectedQType,
      pos: selectedPos,
      excludedWords: blockedWords,
      size: 10,
    });

    return nextQuiz.length >= 10;
  };

  const shouldShowCompletionModal = (
    nextExcludedWords: ExcludedWordMap
  ) => {
    if (reviewMode) return false;
    return !canMakeMoreQuizForCurrentCondition(nextExcludedWords);
  };

  const generateQuiz = () => {
    try {
      if (isDailyLimitReached) {
        setLimitMessage(
          "오늘 무료 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자·활용은 내일 다시 이어서 풀 수 있어요. 유료 플랜에서는 제한 없이 이용할 수 있습니다."
        );
        setQuestions([]);
        return;
      }

      const blockedWords = Object.keys(excludedWords).filter(
        (k) => excludedWords[k]
      );

      const quiz = buildKatsuyouQuiz({
        rows,
        qtype: selectedQType,
        pos: selectedPos,
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
      setAudioError("");
      setAudioLoadingKey("");

      if (!reviewMode) {
        void persistKatsuyouSet({
          nextQuestions: quiz,
          nextAnswers: {},
          nextSubmitted: false,
          nextScore: 0,
          nextPos: selectedPos,
          nextQType: selectedQType,
        });
      }
    } catch (error) {
      console.error(error);
      setQuestions([]);
    }
  };

  const generateReviewQuiz = () => {
    try {
      if (reviewQids.length === 0) {
        setQuestions([]);
        return;
      }

      const filteredRows = rows.filter((row) => {
        const rowId = String(row.id || "").trim();
        return reviewQids.includes(rowId);
      });

      if (!filteredRows.length) {
        setQuestions([]);
        return;
      }

      const targetPos =
        reviewPos === "i_adj" || reviewPos === "na_adj" || reviewPos === "verb"
          ? (reviewPos as KatsuyouPos)
          : filteredRows[0]?.pos || selectedPos;

      const targetQType =
        reviewQType === "kr2jp" || reviewQType === "jp2kr"
          ? (reviewQType as KatsuyouQType)
          : selectedQType;

      const quiz = buildKatsuyouQuiz({
        rows: filteredRows,
        qtype: targetQType,
        pos: targetPos,
        excludedWords: [],
        size: filteredRows.length,
      });

      setQuestions(quiz);
      setAnswers({});
      setSubmitted(false);
      setScore(0);
      setAudioError("");
      setAudioLoadingKey("");

      setSelectedPos(targetPos);
      setSelectedQType(targetQType);
    } catch (error) {
      console.error(error);
      setQuestions([]);
    }
  };

  useEffect(() => {
    const restoreKatsuyouState = async () => {
      if (!reviewReady || loading || rows.length === 0) return;

      try {
        if (reviewMode) {
          setDailyStateLoaded(true);
          return;
        }

        const ds = await loadDailyState("katsuyou");
        const appProgress = await loadAppProgress("katsuyou");
        const lastSet = appProgress?.last_set as
          | Partial<KatsuyouSavedSet>
          | undefined;

        if (
          !ds ||
          !lastSet ||
          !Array.isArray(lastSet.questions) ||
          lastSet.questions.length === 0
        ) {
          setDailyStateLoaded(true);
          return;
        }

        restoringRef.current = true;

        setSelectedPos(
          lastSet.selectedPos === "i_adj" ||
            lastSet.selectedPos === "na_adj" ||
            lastSet.selectedPos === "verb"
            ? lastSet.selectedPos
            : "i_adj"
        );

        setSelectedQType(
          lastSet.selectedQType === "kr2jp" ||
            lastSet.selectedQType === "jp2kr"
            ? lastSet.selectedQType
            : "kr2jp"
        );

        setQuestions(lastSet.questions as KatsuyouQuestion[]);
        setAnswers((lastSet.answers as AnswerMap) || {});
        setSubmitted(Boolean(lastSet.submitted));
        setScore(Number(lastSet.score || 0));
        setAudioError("");
        setAudioLoadingKey("");
      } catch (error) {
        console.error(error);
      } finally {
        restoringRef.current = false;
        setDailyStateLoaded(true);
      }
    };

    void restoreKatsuyouState();
  }, [reviewReady, loading, rows, reviewMode]);

  useEffect(() => {
    if (!reviewReady) return;
    if (loading || rows.length === 0) return;
    if (!dailyStateLoaded) return;
    if (restoringRef.current) return;

    if (!didAutoCreateRef.current) {
      didAutoCreateRef.current = true;
    }

    if (reviewMode) {
      generateReviewQuiz();
      return;
    }

    if (questions.length > 0) return;

    generateQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reviewReady,
    loading,
    rows,
    dailyStateLoaded,
    selectedPos,
    selectedQType,
    reviewMode,
    reviewQids.join(","),
    reviewPos,
    reviewQType,
  ]);

  const openCompletionModal = (
    nextScore: number,
    currentQuestions: KatsuyouQuestion[],
    currentAnswers: AnswerMap
  ) => {
    const wrongCount = currentQuestions.filter(
      (_, idx) => currentAnswers[idx] !== currentQuestions[idx].correct_text
    ).length;

    setCompletionWrongCount(wrongCount);

    if (nextScore === currentQuestions.length) {
      setCompletionTitle("🎉 이 조건은 거의 정복했어요");
      setCompletionBody(
        `완벽합니다.\n${nextScore}/${currentQuestions.length} 정답이에요.\n다른 품사나 방향으로 넘어가 보세요.`
      );
      setCompletionModalOpen(true);
      return;
    }

    setCompletionTitle("✅ 이 조건은 거의 정복했어요");
    setCompletionBody(
      `${nextScore}/${currentQuestions.length} 정답이에요.\n현재 조건에서는 새 10문항 구성이 거의 끝났습니다.\n다른 품사나 방향으로 넘어가거나, 틀린 문제만 다시 볼 수 있어요.`
    );
    setCompletionModalOpen(true);
  };

  const closeCompletionModal = () => {
    setCompletionModalOpen(false);
    setCompletionWrongCount(0);
  };

  const handleContinueSameMode = () => {
    setCompletionModalOpen(false);
    setCompletionWrongCount(0);

    if (reviewMode) {
      void clearKatsuyouSavedSet();
      window.location.href = "/katsuyou";
      return;
    }

    makeNewQuiz();
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  };

  const handleRetryWrongOnlyFromModal = () => {
    setCompletionModalOpen(false);
    setCompletionWrongCount(0);
    handleRetryWrongOnly();
  };

  const handleBackToSelect = () => {
    setCompletionModalOpen(false);
    setCompletionWrongCount(0);
    setSubmitted(false);
    setScore(0);
    setQuestions([]);
    setAnswers({});
    setAudioError("");
    setAudioLoadingKey("");
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  };

  const makeNewQuiz = () => {
    if (reviewMode) {
      void clearKatsuyouSavedSet();
      window.location.href = "/katsuyou";
      return;
    }

    generateQuiz();
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

    const nextAnswers = {
      ...answers,
      [index]: choice,
    };

    setAnswers(nextAnswers);

    if (!reviewMode) {
      void persistKatsuyouSet({
        nextQuestions: questions,
        nextAnswers,
        nextSubmitted: false,
        nextScore: score,
        nextPos: selectedPos,
        nextQType: selectedQType,
      });
    }
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

    if (!reviewMode) {
      void persistKatsuyouSet({
        nextQuestions: questions,
        nextAnswers: answers,
        nextSubmitted: true,
        nextScore,
        nextPos: selectedPos,
        nextQType: selectedQType,
      });
    }

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

    if (!reviewMode) {
      void persistKatsuyouSet({
        nextQuestions,
        nextAnswers: {},
        nextSubmitted: false,
        nextScore: 0,
        nextPos: selectedPos,
        nextQType: selectedQType,
      });
    }
  };

  const autoSaveResult = async ({
    currentQuestions,
    currentAnswers,
    nextScore,
  }: {
    currentQuestions: KatsuyouQuestion[];
    currentAnswers: AnswerMap;
    nextScore: number;
  }) => {
    if (currentQuestions.length === 0) return;

    const nextExcludedWords: ExcludedWordMap = { ...excludedWords };
    currentQuestions.forEach((q, idx) => {
      if (currentAnswers[idx] === q.correct_text) {
        nextExcludedWords[q.jp_word] = true;
      }
    });

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(userError);
        alert("로그인 정보가 없어 결과를 저장하지 못했습니다.");
        if (shouldShowCompletionModal(nextExcludedWords)) {
          openCompletionModal(nextScore, currentQuestions, currentAnswers);
        }
        return;
      }

      const wrongList = currentQuestions
        .map((q, idx) => ({
          question: q,
          selected: currentAnswers[idx] || "",
        }))
        .filter((item) => item.selected !== item.question.correct_text);

      const payload = buildKatsuyouAttemptPayload({
        user_id: user.id,
        user_email: user.email ?? "",
        pos: selectedPos,
        pos_mode: `활용 · ${posLabel(selectedPos)} · ${qtypeLabel(
          selectedQType
        )}`,
        quiz_len: currentQuestions.length,
        score: nextScore,
        wrongList,
        questions: currentQuestions,
      });

      const result = await saveQuizAttempt(payload);

      if (!result.ok) {
        alert("결과 저장 중 오류가 발생했습니다.");
        if (shouldShowCompletionModal(nextExcludedWords)) {
          openCompletionModal(nextScore, currentQuestions, currentAnswers);
        }
        return;
      }

      const used = await fetchTodayBasicQuizSetCount(user.id);
      setTodayWordKanjiSets(used);

      if (!isPaidPlan(userPlan) && used >= DAILY_FREE_SET_LIMIT) {
        setLimitMessage(
          "오늘 무료 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자·활용은 내일 다시 이어서 풀 수 있어요."
        );
      }

      if (!reviewMode) {
        await clearKatsuyouSavedSet();
      }

      if (shouldShowCompletionModal(nextExcludedWords)) {
        openCompletionModal(nextScore, currentQuestions, currentAnswers);
      }
    } catch (error) {
      console.error(error);
      alert("결과 저장 중 오류가 발생했습니다.");
      if (shouldShowCompletionModal(nextExcludedWords)) {
        openCompletionModal(nextScore, currentQuestions, currentAnswers);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !reviewReady || !dailyStateLoaded) {
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
        <h1 className="mt-4 text-4xl font-bold">🔄 활용</h1>

        {reviewMode ? (
          <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-sm font-semibold text-orange-700">
              오답 복습 모드
            </p>
            <p className="mt-1 text-sm text-orange-600">
              오답노트에서 선택한 활용 문제만 다시 풀고 있습니다.
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          <p className="text-base font-semibold text-gray-700 sm:text-lg">
            ✅ 품사를 선택하세요
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {POS_OPTIONS.map((item) => {
              const active = selectedPos === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSelectedPos(item.value)}
                  className={
                    active
                      ? "rounded-2xl border border-red-400 bg-red-500 px-3 py-3 text-sm font-semibold text-white sm:px-4 sm:text-lg"
                      : "rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-900 sm:px-4 sm:text-lg"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-base font-semibold text-gray-700 sm:text-lg">
            ✅ 방향을 선택하세요
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
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
            isDailyLimitReached
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
                  isDailyLimitReached
                    ? "text-xs font-semibold text-red-700 sm:text-sm"
                    : "text-xs font-semibold text-gray-800 sm:text-sm"
                }
              >
                {isPaidPlan(userPlan)
                  ? `${userPlan.toUpperCase()} · 단어·한자·활용 무제한`
                  : `FREE · 오늘 ${todayWordKanjiSets}/${DAILY_FREE_SET_LIMIT}세트`}
              </p>
              <p
                className={
                  isDailyLimitReached
                    ? "mt-1 text-xs text-red-600"
                    : "mt-1 text-xs text-gray-500"
                }
              >
                {isPaidPlan(userPlan)
                  ? "자세한 이용 안내 보기"
                  : isDailyLimitReached
                    ? "오늘 이용 완료"
                    : remainingSets === 1
                      ? "오늘 1세트 남음"
                      : `오늘 ${remainingSets}세트 남음`}
              </p>
            </div>
            <span
              className={
                isDailyLimitReached
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
                isDailyLimitReached
                  ? "mt-3 border-t border-red-200 pt-3 text-xs leading-6 text-red-700 sm:text-sm"
                  : "mt-3 border-t border-gray-200 pt-3 text-xs leading-6 text-gray-600 sm:text-sm"
              }
            >
              <p>
                {isPaidPlan(userPlan)
                  ? "유료 플랜은 단어·한자·활용을 제한 없이 이용할 수 있습니다."
                  : isDailyLimitReached
                    ? "오늘 무료 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자·활용은 내일 다시 이어서 풀 수 있어요."
                    : `무료 플랜은 단어·한자·활용을 합산 하루 3세트까지 이용할 수 있습니다. 오늘은 ${remainingSets}세트 더 이용할 수 있습니다.`}
              </p>
            </div>
          ) : null}

          {isDailyLimitReached ? (
            <div className="mt-3">
              <a
                href={PRO_UPGRADE_URL}
                className="inline-flex rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white"
              >
                유료 플랜 보기
              </a>
            </div>
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
                  ? "rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-600 sm:px-4 sm:py-4 sm:text-lg"
                  : "rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-800 sm:px-4 sm:py-4 sm:text-lg"
              }
            >
              {reviewMode
                ? "일반 활용 문제로 돌아가기"
                : isDailyLimitReached
                  ? "오늘 이용 완료"
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
            <span className="text-lg font-semibold">
              🔎 디버그: 품사별 단어 수
            </span>
          </button>

          {debugOpen ? (
            <div className="border-t border-gray-200 px-4 py-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {POS_OPTIONS.map((item) => (
                  <div
                    key={item.value}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <p className="text-lg font-bold">{item.label}</p>
                    <p className="mt-2 text-sm text-gray-600">
                      {posCounts[item.value]}개
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {!isDailyLimitReached && questions.length > 0 ? (
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
                  <div key={`${q.item_key || q.jp_word}-${idx}`}>
                    <div
                      className={
                        q.qtype === "jp2kr" && canUseTts
                          ? "flex items-start justify-between gap-3"
                          : ""
                      }
                    >
                      <p className="text-xl font-semibold sm:text-2xl">
                        {circleNumber(idx)}{" "}
                        <span lang="ja" style={JA_FONT_STYLE}>
                          {q.prompt}
                        </span>
                      </p>

                      {q.qtype === "jp2kr" && canUseTts ? (
                        <button
                          type="button"
                          onClick={() => speakJapanese(q.prompt, `q-${idx}`)}
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
                          일본어:{" "}
                          <span lang="ja" style={JA_FONT_STYLE}>
                            {q.jp_word}
                          </span>
                          {q.reading ? (
                            <>
                              {" "}
                              / 읽기:{" "}
                              <span lang="ja" style={JA_FONT_STYLE}>
                                {q.reading}
                              </span>
                            </>
                          ) : null}{" "}
                          / 한국어: {q.kr_word}
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                          품사: {posLabel(q.pos)} / 유형: {qtypeLabel(q.qtype)}
                        </p>

                        {q.qtype === "jp2kr" && canUseTts ? (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() =>
                                speakJapanese(
                                  q.reading || q.jp_word,
                                  `answer-${idx}`
                                )
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
                          🎉 Perfect Streak! 10연속 정답!
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl bg-yellow-50 p-4">
                      <p className="text-base font-semibold text-yellow-800">
                        💪 괜찮아요! 틀린 문제는 성장의 재료예요. 다시 한 번
                        도전해봐요.
                      </p>
                    </div>
                  )}

                  <div className="text-sm text-gray-500">
                    🧠 오늘 최고 콤보: {score}연속
                  </div>

                  {wrongItems.length > 0 ? (
                    <div className="mt-2">
                      <h2 className="text-3xl font-bold text-gray-900">
                        ❌ 오답 노트
                      </h2>

                      <div className="mt-4 space-y-4">
                        {wrongItems.slice(0, 3).map((item, i) => (
                          <div
                            key={`${item.question.item_key || item.question.jp_word
                              }-${i}`}
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
                                  {item.question.prompt} · 품사:{" "}
                                  {posLabel(item.question.pos)} · 유형:{" "}
                                  {qtypeLabel(item.question.qtype)}
                                </p>
                              </div>
                              <div className="rounded-full border border-gray-200 px-4 py-1 text-sm font-semibold">
                                오답
                              </div>
                            </div>

                            <div className="mt-4 space-y-1 text-base sm:text-lg">
                              <p>
                                <span className="font-semibold">내 답</span>{" "}
                                <span lang="ja" style={JA_FONT_STYLE}>
                                  {item.selected}
                                </span>
                              </p>
                              <p>
                                <span className="font-semibold">정답</span>{" "}
                                <span lang="ja" style={JA_FONT_STYLE}>
                                  {item.question.correct_text}
                                </span>
                              </p>
                              {item.question.reading ? (
                                <p>
                                  <span className="font-semibold">발음</span>{" "}
                                  <span lang="ja" style={JA_FONT_STYLE}>
                                    {item.question.reading}
                                  </span>
                                </p>
                              ) : null}
                              <p>
                                <span className="font-semibold">뜻</span>{" "}
                                {item.question.kr_word}
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
                      {reviewMode
                        ? "일반 활용 문제로 돌아가기"
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
            className={`mt-6 rounded-2xl border p-5 ${isDailyLimitReached
                ? "border-red-200 bg-red-50"
                : "border-gray-300 bg-white"
              }`}
          >
            <p
              className={`text-sm ${isDailyLimitReached ? "text-red-700" : "text-gray-500"
                }`}
            >
              {isDailyLimitReached
                ? "오늘 단어·한자·활용 학습은 모두 완료했습니다. 내일 다시 이어서 풀거나 PRO로 계속 이용해 보세요."
                : reviewMode
                  ? "선택한 오답 문제를 찾지 못했습니다."
                  : "이 조건은 거의 정복했어요. 다른 품사나 방향으로 넘어가 보세요."}
            </p>
          </div>
        )}
      </div>

      {completionModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {completionTitle}
              </p>
              <p className="mt-3 whitespace-pre-line text-base leading-7 text-gray-600">
                {completionBody}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleContinueSameMode}
                disabled={saving || (!reviewMode && isDailyLimitReached)}
                className={
                  saving || (!reviewMode && isDailyLimitReached)
                    ? "w-full rounded-2xl border border-gray-200 bg-gray-100 px-5 py-4 text-lg font-semibold text-gray-400"
                    : "w-full rounded-2xl bg-black px-5 py-4 text-lg font-semibold text-white"
                }
              >
                {reviewMode
                  ? "일반 활용 문제로 돌아가기"
                  : !reviewMode && isDailyLimitReached
                    ? "오늘 이용 완료"
                    : "같은 조건으로 다음 10문항"}
              </button>

              {completionWrongCount > 0 ? (
                <button
                  type="button"
                  onClick={handleRetryWrongOnlyFromModal}
                  className="w-full rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold text-gray-900"
                >
                  틀린 문제만 다시 풀기
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleBackToSelect}
                className="w-full rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold text-gray-700"
              >
                선택으로 돌아가기
              </button>

              <button
                type="button"
                onClick={closeCompletionModal}
                className="w-full rounded-2xl px-5 py-3 text-sm font-medium text-gray-500"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}