"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  clearDailyState,
  loadDailyState,
  pushRecentTurn,
  saveDailyState,
  todayKST,
} from "@/lib/progress";
import { saveQuizAttempt } from "@/lib/attempts";
import { buildTalkAttemptPayload } from "@/lib/talk-payload";
import type {
  SubOption,
  TagOption,
  TalkCsvRow,
  TalkWrongItem,
  ViewMode,
} from "@/types/talk";
import {
  getStageOptions,
  getSubOptions,
  getTagOptions,
  loadTalkRows,
} from "@/lib/talk-loader";

const QUIZ_SET_SIZE = 10;

type ReviewModeType = "wrong" | "random" | "old" | "mixed";
type PronStage = "idle" | "recording" | "recorded";

const TITLE_PATHS = {
  pronounce: "/images/hotena_talk/icons_title/icon_pronounce_title.png",
  coach: "/images/hotena_talk/icons_title/icon_coach_title.png",
  check: "/images/hotena_talk/icons_title/icon_check_title.png",
  score: "/images/hotena_talk/icons_title/icon_score_title.png",
  reward: "/images/hotena_talk/icons_title/icon_reward_title.png",
} as const;

function shuffleArray<T>(arr: T[]): T[] {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function resolveMp3Url(path: string): string {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return "https://hotena.com/hotena/app/mp3/" + raw.replace(/^\/+/, "");
}

function reviewModeLabel(mode: ReviewModeType) {
  switch (mode) {
    case "wrong":
      return "틀린 것";
    case "random":
      return "랜덤";
    case "old":
      return "오래된 것";
    case "mixed":
      return "혼합";
    default:
      return "랜덤";
  }
}

function getPublicImagePath(path: string): string {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("blob:")) {
    return raw;
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function formatSeconds(sec: number) {
  const minutes = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function fakeTranscript(answer: string, score: number) {
  if (score >= 100) return answer || "-";
  return "ああ。";
}

function fakePronComment(score: number, answer: string) {
  if (score >= 100) return `🎯 좋습니다
🗣️ ${answer} 를 자연스럽게 말했어요.`;
  return `🎯 조금 더 또렷하게
🗣️ 녹음을 조금 더 길게, 또박또박 해보세요.`;
}

function Waveform({ active }: { active: boolean }) {
  const bars = active
    ? [16, 24, 32, 28, 22, 18, 14, 20, 26, 18, 14, 12, 18, 16, 12, 20, 24, 18, 10]
    : [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];

  return (
    <div className="flex flex-1 items-center gap-[3px] overflow-hidden px-1">
      {bars.map((h, idx) => (
        <span
          key={`${h}-${idx}`}
          className="w-[4px] rounded-full bg-gray-400"
          style={{ height: `${h}px`, opacity: active ? 1 : 0.35 }}
        />
      ))}
      <div className="mx-2 h-px flex-1 border-t border-dashed border-gray-300" />
    </div>
  );
}

function EmojiBox({
  src,
  size = "small",
}: {
  src: string;
  size?: "small" | "large";
}) {
  const boxClass =
    size === "small" ? "h-12 w-12 rounded-xl" : "h-20 w-20 rounded-2xl";

  return (
    <div
      className={`${boxClass} overflow-hidden border border-gray-200 bg-white flex items-center justify-center text-2xl`}
    >
      {src ? (
        <img
          src={getPublicImagePath(src)}
          alt="내 이모티콘"
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span>🙂</span>
      )}
    </div>
  );
}

function TitleImage({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <p className="text-xl font-bold">{fallback}</p>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-8 w-auto object-contain sm:h-9"
      onError={() => setFailed(true)}
    />
  );
}

export default function TalkPage() {
  const searchParams = useSearchParams();

  const reviewQid = searchParams.get("qid") || "";
  const isReviewMode = searchParams.get("review") === "1";
  const reviewQidsParam = searchParams.get("qids") || "";
  const reviewQids = reviewQidsParam
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const [allRows, setAllRows] = useState<TalkCsvRow[]>([]);
  const [questions, setQuestions] = useState<TalkCsvRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("select");

  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [subOptions, setSubOptions] = useState<SubOption[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentChoices, setCurrentChoices] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [score, setScore] = useState(0);
  const [wrongList, setWrongList] = useState<TalkWrongItem[]>([]);
  const [saveDone, setSaveDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const [coachLoading, setCoachLoading] = useState(false);
  const [coachAnswer, setCoachAnswer] = useState("");
  const [coachError, setCoachError] = useState("");
  const [coachQuestion, setCoachQuestion] = useState("");

  const [userPlan, setUserPlan] = useState("FREE");

  const [audioLoadingKey, setAudioLoadingKey] = useState("");
  const [audioError, setAudioError] = useState("");

  const [selectedStage, setSelectedStage] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSub, setSelectedSub] = useState("전체");

  const [dailyStateLoaded, setDailyStateLoaded] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");

  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewModeType, setReviewModeType] =
    useState<ReviewModeType>("wrong");

  const [myEmojiUrl] = useState("/images/my-emoji.png");

  const [pronStage, setPronStage] = useState<PronStage>("idle");
  const [pronChecked, setPronChecked] = useState(false);
  const [pronScore, setPronScore] = useState<number | null>(null);
  const [pronFeedback, setPronFeedback] = useState("");
  const [pronTranscript, setPronTranscript] = useState("");
  const [pronDuration, setPronDuration] = useState("00:00");
  const [spokenSentenceCount, setSpokenSentenceCount] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [pronError, setPronError] = useState("");
  const [rewardChecked, setRewardChecked] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  const restoringRef = useRef(false);
  const resumedOnceRef = useRef(false);
  const reviewStartedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordSecondsRef = useRef(0);

  useEffect(() => {
    const loadCsv = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("plan")
            .eq("id", user.id)
            .maybeSingle();

          setUserPlan(String(profileRow?.plan || "FREE").toUpperCase());
        }

        const cleaned = await loadTalkRows();
        setAllRows(cleaned);

        const stages = getStageOptions(cleaned);
        setStageOptions(stages);

        if (stages.length > 0) {
          setSelectedStage(stages[0]);
        }
      } catch (error) {
        console.error(error);
        setErrorMsg("CSV 파일을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void loadCsv();
  }, []);

  useEffect(() => {
    if (!selectedStage || allRows.length === 0) return;

    const nextTagOptions = getTagOptions(allRows, selectedStage);
    setTagOptions(nextTagOptions);

    if (nextTagOptions.length > 0) {
      setSelectedTag((prev) => {
        if (restoringRef.current && prev) return prev;
        const exists = nextTagOptions.some((item) => item.value === prev);
        return exists ? prev : nextTagOptions[0].value;
      });
    } else {
      setSelectedTag("");
    }

    if (!restoringRef.current) {
      setSelectedSub("전체");
    }
  }, [selectedStage, allRows]);

  useEffect(() => {
    if (!selectedStage || !selectedTag || allRows.length === 0) return;

    const nextSubOptions = getSubOptions(allRows, selectedStage, selectedTag);
    setSubOptions(nextSubOptions);

    setSelectedSub((prev) => {
      if (restoringRef.current && prev) return prev;
      if (prev === "전체") return "전체";
      const exists = nextSubOptions.some((item) => item.value === prev);
      return exists ? prev : "전체";
    });
  }, [selectedStage, selectedTag, allRows]);

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (!currentQuestion) {
      setCurrentChoices([]);
      return;
    }

    const arr = [
      currentQuestion.answer_jp,
      currentQuestion.d1_jp,
      currentQuestion.d2_jp,
      currentQuestion.d3_jp,
    ].filter(Boolean);

    setCurrentChoices(shuffleArray(arr));
  }, [currentQuestion?.qid]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (recordedAudioUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  const isCorrect = submitted && selected === currentQuestion?.answer_jp;
  const isWrong = submitted && selected !== currentQuestion?.answer_jp;
  const isPro = userPlan === "PRO";

  const solvedCount = submitted ? currentIndex + 1 : currentIndex;
  const totalCount = questions.length || QUIZ_SET_SIZE;
  const remainingCount = Math.max(totalCount - solvedCount, 0);
  const progressPercent = totalCount
    ? Math.round((solvedCount / totalCount) * 100)
    : 0;

  const getTagLabel = (tag: string) =>
    tagOptions.find((item) => item.value === tag)?.label ||
    allRows.find((item) => item.tag === tag)?.tag_kr ||
    tag;

  const getSubLabel = (sub: string) =>
    subOptions.find((item) => item.value === sub)?.label ||
    allRows.find((item) => item.sub === sub)?.sub_kr ||
    sub;

  const getTodayMissionText = () => {
    if (spokenSentenceCount >= 7) {
      return "좋아요. 오늘은 이미 충분히 말했어요. 정답 문장을 3번만 더 또렷하게 따라가 봅시다.";
    }
    if (isCorrect) {
      return "좋아요. 오늘은 정답 문장을 자신 있게 한 번 더 입 밖으로 꺼내봅시다.";
    }
    return "오늘은 입을 7번만 열어봅시다.";
  };

  useEffect(() => {
    const tryResumeDailyState = async () => {
      if (loading || allRows.length === 0 || resumedOnceRef.current) return;
      resumedOnceRef.current = true;

      try {
        const ds = await loadDailyState("talk");
        if (!ds) {
          setDailyStateLoaded(true);
          return;
        }

        if (isReviewMode && (reviewQid || reviewQids.length > 0)) {
          setDailyStateLoaded(true);
          return;
        }

        restoringRef.current = true;

        setSelectedStage(ds.stage || "");
        setSelectedTag(ds.tag || "");
        setSelectedSub(ds.sub || "전체");

        const qidMap = new Map(allRows.map((row) => [row.qid, row]));
        const restored = ds.set_qids
          .map((qid) => qidMap.get(qid))
          .filter(Boolean) as TalkCsvRow[];

        if (restored.length === 0) {
          restoringRef.current = false;
          setDailyStateLoaded(true);
          return;
        }

        setQuestions(restored);
        setCurrentIndex(Math.min(Math.max(ds.idx || 0, 0), restored.length - 1));
        setSelected("");
        setSubmitted(false);
        setScore(0);
        setWrongList([]);
        setSaveDone(false);
        setCoachAnswer("");
        setCoachError("");
        setCoachLoading(false);
        setCoachQuestion("");
        setAudioError("");
        setAudioLoadingKey("");
        setPronStage("idle");
        setPronChecked(false);
        setPronScore(null);
        setPronFeedback("");
        setPronTranscript("");
        setPronDuration("00:00");
        setRecordedAudioUrl("");
        setPronError("");
        setRewardChecked(false);
        setReviewNotice("");
        setIsReviewing(false);
        setReviewPanelOpen(false);
        setViewMode("quiz");

        setTimeout(() => {
          restoringRef.current = false;
        }, 0);
      } catch (error) {
        console.error(error);
      } finally {
        setDailyStateLoaded(true);
      }
    };

    void tryResumeDailyState();
  }, [loading, allRows, isReviewMode, reviewQid, reviewQids.length]);

  const askTalkCoach = async (params: {
    question: string;
    context: string;
    plan?: string;
  }) => {
    try {
      setCoachLoading(true);
      setCoachError("");
      setCoachAnswer("");

      const res = await fetch("/api/talk-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!res.ok && !data?.answer) {
        throw new Error(data?.error || "AI 코치 호출 실패");
      }

      setCoachAnswer(String(data.answer || "").trim());
    } catch (error) {
      console.error(error);
      setCoachError("AI 스마트코치 응답을 불러오지 못했습니다.");
    } finally {
      setCoachLoading(false);
    }
  };

  const playAudio = async (src: string, key: string) => {
    if (!src) return;

    try {
      setAudioError("");
      setAudioLoadingKey(key);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const finalSrc = resolveMp3Url(src);
      const audio = new Audio(finalSrc);
      audioRef.current = audio;

      audio.onended = () => setAudioLoadingKey("");
      audio.onerror = () => {
        setAudioError("오디오를 재생하지 못했습니다.");
        setAudioLoadingKey("");
      };

      await audio.play();
      setAudioLoadingKey(key);
    } catch (error) {
      console.error(error);
      setAudioError("오디오를 재생하지 못했습니다.");
      setAudioLoadingKey("");
    }
  };

  const startPronRecording = async () => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setPronError("이 브라우저에서는 녹음을 지원하지 않습니다.");
      return;
    }

    try {
      if (recordedAudioUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(recordedAudioUrl);
      }

      setPronError("");
      setRewardChecked(false);
      setPronChecked(false);
      setPronScore(null);
      setPronFeedback("");
      setPronTranscript("");
      setPronDuration("00:00");
      setRecordedAudioUrl("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      recordChunksRef.current = [];
      recordSecondsRef.current = 0;
      setPronStage("recording");
      setPronDuration("00:00");

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }

        const blob = new Blob(recordChunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          const nextUrl = URL.createObjectURL(blob);
          setRecordedAudioUrl(nextUrl);
          setPronStage("recorded");
          setPronDuration(formatSeconds(recordSecondsRef.current));
        } else {
          setPronStage("idle");
          setPronError("녹음된 오디오를 찾지 못했습니다. 다시 시도해 주세요.");
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      mediaRecorder.start();
      recordTimerRef.current = window.setInterval(() => {
        recordSecondsRef.current += 1;
        setPronDuration(formatSeconds(recordSecondsRef.current));
      }, 1000);
    } catch (error) {
      console.error(error);
      setPronStage("idle");
      setPronError("마이크 권한을 확인한 뒤 다시 시도해 주세요.");
    }
  };

  const stopPronRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePronCheck = () => {
    if (!currentQuestion) return;
    if (pronStage !== "recorded" || !recordedAudioUrl) {
      setPronError("먼저 녹음한 뒤 점수를 확인해 주세요.");
      return;
    }

    const answer = currentQuestion.answer_jp || "";
    const durationSec = Math.max(recordSecondsRef.current, 0);
    const fakeScore = durationSec >= 2 ? 100 : 0;

    setPronChecked(true);
    setPronScore(fakeScore);
    setPronTranscript(fakeTranscript(answer, fakeScore));
    setPronFeedback(fakePronComment(fakeScore, answer));
    setRewardChecked(true);
    setPronError("");
    setSpokenSentenceCount((prev) => prev + 1);
  };

  const handleAskCustomCoach = async () => {
    if (!currentQuestion) return;
    if (!isPro) {
      setCoachError("AI 스마트코치는 PRO에서 이용할 수 있습니다.");
      return;
    }

    const q = coachQuestion.trim();
    if (!q) {
      alert("질문을 입력해주세요.");
      return;
    }

    try {
      const ctxParts = [
        `현재상황: ${currentQuestion.situation_kr || ""}`,
        `상대발화: ${currentQuestion.partner_jp || ""}`,
        `상대해석: ${currentQuestion.partner_kr || ""}`,
        `정답표현: ${currentQuestion.answer_jp || ""}`,
        `정답해석: ${currentQuestion.answer_kr || ""}`,
        `내선택: ${selected}`,
        `정오답: ${selected === currentQuestion.answer_jp ? "정답" : "오답"}`,
      ].filter(Boolean);

      await askTalkCoach({
        question: q,
        context: ctxParts.join("\n"),
        plan: userPlan,
      });
    } catch (error) {
      console.error(error);
      setCoachError("추가 질문 응답을 불러오지 못했습니다.");
    }
  };

  const handleStageChange = (stage: string) => {
    setSelectedStage(stage);
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    setSelectedSub("전체");
  };

  const startReviewMode = async () => {
    if (allRows.length === 0) return;

    let reviewRows: TalkCsvRow[] = [];
    if (reviewQids.length > 0) {
      const qidSet = new Set(reviewQids);
      reviewRows = allRows.filter((item) => qidSet.has(item.qid));
    } else if (reviewQid) {
      const row = allRows.find((item) => item.qid === reviewQid);
      if (row) reviewRows = [row];
    }

    if (reviewRows.length === 0) {
      setReviewNotice("복습할 문제를 찾지 못했습니다.");
      return;
    }

    const first = reviewRows[0];
    restoringRef.current = true;

    setSelectedStage(first.stage || "");
    setSelectedTag(first.tag || "");
    setSelectedSub(first.sub || "전체");

    setQuestions(reviewRows);
    setCurrentIndex(0);
    setSelected("");
    setSubmitted(false);
    setScore(0);
    setWrongList([]);
    setSaveDone(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    setPronStage("idle");
    setPronChecked(false);
    setPronScore(null);
    setPronFeedback("");
    setPronTranscript("");
    setPronDuration("00:00");
    setRecordedAudioUrl("");
    setPronError("");
    setRewardChecked(false);
    setReviewNotice(
      reviewRows.length === 1
        ? "오답노트 복습 모드입니다."
        : `오답노트 복습 세트입니다. (${reviewRows.length}문제)`
    );
    setIsReviewing(true);
    setReviewPanelOpen(false);
    setViewMode("quiz");

    setTimeout(() => {
      restoringRef.current = false;
    }, 0);
  };

  useEffect(() => {
    if (loading || allRows.length === 0 || !dailyStateLoaded) return;
    if (!isReviewMode || (!reviewQid && reviewQids.length === 0)) return;
    if (reviewStartedRef.current) return;

    reviewStartedRef.current = true;
    void startReviewMode();
  }, [loading, allRows, dailyStateLoaded, isReviewMode, reviewQid, reviewQids.length]);

  const makeQuizSet = async () => {
    setIsReviewing(false);
    setReviewNotice("");
    setReviewPanelOpen(false);

    let pool = allRows.filter(
      (row) => row.stage === selectedStage && row.tag === selectedTag
    );

    if (selectedSub !== "전체") {
      pool = pool.filter((row) => row.sub === selectedSub);
    }

    if (pool.length === 0) {
      alert("선택한 조건에 맞는 문제가 없습니다.");
      return;
    }

    const picked = shuffleArray(pool).slice(0, Math.min(QUIZ_SET_SIZE, pool.length));

    setQuestions(picked);
    setCurrentIndex(0);
    setSelected("");
    setSubmitted(false);
    setScore(0);
    setWrongList([]);
    setSaveDone(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    setPronStage("idle");
    setPronChecked(false);
    setPronScore(null);
    setPronFeedback("");
    setPronTranscript("");
    setPronDuration("00:00");
    setRecordedAudioUrl("");
    setPronError("");
    setRewardChecked(false);
    setViewMode("quiz");

    await saveDailyState(
      {
        date: todayKST(),
        key: `${selectedStage}|${selectedTag}|${selectedSub}|${userPlan}`,
        stage: selectedStage,
        tag: selectedTag,
        sub: selectedSub,
        set_qids: picked.map((q) => q.qid),
        idx: 0,
      },
      "talk"
    );
  };

  const startReviewSet = async () => {
    if (allRows.length === 0) {
      alert("복습할 데이터가 없습니다.");
      return;
    }

    let pool = [...allRows];
    if (selectedStage) pool = pool.filter((row) => row.stage === selectedStage);
    if (selectedTag) pool = pool.filter((row) => row.tag === selectedTag);
    if (selectedSub && selectedSub !== "전체") {
      pool = pool.filter((row) => row.sub === selectedSub);
    }

    if (pool.length === 0) {
      alert("선택한 조건에 맞는 복습 문제가 없습니다.");
      return;
    }

    let picked: TalkCsvRow[] = [];

    if (reviewModeType === "wrong") {
      const wrongQids = new Set(wrongList.map((item) => item.qid));
      const wrongPool = pool.filter((row) => wrongQids.has(row.qid));
      picked = shuffleArray(wrongPool).slice(0, Math.min(5, wrongPool.length));
    } else if (reviewModeType === "old") {
      picked = pool.slice(0, Math.min(5, pool.length));
    } else if (reviewModeType === "mixed") {
      const oldPart = pool.slice(0, Math.min(3, pool.length));
      const randomPart = shuffleArray(pool).slice(0, Math.min(2, pool.length));
      const merged = [...oldPart, ...randomPart];
      const seen = new Set<string>();
      picked = merged.filter((row) => {
        if (seen.has(row.qid)) return false;
        seen.add(row.qid);
        return true;
      });
    } else {
      picked = shuffleArray(pool).slice(0, Math.min(5, pool.length));
    }

    if (picked.length === 0) {
      alert("선택한 복습 방식에 맞는 문제가 없습니다.");
      return;
    }

    setQuestions(picked);
    setCurrentIndex(0);
    setSelected("");
    setSubmitted(false);
    setScore(0);
    setSaveDone(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    setPronStage("idle");
    setPronChecked(false);
    setPronScore(null);
    setPronFeedback("");
    setPronTranscript("");
    setPronDuration("00:00");
    setRecordedAudioUrl("");
    setPronError("");
    setRewardChecked(false);
    setIsReviewing(true);
    setReviewNotice(`복습중 · ${reviewModeLabel(reviewModeType)}`);
    setReviewPanelOpen(false);
    setViewMode("quiz");

    await saveDailyState(
      {
        date: todayKST(),
        key: `review|${selectedStage}|${selectedTag}|${selectedSub}|${reviewModeType}`,
        stage: selectedStage,
        tag: selectedTag,
        sub: selectedSub,
        set_qids: picked.map((q) => q.qid),
        idx: 0,
      },
      "talk"
    );
  };

  const switchToStudyMode = () => {
    setIsReviewing(false);
    setReviewNotice("");
    setReviewPanelOpen(false);
  };

  const handleSelect = (choice: string) => {
    if (submitted) return;
    setSelected(choice);
  };

  const handleSubmit = async () => {
    if (!currentQuestion) return;
    if (!selected) {
      alert("보기를 선택해주세요.");
      return;
    }

    const ok = selected === currentQuestion.answer_jp;

    if (ok) {
      setScore((prev) => prev + 1);
    } else {
      setWrongList((prev) => [
        ...prev,
        {
          qid: currentQuestion.qid,
          selected,
          correct: currentQuestion.answer_jp,
        },
      ]);
    }

    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    setPronStage("idle");
    setPronChecked(false);
    setPronScore(null);
    setPronFeedback("");
    setPronTranscript("");
    setPronDuration("00:00");
    setRecordedAudioUrl("");
    setPronError("");
    setRewardChecked(false);
    setSubmitted(true);

    try {
      await pushRecentTurn(
        {
          qid: currentQuestion.qid,
          situation_kr: currentQuestion.situation_kr || "",
          partner_jp: currentQuestion.partner_jp || "",
          selected,
          correct: currentQuestion.answer_jp || "",
          ok,
        },
        "talk"
      );
    } catch (error) {
      console.error(error);
    }
  };

  const saveAttemptToDb = async () => {
    if (saveDone || questions.length === 0) return;

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(userError);
        alert("로그인 정보가 없어 결과를 저장하지 못했습니다.");
        setSaving(false);
        return;
      }

      const displaySub = selectedSub === "전체" ? "전체" : getSubLabel(selectedSub);

      const payload = buildTalkAttemptPayload({
        user_id: user.id,
        user_email: user.email ?? "",
        level: currentQuestion?.level || "N3",
        pos_mode: `회화 · ${getTagLabel(selectedTag)} · ${displaySub}`,
        quiz_len: questions.length,
        score,
        wrongList,
        questions,
      });

      const result = await saveQuizAttempt(payload);

      if (!result.ok) {
        alert("결과 저장 중 오류가 발생했습니다.");
        setSaving(false);
        return;
      }

      await clearDailyState("talk");
      setSaveDone(true);
      setViewMode("done");
      alert("결과가 저장되었습니다.");
    } catch (error) {
      console.error(error);
      alert("결과 저장 중 오류가 발생했습니다.");
    }

    setSaving(false);
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setSelected("");
      setSubmitted(false);
      setCoachAnswer("");
      setCoachError("");
      setCoachLoading(false);
      setCoachQuestion("");
      setAudioError("");
      setAudioLoadingKey("");
      setPronStage("idle");
      setPronChecked(false);
      setPronScore(null);
      setPronFeedback("");
      setPronTranscript("");
      setPronDuration("00:00");

      await saveDailyState(
        {
          date: todayKST(),
          key: `${selectedStage}|${selectedTag}|${selectedSub}|${userPlan}`,
          stage: selectedStage,
          tag: selectedTag,
          sub: selectedSub,
          set_qids: questions.map((q) => q.qid),
          idx: nextIdx,
        },
        "talk"
      );
    } else {
      await saveAttemptToDb();
    }
  };

  const handleRewardComplete = async () => {
    if (!rewardChecked) {
      handlePronCheck();
      return;
    }

    if (pronScore !== 100) {
      return;
    }

    await handleNext();
  };

  const handleSkipNext = async () => {
    await handleNext();
  };

  const handleRestart = async () => {
    await clearDailyState("talk");

    restoringRef.current = false;
    resumedOnceRef.current = false;
    reviewStartedRef.current = false;
    setViewMode("select");
    setQuestions([]);
    setCurrentIndex(0);
    setCurrentChoices([]);
    setSelected("");
    setSubmitted(false);
    setScore(0);
    setWrongList([]);
    setSaveDone(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    setPronStage("idle");
    setPronChecked(false);
    setPronScore(null);
    setPronFeedback("");
    setPronTranscript("");
    setPronDuration("00:00");
    setRecordedAudioUrl("");
    setPronError("");
    setRewardChecked(false);
    setReviewNotice("");
    setDailyStateLoaded(false);
    setIsReviewing(false);
    setReviewPanelOpen(false);
    setSpokenSentenceCount(0);
  };

  const handleOpenWrongTalk = () => {
    window.location.href = "/mypage/wrong-talk";
  };

  const rewardMessage = (() => {
    if (!rewardChecked) return "";
    if ((pronScore ?? 0) < 100) {
      return "보상은 '녹음 + 100점'일 때만 받을 수 있어요. 지금 바로 다시 녹음해 100점을 만들어 보세요.";
    }
    if (!isCorrect) {
      return "발음은 100점이지만, 문제 선택이 오답이라 보상은 지급되지 않습니다. (정답/발음은 별개로 관리돼요.)";
    }
    return "";
  })();

  if (loading || !dailyStateLoaded) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="mt-4 text-3xl font-bold">일본어회화</h1>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="mt-4 text-3xl font-bold">일본어회화</h1>
          <p className="mt-4 text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  if (viewMode === "done") {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="mt-4 text-3xl font-bold">회화 훈련 완료</h1>

          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
            <p className="text-lg font-medium">
              최종 점수: {score} / {questions.length}
            </p>
            <p className="mt-2 text-sm text-gray-600">오답 수: {wrongList.length}</p>
            <p className="mt-2 text-sm text-gray-600">오늘 말한 문장: {spokenSentenceCount}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleRestart}
              className="rounded-2xl bg-black px-5 py-3 text-white"
            >
              다시 선택하기
            </button>

            <a
              href="/mypage/wrong-talk"
              className="rounded-2xl border border-gray-300 px-5 py-3 text-gray-800"
            >
              오답노트 보기
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
      <div className="mx-auto w-full max-w-3xl">
        <section className="mt-4">
          <h1 className="text-4xl font-bold">일본어회화</h1>
          <p className="mt-3 text-base text-gray-600">
            1문제씩: 상황 → 상대 발화 → 보기 선택 → 제출 → 정답/설명
          </p>

          <div className="mt-8 space-y-6 rounded-3xl border border-gray-200 bg-white p-6">
            <div>
              <label className="block text-base font-semibold text-gray-700">코스 선택</label>
              <select
                value={selectedStage}
                onChange={(e) => handleStageChange(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3"
              >
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    LV{stage}: 말문 트기
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700">유형 선택</label>
              <select
                value={selectedTag}
                onChange={(e) => handleTagChange(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3"
              >
                {tagOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700">상황 선택</label>
              <select
                value={selectedSub}
                onChange={(e) => setSelectedSub(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3"
              >
                <option value="전체">전체</option>
                {subOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={makeQuizSet}
              className="w-full rounded-2xl bg-black px-6 py-4 text-lg font-semibold text-white"
            >
              시작하기
            </button>
          </div>
        </section>

        <section className="mt-8 relative">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg font-semibold">
                  📈 세트 {questions.length > 0 ? 1 : 0}/1 (문항 {solvedCount}/{totalCount} · 남은 {remainingCount}) · {progressPercent}%
                </p>

                {isReviewing ? (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                    🧠 복습중 · {reviewModeLabel(reviewModeType)}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 h-3 rounded-full bg-gray-100">
                <div
                  className="h-3 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="mt-3 text-sm text-gray-500">
                {isReviewing
                  ? `복습 진행: ${Math.min(
                      solvedCount + (submitted ? 0 : 1),
                      totalCount
                    )}/${totalCount}`
                  : `문항 진행: ${Math.min(currentIndex + 1, totalCount)}/${totalCount}`}
              </p>

              {reviewNotice ? (
                <p className="mt-2 text-sm text-blue-600">{reviewNotice}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={makeQuizSet}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-4 text-lg font-semibold"
              >
                🔄 새 세트
              </button>

              <button
                onClick={() => setReviewPanelOpen((prev) => !prev)}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-4 text-lg font-semibold"
              >
                📚 복습 {reviewPanelOpen ? "⌃" : "⌄"}
              </button>
            </div>
          </div>

          {reviewPanelOpen ? (
            <div className="absolute right-0 z-20 mt-3 w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <button
                  type="button"
                  className="rounded-2xl border border-gray-300 px-4 py-3 text-base font-semibold"
                >
                  🎯 오늘의 복습
                </button>

                <p className="text-sm leading-6 text-gray-500">
                  틀린 것, 오래된 것, 랜덤을 기준으로 복습 세트를 구성할 수 있습니다.
                  현재 선택한 코스/유형/상황 범위 안에서 5문제를 자동 구성합니다.
                </p>
              </div>

              <div className="mt-6">
                <p className="text-base font-semibold text-gray-700">복습 방식</p>

                <div className="mt-3 space-y-3 text-base">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={reviewModeType === "wrong"}
                      onChange={() => setReviewModeType("wrong")}
                    />
                    틀린 것
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={reviewModeType === "random"}
                      onChange={() => setReviewModeType("random")}
                    />
                    랜덤
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={reviewModeType === "old"}
                      onChange={() => setReviewModeType("old")}
                    />
                    오래된 것
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={reviewModeType === "mixed"}
                      onChange={() => setReviewModeType("mixed")}
                    />
                    혼합(오래된+랜덤)
                  </label>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <button
                  onClick={startReviewSet}
                  className="rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold"
                >
                  복습 시작
                </button>

                <button
                  onClick={switchToStudyMode}
                  className="rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold"
                >
                  학습 모드
                </button>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => {
                    setReviewPanelOpen(false);
                    handleOpenWrongTalk();
                  }}
                  className="text-sm text-gray-500 underline underline-offset-4"
                >
                  오답노트 보기
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6">
          <p className="text-base text-gray-500">
            문항 진행: {questions.length > 0 ? currentIndex + 1 : 0}/{questions.length || QUIZ_SET_SIZE}
          </p>

          <div className="mt-6">
            <p className="text-lg font-semibold">
              상황: {currentQuestion?.situation_kr || "세트를 시작하면 상황이 표시됩니다."}
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold">상대(말)</p>
              {currentQuestion?.partner_mp3 ? (
                <button
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  onClick={() =>
                    playAudio(
                      currentQuestion.partner_mp3,
                      `partner-${currentQuestion.qid}`
                    )
                  }
                  disabled={audioLoadingKey === `partner-${currentQuestion?.qid}`}
                >
                  {audioLoadingKey === `partner-${currentQuestion?.qid}`
                    ? "재생 중..."
                    : "🔊"}
                </button>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 p-5">
              <p className="text-lg">{currentQuestion?.partner_jp || "-"}</p>
              <p className="mt-2 text-sm text-gray-500">
                {currentQuestion?.partner_kr || "-"}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 p-5">
            <p className="text-lg font-semibold">내가 할 말(선택)</p>

            <div className="mt-4 space-y-3">
              {currentChoices.map((choice) => {
                const isSelected = selected === choice;
                const isAnswer = currentQuestion?.answer_jp === choice;

                let className =
                  "w-full rounded-2xl border px-4 py-4 text-left text-lg transition ";

                if (!submitted) {
                  className += isSelected
                    ? "border-black bg-gray-100"
                    : "border-gray-300 hover:bg-gray-50";
                } else if (isSelected && isCorrect) {
                  className += "border-green-600 bg-green-50";
                } else if (isSelected && isWrong) {
                  className += "border-red-600 bg-red-50";
                } else if (isAnswer) {
                  className += "border-green-600 bg-green-50";
                } else {
                  className += "border-gray-300 bg-white";
                }

                return (
                  <button
                    key={choice}
                    onClick={() => handleSelect(choice)}
                    className={className}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>

            {!submitted ? (
              <button
                onClick={handleSubmit}
                className="mt-6 w-full rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold"
              >
                정답 제출
              </button>
            ) : null}
          </div>
        </section>

        {submitted ? (
          <section className="mt-8">
            <h2 className="text-3xl font-bold">결과</h2>

            <div
              className={
                isCorrect
                  ? "mt-4 rounded-2xl bg-green-50 p-4"
                  : "mt-4 rounded-2xl bg-red-50 p-4"
              }
            >
              <p
                className={
                  isCorrect
                    ? "text-lg font-semibold text-green-600"
                    : "text-lg font-semibold text-red-600"
                }
              >
                {isCorrect ? "정답 ⭕" : "오답 ✖"}
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-yellow-200 bg-yellow-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">🎯 오늘 미션</p>
                  <p className="mt-2 text-lg font-semibold">{getTodayMissionText()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">🗣️ 오늘 말한 문장</p>
                  <p className="mt-1 text-3xl font-bold">{spokenSentenceCount}</p>
                  <p className="text-sm">문장</p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <TitleImage
                  src={TITLE_PATHS.pronounce}
                  alt="대화/해설"
                  fallback="대화/해설"
                />
              </div>

              <div className="mt-5 rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      상대(말) {currentQuestion?.partner_jp || "-"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {currentQuestion?.partner_kr || "-"}
                    </p>
                  </div>

                  {currentQuestion?.partner_mp3 ? (
                    <button
                      type="button"
                      onClick={() =>
                        playAudio(
                          currentQuestion.partner_mp3,
                          `partner-dialog-${currentQuestion.qid}`
                        )
                      }
                      disabled={
                        audioLoadingKey ===
                        `partner-dialog-${currentQuestion?.qid}`
                      }
                      className="shrink-0 rounded-xl border border-gray-300 px-3 py-2 text-xs"
                    >
                      {audioLoadingKey ===
                      `partner-dialog-${currentQuestion?.qid}`
                        ? "재생 중..."
                        : "🔊"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      내(말) {currentQuestion?.answer_jp || "-"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {currentQuestion?.answer_kr || "-"}
                    </p>
                  </div>

                  {currentQuestion?.answer_mp3 ? (
                    <button
                      type="button"
                      onClick={() =>
                        playAudio(
                          currentQuestion.answer_mp3,
                          `answer-dialog-${currentQuestion.qid}`
                        )
                      }
                      disabled={
                        audioLoadingKey ===
                        `answer-dialog-${currentQuestion?.qid}`
                      }
                      className="shrink-0 rounded-xl border border-gray-300 px-3 py-2 text-xs"
                    >
                      {audioLoadingKey ===
                      `answer-dialog-${currentQuestion?.qid}`
                        ? "재생 중..."
                        : "🔊"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-medium">하테나쌤 원포인트 일본어</p>
                <p className="mt-2">{currentQuestion?.explain_kr || "-"}</p>
              </div>

              <div className="mt-5 rounded-2xl border border-red-300 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setCoachOpen((prev) => !prev)}
                  className="flex w-full items-center gap-2 text-left text-lg font-medium text-gray-800"
                >
                  <span className="text-sm">{coachOpen ? "⌄" : "›"}</span>
                  <span>☺ 원포인트 일본어가 어려우면 하테나쌤에게 물어보세요</span>
                </button>

                {coachOpen ? (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                    <TitleImage
                      src={TITLE_PATHS.coach}
                      alt="하테나쌤 스마트 코치"
                      fallback="하테나쌤 스마트 코치"
                    />

                    {isPro ? (
                      <>
                        {!coachLoading && coachError ? (
                          <p className="mt-3 text-sm text-red-500">{coachError}</p>
                        ) : null}

                        {!coachLoading && !coachError && coachAnswer ? (
                          <div className="mt-3 whitespace-pre-line text-sm text-gray-700">
                            {coachAnswer}
                          </div>
                        ) : null}

                        {coachLoading ? (
                          <p className="mt-3 text-sm text-gray-500">답변 중...</p>
                        ) : null}

                        <div className="mt-4">
                          <textarea
                            value={coachQuestion}
                            onChange={(e) => setCoachQuestion(e.target.value)}
                            placeholder="예) 더 자연스러운 표현도 있어요?"
                            className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-black"
                            rows={3}
                          />
                          <p className="mt-3 text-sm text-gray-500">
                            회화 표현·뉘앙스·자연스러움 위주 질문에 최적화되어 있어요.
                          </p>
                          <button
                            type="button"
                            onClick={handleAskCustomCoach}
                            disabled={coachLoading}
                            className="mt-4 w-full rounded-2xl border border-gray-300 px-4 py-3 text-base font-semibold"
                          >
                            {coachLoading ? "질문 중..." : "AI 코칭 받기 시작"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                        AI 스마트코치는 PRO에서 이용할 수 있습니다.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <EmojiBox src={myEmojiUrl} size="small" />
                  <TitleImage
                    src={TITLE_PATHS.check}
                    alt="발음체크"
                    fallback="발음 체크"
                  />
                </div>
                <p className="text-sm font-semibold text-gray-500">
                  📘 진행: {currentIndex + 1}/{totalCount}
                </p>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() =>
                    currentQuestion?.answer_mp3
                      ? playAudio(
                          currentQuestion.answer_mp3,
                          `answer-pron-${currentQuestion.qid}`
                        )
                      : undefined
                  }
                  disabled={
                    !currentQuestion?.answer_mp3 ||
                    audioLoadingKey === `answer-pron-${currentQuestion?.qid}`
                  }
                  className="w-full rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold disabled:opacity-50"
                >
                  {audioLoadingKey === `answer-pron-${currentQuestion?.qid}`
                    ? "재생 중..."
                    : "🔊 정답 발음 확인"}
                </button>
              </div>

              <div className="mt-6">
                <p className="text-lg font-semibold">
                  🎤 (선택) 내 발음을 녹음하고 들어보세요
                </p>

                <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                  <div className="flex items-center gap-4 text-gray-500">
                    <span className="text-xl">🎙️</span>
                    <span className="text-lg">{pronStage === "recorded" ? "▶️" : "●"}</span>
                    <Waveform active={pronStage !== "idle"} />
                    <span className="text-lg">{pronDuration}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={startPronRecording}
                    disabled={pronStage === "recording"}
                    className="rounded-2xl border border-gray-300 px-4 py-3 text-base font-semibold disabled:opacity-50"
                  >
                    🎙️ 녹음 시작
                  </button>

                  <button
                    type="button"
                    onClick={stopPronRecording}
                    disabled={pronStage !== "recording"}
                    className="rounded-2xl border border-gray-300 px-4 py-3 text-base font-semibold disabled:opacity-50"
                  >
                    ⏹️ 녹음 끝내기
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      recordedAudioUrl
                        ? playAudio(recordedAudioUrl, `recorded-${currentQuestion?.qid}`)
                        : undefined
                    }
                    disabled={!recordedAudioUrl}
                    className="rounded-2xl border border-gray-300 px-4 py-3 text-base font-semibold disabled:opacity-50"
                  >
                    ▶️ 내 녹음 듣기
                  </button>
                </div>
              </div>

              {pronError ? (
                <p className="mt-4 text-sm text-red-500">{pronError}</p>
              ) : null}
            </div>

            <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <EmojiBox src={myEmojiUrl} size="small" />
                <TitleImage
                  src={TITLE_PATHS.score}
                  alt="말하기 점수"
                  fallback="말하기 점수"
                />
              </div>

              {pronChecked ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-base font-semibold text-gray-500">
                      인식 결과(참고)
                    </p>
                    <p className="mt-3 text-2xl">{pronTranscript || "-"}</p>
                  </div>

                  <div>
                    <p className="text-base font-semibold text-gray-700">점수</p>
                    <p className="mt-2 text-5xl font-bold">{pronScore ?? 0}</p>
                  </div>

                  <div className="whitespace-pre-line text-lg font-semibold text-red-500">
                    {pronFeedback}
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-lg text-gray-600">
                    정답을 보고 2~3번 따라 말해 보세요. 녹음을 마친 뒤 직접 점수를 확인할 수 있습니다.
                  </p>
                </div>
              )}

              <p className="mt-4 text-lg text-gray-600">
                정답을 보고 2~3번 따라 말해 보세요. 녹음이 끝나면 점수가 자동으로 계산됩니다.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handlePronCheck}
                  className="rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold"
                >
                  ✅ 다 했어요 (보상 받기)
                </button>

                <button
                  type="button"
                  onClick={handleSkipNext}
                  disabled={saving}
                  className="rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold disabled:opacity-60"
                >
                  ➡️ 다음 문제로 (보상 없이)
                </button>
              </div>

              {rewardMessage ? (
                <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-base font-medium text-yellow-800">
                  {rewardMessage}
                </div>
              ) : null}
            </div>

            {rewardChecked && isCorrect && pronScore === 100 ? (
              <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
                <TitleImage
                  src={TITLE_PATHS.reward}
                  alt="말하기 완료 보상"
                  fallback="말하기 완료 보상"
                />

                <div className="mt-5 rounded-2xl bg-green-50 p-5 text-lg font-semibold text-green-700">
                  +2 XP 🎤 (말하기 완료 보상)
                </div>

                <p className="mt-5 text-base text-gray-600">
                  👇 아래 버튼을 누르면 다음 문제로 넘어갑니다.
                </p>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleRewardComplete}
                    disabled={saving}
                    className="w-full rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold disabled:opacity-60"
                  >
                    {saving ? "저장 중..." : "➡️ 다음 문제 풀기"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {saveDone ? (
          <div className="mt-8">
            <p className="text-sm text-blue-600">결과 저장이 완료되었습니다.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}