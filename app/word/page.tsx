"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchTodayWordKanjiSetCount, saveQuizAttempt } from "@/lib/attempts";
import type { WordQType, WordQuestion, WordRow } from "@/app/types/word";
import { loadWordRows } from "@/lib/word-loader";
import { buildWordQuiz } from "@/lib/word-quiz";
import { buildWordAttemptPayload } from "@/lib/word-payload";
import { loadPatternRows, filterPatternRows } from "@/lib/pattern-loader";
import type { PatternRow } from "@/app/types/pattern";
import { isPaidPlan, normalizePlan, type PlanCode } from "@/lib/plans";
import { hasSeenHomeToday } from "@/lib/home-gate";

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

function shuffleArray<T>(arr: T[]): T[] {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const v of values) {
    const s = String(v || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

const JA_FONT_STYLE = {
  fontFamily:
    '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
} as const;

const DAILY_FREE_SET_LIMIT = 3;
const PRO_UPGRADE_URL = "/pro";
const BASE_SFX_URL = "https://hotena.com/hotena/app/mp3/sfx";

export default function WordPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [reviewReady, setReviewReady] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewQids, setReviewQids] = useState<string[]>([]);
  const [reviewQtype, setReviewQtype] = useState("");
  const [reviewPos, setReviewPos] = useState("");

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
      const next = encodeURIComponent(
        `${pathname || "/word"}${window.location.search || ""}`
      );
      router.replace(`/?next=${next}`);
    }
  }, [router, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    setIsReviewMode(params.get("review") === "1");
    setReviewQids(
      (params.get("qids") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    );
    setReviewQtype((params.get("qtype") || "").trim());
    setReviewPos((params.get("pos") || "").trim().toLowerCase());

    setReviewReady(true);
  }, []);

  const visiblePatterns = useMemo(
    () =>
      filterPatternRows(
        patternRows,
        selectedPosGroup === "other" ? "" : selectedPosGroup
      ),
    [patternRows, selectedPosGroup]
  );

  const featuredPattern = useMemo(() => {
    if (visiblePatterns.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * visiblePatterns.length);
    return visiblePatterns[randomIndex];
  }, [visiblePatterns]);

  const reviewRows = useMemo(() => {
    if (!isReviewMode || reviewQids.length === 0) return [] as WordRow[];

    const qidSet = new Set(
      reviewQids.map((v) => String(v || "").trim()).filter(Boolean)
    );

    return rows.filter((row) => {
      const itemKey = String(
        (row as { item_key?: string }).item_key || ""
      ).trim();
      const jpWord = String(row.jp_word || "").trim();
      const rowPos = String(row.pos || "").trim().toLowerCase();

      const idMatched = (itemKey && qidSet.has(itemKey)) || qidSet.has(jpWord);
      const posMatched = !reviewPos || reviewPos === rowPos;

      return Boolean(idMatched && posMatched);
    });
  }, [rows, isReviewMode, reviewQids, reviewPos]);

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

  const isPerfect =
    submitted && questions.length > 0 && score === questions.length;
  const showWrongNote = submitted && wrongItems.length > 0;

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
        console.error("[word sfx] play failed:", error);
      });
    } catch (error) {
      console.error("[word sfx] unexpected error:", error);
    }
  };

  useEffect(() => {
    if (selectedPosGroup === "other" && selectedQType === "reading") {
      setSelectedQType("meaning");
    }
  }, [selectedPosGroup, selectedQType]);

  useEffect(() => {
    if (!isReviewMode) return;

    if (
      reviewQtype === "reading" ||
      reviewQtype === "meaning" ||
      reviewQtype === "kr2jp"
    ) {
      setSelectedQType(reviewQtype as WordQType);
    }

    if (!reviewPos) return;

    if (["noun", "adj_i", "adj_na", "verb"].includes(reviewPos)) {
      setSelectedPosGroup(reviewPos);
      return;
    }

    if (
      ["adverb", "particle", "conjunction", "interjection"].includes(reviewPos)
    ) {
      setSelectedPosGroup("other");
      setSelectedOtherPos([reviewPos]);
    }
  }, [isReviewMode, reviewQtype, reviewPos]);

  useEffect(() => {
    if (isDailyLimitReached && !isReviewMode) {
      setQuestions([]);
      setAnswers({});
      setSubmitted(false);
      setScore(0);
      setAudioError("");
      setAudioLoadingKey("");
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

  const buildReviewQuestionsDirect = (
    targetRows: WordRow[],
    allRows: WordRow[],
    qtype: WordQType
  ): WordQuestion[] => {
    const basePool =
      reviewPos && reviewPos.length > 0
        ? allRows.filter(
          (row) => String(row.pos || "").trim().toLowerCase() === reviewPos
        )
        : allRows;

    return targetRows
      .map((row) => {
        const jp_word = String(row.jp_word || "").trim();
        const reading = String(row.reading || "").trim();
        const meaning = String(row.meaning || "").trim();
        const level = String((row as { level?: string }).level || "").trim();
        const pos = String(row.pos || "").trim().toLowerCase();
        const example_jp = String(
          (row as { example_jp?: string }).example_jp || ""
        ).trim();
        const example_kr = String(
          (row as { example_kr?: string }).example_kr || ""
        ).trim();

        if (!jp_word) return null;

        let prompt = "";
        let correct_text = "";
        let choices: string[] = [];

        if (qtype === "reading") {
          prompt = jp_word;
          correct_text = reading;

          const distractors = uniqueStrings(
            shuffleArray(
              basePool
                .filter((r) => String(r.jp_word || "").trim() !== jp_word)
                .map((r) => String(r.reading || "").trim())
            )
          )
            .filter((v) => v && v !== correct_text)
            .slice(0, 3);

          choices = shuffleArray(uniqueStrings([correct_text, ...distractors]));
        } else if (qtype === "meaning") {
          prompt = jp_word;
          correct_text = meaning;

          const distractors = uniqueStrings(
            shuffleArray(
              basePool
                .filter((r) => String(r.jp_word || "").trim() !== jp_word)
                .map((r) => String(r.meaning || "").trim())
            )
          )
            .filter((v) => v && v !== correct_text)
            .slice(0, 3);

          choices = shuffleArray(uniqueStrings([correct_text, ...distractors]));
        } else {
          prompt = meaning;
          correct_text = jp_word;

          const distractors = uniqueStrings(
            shuffleArray(
              basePool
                .filter((r) => String(r.jp_word || "").trim() !== jp_word)
                .map((r) => String(r.jp_word || "").trim())
            )
          )
            .filter((v) => v && v !== correct_text)
            .slice(0, 3);

          choices = shuffleArray(uniqueStrings([correct_text, ...distractors]));
        }

        if (!prompt || !correct_text || choices.length < 2) return null;

        return {
          app: "word",
          jp_word,
          reading,
          meaning,
          level,
          pos,
          qtype,
          prompt,
          correct_text,
          choices,
          example_jp,
          example_kr,
        } as WordQuestion;
      })
      .filter(Boolean) as WordQuestion[];
  };

  const makeDirectQuestion = (
    row: WordRow,
    basePool: WordRow[],
    qtype: WordQType
  ): WordQuestion | null => {
    const jp_word = String(row.jp_word || "").trim();
    const reading = String(row.reading || "").trim();
    const meaning = String(row.meaning || "").trim();
    const level = String((row as { level?: string }).level || "").trim();
    const pos = String(row.pos || "").trim().toLowerCase();
    const example_jp = String(
      (row as { example_jp?: string }).example_jp || ""
    ).trim();
    const example_kr = String(
      (row as { example_kr?: string }).example_kr || ""
    ).trim();

    if (!jp_word) return null;

    let prompt = "";
    let correct_text = "";
    let choices: string[] = [];

    if (qtype === "reading") {
      prompt = jp_word;
      correct_text = reading;

      const distractors = uniqueStrings(
        shuffleArray(
          basePool
            .filter((r) => String(r.jp_word || "").trim() !== jp_word)
            .map((r) => String(r.reading || "").trim())
        )
      )
        .filter((v) => v && v !== correct_text)
        .slice(0, 3);

      choices = shuffleArray(uniqueStrings([correct_text, ...distractors]));
    } else if (qtype === "meaning") {
      prompt = jp_word;
      correct_text = meaning;

      const distractors = uniqueStrings(
        shuffleArray(
          basePool
            .filter((r) => String(r.jp_word || "").trim() !== jp_word)
            .map((r) => String(r.meaning || "").trim())
        )
      )
        .filter((v) => v && v !== correct_text)
        .slice(0, 3);

      choices = shuffleArray(uniqueStrings([correct_text, ...distractors]));
    } else {
      prompt = meaning;
      correct_text = jp_word;

      const distractors = uniqueStrings(
        shuffleArray(
          basePool
            .filter((r) => String(r.jp_word || "").trim() !== jp_word)
            .map((r) => String(r.jp_word || "").trim())
        )
      )
        .filter((v) => v && v !== correct_text)
        .slice(0, 3);

      choices = shuffleArray(uniqueStrings([correct_text, ...distractors]));
    }

    if (!prompt || !correct_text || choices.length < 2) return null;

    return {
      app: "word",
      jp_word,
      reading,
      meaning,
      level,
      pos,
      qtype,
      prompt,
      correct_text,
      choices,
      example_jp,
      example_kr,
    };
  };

  const generateQuiz = () => {
    try {
      if (isReviewMode) {
        if (reviewRows.length === 0) {
          setQuestions([]);
          setAnswers({});
          setSubmitted(false);
          setScore(0);
          setAudioError("");
          setAudioLoadingKey("");
          return;
        }

        const reviewQtypeValue: WordQType =
          reviewQtype === "meaning" || reviewQtype === "kr2jp"
            ? (reviewQtype as WordQType)
            : "reading";

        const reviewQuestions = buildReviewQuestionsDirect(
          reviewRows,
          rows,
          reviewQtypeValue
        );

        if (reviewQuestions.length === 0) {
          setQuestions([]);
          setAnswers({});
          setSubmitted(false);
          setScore(0);
          setAudioError("");
          setAudioLoadingKey("");
          return;
        }

        setQuestions(reviewQuestions);
        setAnswers({});
        setSubmitted(false);
        setScore(0);
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

      let quiz: WordQuestion[] = [];

      if (selectedPosGroup === "other") {
        if (selectedOtherPos.length === 0) {
          setQuestions([]);
          return;
        }

        let filteredRows = rows.filter((row) =>
          selectedOtherPos.includes(String(row.pos || "").trim().toLowerCase())
        );

        if (selectedQType === "reading") {
          filteredRows = filteredRows.filter((row) =>
            /[\u4E00-\u9FFF]/.test(String(row.jp_word || ""))
          );
        }

        if (blockedWords.length > 0) {
          const blocked = new Set(blockedWords);
          filteredRows = filteredRows.filter(
            (row) => !blocked.has(String(row.jp_word || "").trim())
          );
        }

        if (filteredRows.length < 10) {
          setQuestions([]);
          return;
        }

        const sampled = shuffleArray(filteredRows).slice(0, 10);

        quiz = sampled
          .map((row) => makeDirectQuestion(row, filteredRows, selectedQType))
          .filter(Boolean) as WordQuestion[];
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
    if (!reviewReady || loading || rows.length === 0) return;
    if (selectedPosGroup === "other" && selectedOtherPos.length === 0) {
      setQuestions([]);
      return;
    }

    if (!didAutoCreateRef.current) {
      didAutoCreateRef.current = true;
    }

    generateQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reviewReady,
    loading,
    rows,
    selectedPosGroup,
    selectedQType,
    selectedOtherPos.join("|"),
    isReviewMode,
    reviewRows,
    reviewQtype,
    reviewPos,
  ]);

  const openCompletionModal = (
    nextScore: number,
    currentQuestions: WordQuestion[],
    currentAnswers: AnswerMap
  ) => {
    const wrongCount = currentQuestions.filter(
      (_, idx) => currentAnswers[idx] !== currentQuestions[idx].correct_text
    ).length;

    setCompletionWrongCount(wrongCount);

    if (nextScore === currentQuestions.length) {
      setCompletionTitle("🎉 단어 훈련 완료");
      setCompletionBody(
        `완벽합니다.\n${nextScore}/${currentQuestions.length} 정답이에요.\n같은 조건으로 다음 10문항을 이어서 풀까요?`
      );
      setCompletionModalOpen(true);
      return;
    }

    setCompletionTitle("✅ 단어 훈련 완료");
    setCompletionBody(
      `${nextScore}/${currentQuestions.length} 정답이에요.\n틀린 단어는 ${wrongCount}개입니다.\n이어서 새 문제를 풀거나, 틀린 문제만 다시 볼 수 있어요.`
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
    if (isReviewMode) {
      generateQuiz();
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
    currentQuestions: WordQuestion[];
    currentAnswers: AnswerMap;
    nextScore: number;
  }) => {
    if (currentQuestions.length === 0) return;

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(userError);
        alert("로그인 정보가 없어 결과를 저장하지 못했습니다.");
        openCompletionModal(nextScore, currentQuestions, currentAnswers);
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

      const payload = buildWordAttemptPayload({
        user_id: user.id,
        user_email: user.email ?? "",
        level: "",
        pos_mode: `단어 · ${selectedPosGroup} · ${selectedQType}`,
        quiz_len: currentQuestions.length,
        score: nextScore,
        wrongList,
        questions: currentQuestions,
      });

      const result = await saveQuizAttempt(payload);

      if (!result.ok) {
        alert("결과 저장 중 오류가 발생했습니다.");
        openCompletionModal(nextScore, currentQuestions, currentAnswers);
        return;
      }

      const used = await fetchTodayWordKanjiSetCount(user.id);
      setTodayWordKanjiSets(used);

      if (!isPaidPlan(userPlan) && used >= DAILY_FREE_SET_LIMIT) {
        setLimitMessage(
          "오늘 FREE 이용 한도 3/3세트를 모두 사용했습니다. 단어·한자는 내일 다시 이어서 풀 수 있어요."
        );
      }

      openCompletionModal(nextScore, currentQuestions, currentAnswers);
    } catch (error) {
      console.error(error);
      alert("결과 저장 중 오류가 발생했습니다.");
      openCompletionModal(nextScore, currentQuestions, currentAnswers);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !reviewReady) {
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
        <h1 className="mt-4 text-4xl font-bold">📝 단어</h1>

        {isReviewMode ? (
          <p className="mt-3 text-sm font-semibold text-blue-600">
            오답노트 복습 모드 · 선택한 문제만 출제됩니다.
          </p>
        ) : null}

        <div className="mt-8">
          <p className="text-base font-semibold text-gray-700 sm:text-lg">
            ✅ 품사를 선택하세요
          </p>
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
                      ? "rounded-2xl border border-red-400 bg-red-500 px-3 py-3 text-sm font-semibold text-white sm:px-4 sm:text-lg"
                      : "rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-900 sm:px-4 sm:text-lg"
                  }
                >
                  <span
                    className={
                      item.value === "adj_i" || item.value === "adj_na"
                        ? "text-[13px] leading-tight sm:text-base"
                        : ""
                    }
                  >
                    {item.label}
                  </span>
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
                        className="flex items-center gap-3 text-base text-gray-900 sm:text-lg"
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
                  disabled={!isReviewMode && isDailyLimitReached}
                  className={
                    !isReviewMode && isDailyLimitReached
                      ? "mt-5 w-full rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-600 sm:px-4 sm:py-4 sm:text-lg"
                      : "mt-5 w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-800 sm:px-4 sm:py-4 sm:text-lg"
                  }
                >
                  {!isReviewMode && isDailyLimitReached
                    ? "오늘 이용 완료"
                    : isReviewMode
                      ? "🔄 선택한 복습 문제 다시 불러오기"
                      : "🔄 기타 선택 적용(새 문제)"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          <p className="text-base font-semibold text-gray-700 sm:text-lg">
            ✅ 유형을 선택하세요
          </p>
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

        <div className="mt-6 rounded-2xl border border-gray-300 bg-white">
          <button
            type="button"
            onClick={() => setPatternOpen((prev) => !prev)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left"
          >
            <span className="text-lg">{patternOpen ? "⌄" : "›"}</span>
            <span className="text-lg font-semibold">
              📌 필수패턴 (카드로 빠르게 익히기)
            </span>
          </button>

          {patternOpen ? (
            <div className="border-t border-gray-200 px-4 py-4">
              {!featuredPattern ? (
                <p className="text-sm text-gray-500">표시할 패턴이 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                    랜덤 1개 패턴
                  </div>

                  <div className="rounded-3xl border border-gray-200 p-5">
                    <p className="text-2xl font-bold sm:text-3xl">
                      {featuredPattern.title}
                    </p>
                    <p className="mt-4 text-xl font-semibold sm:text-2xl">
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {featuredPattern.jp}
                      </span>
                    </p>
                    <p className="mt-2 text-xl text-gray-700">
                      {featuredPattern.kr}
                    </p>

                    <div className="mt-6">
                      <p className="text-base font-semibold sm:text-xl">
                        <span lang="ja" style={JA_FONT_STYLE}>
                          {featuredPattern.ex1_jp}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-gray-700 sm:text-lg">
                        {featuredPattern.ex1_kr}
                      </p>
                    </div>

                    <div className="mt-5">
                      <p className="text-base font-semibold sm:text-xl">
                        <span lang="ja" style={JA_FONT_STYLE}>
                          {featuredPattern.ex2_jp}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-gray-700 sm:text-lg">
                        {featuredPattern.ex2_kr}
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
                  ? "rounded-2xl border border-gray-200 bg-gray-100 px-3 py-3 text-sm font-semibold text-gray-400 sm:px-4 sm:py-4 sm:text-lg"
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
                          품사: {posLabel(q.pos)} / 유형: {qtypeLabel(q.qtype)}
                        </p>

                        {q.qtype === "meaning" ? (
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

                        {q.example_jp || q.example_kr ? (
                          <div className="mt-3 rounded-xl bg-blue-50 p-3">
                            <p className="text-sm text-blue-900">
                              {q.example_jp}
                            </p>
                            <p className="mt-1 text-sm text-blue-900">
                              {q.example_kr}
                            </p>
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

                  {showWrongNote ? (
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
                              <p>
                                <span className="font-semibold">발음</span>{" "}
                                <span lang="ja" style={JA_FONT_STYLE}>
                                  {item.question.reading}
                                </span>
                              </p>
                              <p>
                                <span className="font-semibold">뜻</span>{" "}
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
            className={`mt-6 rounded-2xl border p-5 ${!isReviewMode && isDailyLimitReached
              ? "border-red-200 bg-red-50"
              : "border-gray-300 bg-white"
              }`}
          >
            <p
              className={`text-sm ${!isReviewMode && isDailyLimitReached
                ? "text-red-700"
                : "text-gray-500"
                }`}
            >
              {!isReviewMode && isDailyLimitReached
                ? "오늘 단어·한자 학습은 모두 완료했습니다. 내일 다시 이어서 풀거나 PRO로 계속 이용해 보세요."
                : isReviewMode
                  ? "선택한 복습 문제로 퀴즈를 만들지 못했습니다."
                  : "이 조건은 거의 정복했어요. 다른 유형이나 품사로 넘어가 보세요."}
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
                disabled={saving || (!isReviewMode && isDailyLimitReached)}
                className={
                  saving || (!isReviewMode && isDailyLimitReached)
                    ? "w-full rounded-2xl border border-gray-200 bg-gray-100 px-5 py-4 text-lg font-semibold text-gray-400"
                    : "w-full rounded-2xl bg-black px-5 py-4 text-lg font-semibold text-white"
                }
              >
                {!isReviewMode && isDailyLimitReached
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