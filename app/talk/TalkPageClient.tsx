"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hasSeenHomeToday } from "@/lib/home-gate";
import { supabase } from "@/lib/supabase";
import { isPaidPlan, normalizePlan } from "@/lib/plans";
import {
  clearDailyState,
  loadAppProgress,
  loadDailyState,
  pushRecentTurn,
  saveAppProgress,
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
} from "@/app/types/talk";
import {
  getStageOptions,
  getSubOptions,
  getTagOptions,
  loadTalkRows,
} from "@/lib/talk-loader";
import {
  consumeTalkFeatureUsage,
  fetchTalkFeatureUsage,
} from "@/lib/talk-usage";

const QUIZ_SET_SIZE = 10;
const PRO_UPGRADE_URL =
  "https://hotena.com/m/study_dan_view.asp?dntGbn=&idx=44";
const BASE_SFX_URL = "https://hotena.com/hotena/app/mp3/sfx/";
const DAILY_TALK_LISTEN_LIMIT = 3;
const DAILY_TALK_RECORD_LIMIT = 3;

let activeSfxAudio: HTMLAudioElement | null = null;

type PronStage = "idle" | "recording" | "recorded";

const TITLE_PATHS = {
  pronounce: "/images/hotena_talk/icons_title/icon_pronounce_title.png",
  coach: "/images/hotena_talk/icons_title/icon_coach_title.png",
  check: "/images/hotena_talk/icons_title/icon_check_title.png",
  score: "/images/hotena_talk/icons_title/icon_score_title.png",
  reward: "/images/hotena_talk/icons_title/icon_reward_title.png",
} as const;

const JA_FONT_STYLE = {
  fontFamily:
    '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
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

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function mergeFloat32Arrays(chunks: Float32Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function makeWaveformBars(level = 0.08, count = 32, phase = 0) {
  return Array.from({ length: count }, (_, idx) => {
    const center = (count - 1) / 2;
    const dist = Math.abs(idx - center) / Math.max(center, 1);
    const shape = 1 - dist * 0.9;
    const ripple = 0.76 + 0.24 * Math.sin((idx + phase) * 0.65);
    return Math.max(0.06, Math.min(1, level * shape * ripple + 0.06));
  });
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(
      offset,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    );
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
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

  return (
    <div className="flex items-center gap-3">
      {!failed ? (
        <img
          src={src}
          alt={alt}
          className="h-8 w-auto object-contain sm:h-9"
          onError={() => setFailed(true)}
        />
      ) : null}
      <p className="text-xl font-bold">{fallback}</p>
    </div>
  );
}

function UpgradeHint({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-4">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
      <a
        href={PRO_UPGRADE_URL}
        className="mt-3 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800"
      >
        ✨ 유료 플랜 보기
      </a>
    </div>
  );
}

function playSfx(kind: "correct" | "wrong" | "reward") {
  const pathCandidates = {
    correct: ["correct.mp3"],
    wrong: ["wrong.mp3"],
    reward: ["perfect.mp3"],
  } as const;

  const playFallbackTone = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        ((window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext as typeof AudioContext | undefined);
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const tone = (
        freq: number,
        start: number,
        duration: number,
        volume = 0.05,
        type: OscillatorType = "triangle"
      ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      };

      if (kind === "correct") {
        tone(660, now, 0.09);
        tone(880, now + 0.1, 0.14);
      } else if (kind === "wrong") {
        tone(300, now, 0.1, 0.045, "sawtooth");
        tone(220, now + 0.11, 0.16, 0.045, "sawtooth");
      } else {
        tone(660, now, 0.08);
        tone(880, now + 0.09, 0.08);
        tone(1046, now + 0.18, 0.16, 0.06);
      }

      window.setTimeout(() => {
        void ctx.close().catch(() => undefined);
      }, 650);
    } catch {
      // noop
    }
  };

  try {
    const candidates = pathCandidates[kind].map(
      (path) => `${BASE_SFX_URL}${path}`
    );
    let idx = 0;

    const tryPlay = (url: string) => {
      const audio = new Audio(url);
      activeSfxAudio = audio;
      audio.preload = "auto";
      audio.volume = 1;
      (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      audio.onended = () => {
        if (activeSfxAudio === audio) activeSfxAudio = null;
      };
      audio.onerror = () => {
        idx += 1;
        if (idx < candidates.length) {
          tryPlay(candidates[idx]);
        } else {
          playFallbackTone();
        }
      };
      const playPromise = audio.play();
      if (playPromise) {
        void playPromise.catch(() => {
          idx += 1;
          if (idx < candidates.length) {
            tryPlay(candidates[idx]);
          } else {
            playFallbackTone();
          }
        });
      }
    };

    tryPlay(candidates[0]);
  } catch {
    playFallbackTone();
  }
}

function makeCompletedSubKey(stage: string, tag: string, sub: string) {
  return `${stage}|||${tag}|||${sub}`;
}

function clearTalkLocalStateForToday() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(`talk-spoken-count:${todayKST()}`);
  } catch {
    // noop
  }
}

function getRecommendedRecordSeconds(answerYomi?: string, answerJp?: string) {
  const base = String(answerYomi || answerJp || "").trim();
  const len = Array.from(base).length;

  if (len <= 8) return 3;
  if (len <= 14) return 4;
  if (len <= 20) return 5;
  if (len <= 28) return 6;
  return 7;
}

export default function TalkPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
  const [coachOpen, setCoachOpen] = useState(false);

  const [userPlan, setUserPlan] = useState("free");
  const [listenUsed, setListenUsed] = useState(0);
  const [recordUsed, setRecordUsed] = useState(0);
  const [quotaMessage, setQuotaMessage] = useState("");
  const [planInfoOpen, setPlanInfoOpen] = useState(false);

  const [audioLoadingKey, setAudioLoadingKey] = useState("");
  const [audioError, setAudioError] = useState("");

  const [selectedStage, setSelectedStage] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSub, setSelectedSub] = useState("전체");

  const [dailyStateLoaded, setDailyStateLoaded] = useState(false);
  const [finishMessage, setFinishMessage] = useState("");
  const [completedSubsMap, setCompletedSubsMap] = useState<
    Record<string, boolean>
  >({});

  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completionTitle, setCompletionTitle] = useState("");
  const [completionBody, setCompletionBody] = useState("");
  const [completionNextSubValue, setCompletionNextSubValue] = useState<
    string | null
  >(null);

  const [pronStage, setPronStage] = useState<PronStage>("idle");
  const [pronChecked, setPronChecked] = useState(false);
  const [pronScore, setPronScore] = useState<number | null>(null);
  const [pronFeedback, setPronFeedback] = useState<{
    verdict?: string;
    suggestion?: string;
  } | null>(null);
  const [pronTranscript, setPronTranscript] = useState("");
  const [pronDuration, setPronDuration] = useState("00:00");
  const [spokenSentenceCount, setSpokenSentenceCount] = useState(0);
  const [pronError, setPronError] = useState("");
  const [pronScoring, setPronScoring] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [isRecordedPlaying, setIsRecordedPlaying] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [rewardNoticeRequested, setRewardNoticeRequested] = useState(false);
  const [waveformBars, setWaveformBars] = useState<number[]>(
    makeWaveformBars(0.06)
  );
  const [recordCountdown, setRecordCountdown] = useState(0);
  const [recordMaxSeconds, setRecordMaxSeconds] = useState(0);

  const restoringRef = useRef(false);
  const resumedOnceRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordContextRef = useRef<AudioContext | null>(null);
  const recordSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const recordAnalyserRef = useRef<AnalyserNode | null>(null);
  const recordSilenceGainRef = useRef<GainNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartAtRef = useRef<number>(0);
  const recordSampleRateRef = useRef<number>(44100);
  const waveLevelRef = useRef<number>(0.06);
  const waveformPhaseRef = useRef<number>(0);
  const waveformAnimRef = useRef<number | null>(null);
  const recordAutoStopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        `talk-spoken-count:${todayKST()}`
      );
      if (stored) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed >= 0) {
          setSpokenSentenceCount(parsed);
        }
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `talk-spoken-count:${todayKST()}`,
        String(spokenSentenceCount)
      );
    } catch {
      // noop
    }
  }, [spokenSentenceCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasSeenHomeToday()) {
      const fullNext = `${pathname || "/talk"}${window.location.search || ""}`;
      router.replace(`/?next=${encodeURIComponent(fullNext)}`);
    }
  }, [router, pathname]);

  const resetPronunciationState = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setPronStage("idle");
    setPronChecked(false);
    setPronScore(null);
    setPronFeedback(null);
    setPronTranscript("");
    setPronDuration("00:00");
    setPronError("");
    setPronScoring(false);
    setRecordedAudioUrl("");
    setRecordingSeconds(0);
    setRewardNoticeRequested(false);
    setWaveformBars(makeWaveformBars(0.06));
    setRecordCountdown(0);
    setRecordMaxSeconds(0);
  };

  const stopRecordingInternal = async () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordAutoStopTimerRef.current) {
      window.clearTimeout(recordAutoStopTimerRef.current);
      recordAutoStopTimerRef.current = null;
    }
    if (waveformAnimRef.current) {
      window.cancelAnimationFrame(waveformAnimRef.current);
      waveformAnimRef.current = null;
    }

    try {
      recordProcessorRef.current?.disconnect();
      recordSourceRef.current?.disconnect();
      recordAnalyserRef.current?.disconnect();
      recordSilenceGainRef.current?.disconnect();
    } catch (error) {
      console.error(error);
    }

    try {
      recordStreamRef.current?.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.error(error);
    }

    if (recordContextRef.current) {
      try {
        await recordContextRef.current.close();
      } catch (error) {
        console.error(error);
      }
    }

    recordProcessorRef.current = null;
    recordSourceRef.current = null;
    recordAnalyserRef.current = null;
    recordSilenceGainRef.current = null;
    recordContextRef.current = null;
    recordStreamRef.current = null;
    setRecordCountdown(0);
  };

  const startPronRecording = async () => {
    try {
      if (typeof window === "undefined") return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setPronError("이 브라우저에서는 녹음 기능을 지원하지 않습니다.");
        return;
      }

      if (!isPaidPlan(userPlan)) {
        const usage = await consumeTalkFeatureUsage(
          "talk_record",
          DAILY_TALK_RECORD_LIMIT
        );
        if (usage.ok) {
          setRecordUsed(Number(usage.used || 0));
          setQuotaMessage("");
        } else {
          setRecordUsed(Number(usage.used || DAILY_TALK_RECORD_LIMIT));
          setQuotaMessage(
            "오늘 무료 녹음 3/3회를 모두 사용했습니다. 내일 다시 이용할 수 있고, 유료 플랜에서는 제한 없이 이용할 수 있습니다."
          );
          setPronError(
            "오늘 무료 녹음 3/3회를 모두 사용했습니다. 내일 다시 이용할 수 있고, 유료 플랜에서는 제한 없이 이용할 수 있습니다."
          );
          return;
        }
      }

      await stopRecordingInternal();
      setPronError("");
      setRewardNoticeRequested(false);
      setPronChecked(false);
      setPronScore(null);
      setPronFeedback(null);
      setPronTranscript("");
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl("");
      }
      setWaveformBars(makeWaveformBars(0.08));
      waveLevelRef.current = 0.08;
      waveformPhaseRef.current = 0;
      pcmChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      recordStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        ((window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext as typeof AudioContext | undefined);

      if (!AudioCtx) {
        setPronError(
          "이 브라우저에서는 오디오 컨텍스트를 사용할 수 없습니다."
        );
        await stopRecordingInternal();
        return;
      }

      const audioContext = new AudioCtx();
      recordContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      recordSampleRateRef.current = audioContext.sampleRate || 44100;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.82;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silenceGain = audioContext.createGain();
      silenceGain.gain.value = 0;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(silenceGain);
      silenceGain.connect(audioContext.destination);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(input));
        let sumSq = 0;
        for (let i = 0; i < input.length; i += 1) {
          const sample = input[i] ?? 0;
          sumSq += sample * sample;
        }
        const rms = Math.sqrt(sumSq / Math.max(input.length, 1));
        waveLevelRef.current = Math.max(
          waveLevelRef.current * 0.72,
          Math.min(1, rms * 10)
        );
      };

      recordSourceRef.current = source;
      recordAnalyserRef.current = analyser;
      recordProcessorRef.current = processor;
      recordSilenceGainRef.current = silenceGain;

      const maxSeconds = getRecommendedRecordSeconds(
        currentQuestion?.answer_yomi,
        currentQuestion?.answer_jp
      );

      setPronStage("recording");
      recordStartAtRef.current = Date.now();
      setRecordingSeconds(0);
      setPronDuration("00:00");
      setRecordMaxSeconds(maxSeconds);
      setRecordCountdown(maxSeconds);

      recordTimerRef.current = window.setInterval(() => {
        const elapsedSec = Math.max(
          0,
          Math.floor((Date.now() - recordStartAtRef.current) / 1000)
        );
        const remain = Math.max(maxSeconds - elapsedSec, 0);

        setRecordingSeconds(elapsedSec);
        setPronDuration(formatSeconds(elapsedSec));
        setRecordCountdown(remain);
      }, 200);

      recordAutoStopTimerRef.current = window.setTimeout(() => {
        void stopPronRecording();
      }, maxSeconds * 1000);

      const animateWaveform = () => {
        waveformPhaseRef.current += 1;
        const analyserNode = recordAnalyserRef.current;
        let liveLevel = waveLevelRef.current;
        if (analyserNode) {
          const data = new Uint8Array(analyserNode.fftSize);
          analyserNode.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i += 1) {
            const normalized = Math.abs((data[i] - 128) / 128);
            if (normalized > peak) peak = normalized;
          }
          liveLevel = Math.max(liveLevel, peak * 2.4);
        }
        const visualLevel = Math.max(
          0.14,
          liveLevel,
          0.14 + Math.abs(Math.sin(waveformPhaseRef.current * 0.22)) * 0.08
        );
        setWaveformBars(
          makeWaveformBars(visualLevel, 32, waveformPhaseRef.current)
        );
        waveLevelRef.current *= 0.92;
        waveformAnimRef.current = window.requestAnimationFrame(animateWaveform);
      };
      waveformAnimRef.current = window.requestAnimationFrame(animateWaveform);
    } catch (error) {
      console.error(error);
      const err = error as DOMException | Error | undefined;
      const errName = err?.name || "";
      let message = "녹음을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";

      if (errName === "NotAllowedError" || errName === "SecurityError") {
        message =
          "마이크 권한이 거부되었습니다. 브라우저에서 마이크 권한을 허용해 주세요.";
      } else if (
        errName === "NotFoundError" ||
        errName === "DevicesNotFoundError"
      ) {
        message = "사용할 수 있는 마이크를 찾지 못했습니다.";
      } else if (
        errName === "NotReadableError" ||
        errName === "TrackStartError"
      ) {
        message =
          "다른 앱이 마이크를 사용 중일 수 있습니다. 마이크 사용 중인 앱을 닫고 다시 시도해 주세요.";
      } else if (errName === "AbortError") {
        message = "녹음 시작이 중단되었습니다. 다시 시도해 주세요.";
      } else if (errName === "TypeError") {
        message = "이 브라우저에서는 현재 녹음 설정을 시작할 수 없습니다.";
      }

      setPronError(message);
      await stopRecordingInternal();
      setPronStage("idle");
    }
  };

  const scorePronunciation = async (
    audioBlob: Blob,
    answerJp: string,
    answerYomi: string,
    durationMs: number
  ) => {
    try {
      setPronScoring(true);
      setPronChecked(false);
      setPronScore(null);
      setPronFeedback(null);
      setPronTranscript("");
      setPronError("");

      const form = new FormData();
      form.append("file", audioBlob, "speech.wav");
      form.append("answer_jp", answerJp);
      form.append("answer_yomi", answerYomi);
      form.append("duration_ms", String(durationMs));

      const res = await fetch("/api/talk-pron-score", {
        method: "POST",
        body: form,
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(
          String(data?.error || raw || "말하기 점수를 계산하지 못했습니다.")
        );
      }

      const transcript = String(data?.transcript || "").trim();
      const score = Number(data?.score ?? 0);
      const feedback = data?.feedback ?? null;

      setPronChecked(true);
      setPronScore(Number.isFinite(score) ? score : 0);
      setPronTranscript(transcript || "-");
      setPronFeedback(feedback);
      setPronError("");

      if (Number.isFinite(score) && score >= 100) {
        playSfx("correct");
      }
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "말하기 점수를 계산하지 못했습니다.";
      setPronChecked(false);
      setPronScore(null);
      setPronTranscript("");
      setPronFeedback(null);
      setPronError(message || "말하기 점수를 계산하지 못했습니다.");
    } finally {
      setPronScoring(false);
    }
  };

  const stopPronRecording = async () => {
    if (pronStage !== "recording") return;

    try {
      const elapsedSec = Math.max(
        1,
        Math.floor((Date.now() - recordStartAtRef.current) / 1000)
      );
      const elapsedMs = Math.max(1, Date.now() - recordStartAtRef.current);
      setRecordingSeconds(elapsedSec);
      setPronDuration(formatSeconds(elapsedSec));
      await stopRecordingInternal();

      const merged = mergeFloat32Arrays(pcmChunksRef.current);
      if (!merged.length) {
        setPronStage("idle");
        setPronError("녹음 데이터가 저장되지 않았습니다. 다시 시도해 주세요.");
        setWaveformBars(makeWaveformBars(0.06));
        return;
      }

      const wavBlob = encodeWav(
        merged,
        recordSampleRateRef.current || 44100
      );
      if (!wavBlob.size) {
        setPronStage("idle");
        setPronError("녹음 파일을 만들지 못했습니다. 다시 시도해 주세요.");
        setWaveformBars(makeWaveformBars(0.06));
        return;
      }

      const nextUrl = URL.createObjectURL(wavBlob);
      setRecordedAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setPronStage("recorded");
      setPronError("");
      setWaveformBars(makeWaveformBars(0.58, 32, 2));
      setSpokenSentenceCount((prev) => prev + 1);

      if (currentQuestion?.answer_jp) {
        await scorePronunciation(
          wavBlob,
          currentQuestion.answer_jp,
          currentQuestion.answer_yomi,
          elapsedMs
        );
      }
    } catch (error) {
      console.error(error);
      setPronStage("idle");
      setPronError("녹음을 저장하지 못했습니다. 다시 시도해 주세요.");
      setWaveformBars(makeWaveformBars(0.06));
    }
  };

  const playRecordedPronunciation = async () => {
    if (!recordedAudioUrl) {
      setPronError("먼저 녹음을 완료해 주세요.");
      return;
    }

    try {
      setPronError("");
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(recordedAudioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsRecordedPlaying(false);
      audio.onpause = () => setIsRecordedPlaying(false);
      setIsRecordedPlaying(true);
      await audio.play();
    } catch (error) {
      console.error(error);
      setIsRecordedPlaying(false);
      setPronError(
        "내 녹음 재생을 지원하지 않는 브라우저입니다. Chrome 또는 Edge에서 다시 시도해 주세요."
      );
    }
  };

  useEffect(() => {
    return () => {
      void stopRecordingInternal();
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

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

          setUserPlan(normalizePlan(profileRow?.plan));
        }

        const cleaned = await loadTalkRows();
        setAllRows(cleaned);

        const talkProgress = await loadAppProgress("talk");
        const completedMap =
          talkProgress?.completed_subs &&
            typeof talkProgress.completed_subs === "object" &&
            !Array.isArray(talkProgress.completed_subs)
            ? (talkProgress.completed_subs as Record<string, boolean>)
            : {};
        setCompletedSubsMap(completedMap);

        const hasTalkProgress =
          talkProgress &&
          typeof talkProgress === "object" &&
          Object.keys(talkProgress).length > 0;

        if (!hasTalkProgress) {
          clearTalkLocalStateForToday();
          setSpokenSentenceCount(0);
        }

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
    const loadTalkQuota = async () => {
      try {
        if (isPaidPlan(userPlan)) {
          setListenUsed(0);
          setRecordUsed(0);
          setQuotaMessage("");
          return;
        }

        const [listenStatus, recordStatus] = await Promise.all([
          fetchTalkFeatureUsage("talk_listen", DAILY_TALK_LISTEN_LIMIT),
          fetchTalkFeatureUsage("talk_record", DAILY_TALK_RECORD_LIMIT),
        ]);

        if (listenStatus.ok) {
          setListenUsed(Number(listenStatus.used || 0));
        }
        if (recordStatus.ok) {
          setRecordUsed(Number(recordStatus.used || 0));
        }
      } catch (error) {
        console.error(error);
      }
    };

    void loadTalkQuota();
  }, [userPlan]);

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

  const reviewMode = searchParams.get("review") === "1";

  const reviewQids = useMemo(() => {
    return new Set(
      (searchParams.get("qids") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    );
  }, [searchParams]);

  const reviewItemKeys = useMemo(() => {
    return new Set(
      (searchParams.get("itemKeys") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    );
  }, [searchParams]);

  const hasReviewTargets = reviewQids.size > 0 || reviewItemKeys.size > 0;

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (loading || allRows.length === 0 || !dailyStateLoaded) return;
    if (!reviewMode || !hasReviewTargets) return;

    const picked = allRows.filter((row) => {
      const rowQid = String(row.qid || "").trim();
      const rowItemKey = String((row as any).item_key || "").trim();

      return reviewQids.has(rowQid) || reviewItemKeys.has(rowItemKey);
    });

    if (picked.length === 0) {
      setErrorMsg("복습할 문제를 찾지 못했습니다.");
      return;
    }

    setQuestions(picked);
    setCurrentIndex(0);
    setSelected("");
    setSubmitted(false);
    setScore(0);
    setWrongList([]);
    setSaveDone(false);
    setCoachOpen(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    resetPronunciationState();
    setFinishMessage("");
    setViewMode("quiz");
  }, [
    loading,
    allRows,
    dailyStateLoaded,
    reviewMode,
    hasReviewTargets,
    reviewQids,
    reviewItemKeys,
  ]);

  useEffect(() => {
    setCoachOpen(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
  }, [currentQuestion?.qid]);

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
    };
  }, []);

  const isCorrect = submitted && selected === currentQuestion?.answer_jp;
  const isPro = isPaidPlan(userPlan);
  const listenLimitReached = !isPro && listenUsed >= DAILY_TALK_LISTEN_LIMIT;
  const recordLimitReached = !isPro && recordUsed >= DAILY_TALK_RECORD_LIMIT;
  const quotaLimitReached = listenLimitReached || recordLimitReached;
  const remainingListen = Math.max(DAILY_TALK_LISTEN_LIMIT - listenUsed, 0);
  const remainingRecord = Math.max(DAILY_TALK_RECORD_LIMIT - recordUsed, 0);
  const isPronPerfect = pronChecked && (pronScore ?? 0) >= 100;
  const showRewardCard = isPronPerfect && isCorrect;
  const showPronOnlyNotice =
    rewardNoticeRequested && isPronPerfect && !isCorrect;
  const showNeedPerfectNotice =
    rewardNoticeRequested && pronChecked && !isPronPerfect;

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

  const getSubOptionLabelWithDone = (item: SubOption) => {
    const completedKey = makeCompletedSubKey(
      selectedStage,
      selectedTag,
      item.value
    );
    return completedSubsMap[completedKey] ? `[완] ${item.label}` : item.label;
  };

  const getNextSubValue = () => {
    if (selectedSub === "전체") return null;

    const currentSubIndex = subOptions.findIndex(
      (item) => item.value === selectedSub
    );
    if (currentSubIndex < 0) return null;

    const next = subOptions[currentSubIndex + 1];
    return next?.value || null;
  };

  const getTodayMissionText = () => {
    if (spokenSentenceCount >= 7) {
      return "좋아요. 오늘은 이미 충분히 말했어요. 정답 문장을 3번만 더 또렷하게 따라가 봅시다.";
    }
    if (isCorrect) {
      return "좋아요. 오늘은 정답 문장을 자신 있게 한 번 더 입 밖으로 꺼내봅시다.";
    }
    return "오늘은 입을 7번만 열어봅시다.";
  };

  const closeCompletionModal = () => {
    setCompletionModalOpen(false);
  };

  const handleStartNextSub = () => {
    if (!completionNextSubValue) {
      setCompletionModalOpen(false);
      return;
    }

    setSelectedSub(completionNextSubValue);
    setCompletionModalOpen(false);
    setFinishMessage("");
  };

  const handleBackToSelectFromCompletion = () => {
    setCompletionModalOpen(false);
    setFinishMessage("");
  };

  const markCompletedSub = async (
    stage: string,
    tag: string,
    sub: string
  ) => {
    if (!stage || !tag || !sub || sub === "전체") return;

    const key = makeCompletedSubKey(stage, tag, sub);

    setCompletedSubsMap((prev) => ({
      ...prev,
      [key]: true,
    }));

    try {
      const appProgress = await loadAppProgress("talk");
      const prevMap =
        appProgress?.completed_subs &&
          typeof appProgress.completed_subs === "object" &&
          !Array.isArray(appProgress.completed_subs)
          ? (appProgress.completed_subs as Record<string, boolean>)
          : {};

      await saveAppProgress("talk", {
        ...appProgress,
        completed_subs: {
          ...prevMap,
          [key]: true,
        },
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const tryResumeDailyState = async () => {
      if (loading || allRows.length === 0 || resumedOnceRef.current) return;

      if (reviewMode && hasReviewTargets) {
        setDailyStateLoaded(true);
        return;
      }
      resumedOnceRef.current = true;

      try {
        const ds = await loadDailyState("talk");
        if (!ds) {
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
        setCurrentIndex(
          Math.min(Math.max(ds.idx || 0, 0), restored.length - 1)
        );
        setSelected("");
        setSubmitted(false);
        setScore(0);
        setWrongList([]);
        setSaveDone(false);
        setFinishMessage("");
        setCoachOpen(false);
        setCoachAnswer("");
        setCoachError("");
        setCoachLoading(false);
        setCoachQuestion("");
        setAudioError("");
        setAudioLoadingKey("");
        resetPronunciationState();
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
  }, [loading, allRows, reviewMode, hasReviewTargets]);

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

      if (!isPaidPlan(userPlan)) {
        const usage = await consumeTalkFeatureUsage(
          "talk_listen",
          DAILY_TALK_LISTEN_LIMIT
        );
        if (usage.ok) {
          setListenUsed(Number(usage.used || 0));
          setQuotaMessage("");
        } else {
          setListenUsed(Number(usage.used || DAILY_TALK_LISTEN_LIMIT));
          setQuotaMessage(
            "오늘 무료 발음듣기 3/3회를 모두 사용했습니다. 내일 다시 이용할 수 있고, 유료 플랜에서는 제한 없이 이용할 수 있습니다."
          );
          setAudioLoadingKey("");
          return;
        }
      }

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

  const handleAskCustomCoach = async () => {
    if (!currentQuestion) return;
    if (!isPro) {
      setCoachError("AI 스마트코치는 유료 플랜에서 이용할 수 있습니다.");
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
    setFinishMessage("");
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    setSelectedSub("전체");
    setFinishMessage("");
  };

  const makeQuizSet = async () => {
    setFinishMessage("");

    let pool = allRows.filter(
      (row) => row.stage === selectedStage && row.tag === selectedTag
    );

    if (reviewMode && hasReviewTargets) {
      const picked = allRows.filter((row) => {
        const rowQid = String(row.qid || "").trim();
        const rowItemKey = String((row as any).item_key || "").trim();
        return reviewQids.has(rowQid) || reviewItemKeys.has(rowItemKey);
      });

      if (picked.length === 0) {
        alert("복습할 문제를 찾지 못했습니다.");
        return;
      }

      setQuestions(picked);
      setCurrentIndex(0);
      setSelected("");
      setSubmitted(false);
      setScore(0);
      setWrongList([]);
      setSaveDone(false);
      setCoachOpen(false);
      setCoachAnswer("");
      setCoachError("");
      setCoachLoading(false);
      setCoachQuestion("");
      setAudioError("");
      setAudioLoadingKey("");
      resetPronunciationState();
      setViewMode("quiz");
      return;
    }

    if (selectedSub !== "전체") {
      pool = pool.filter((row) => row.sub === selectedSub);
    }

    if (pool.length === 0) {
      alert("선택한 조건에 맞는 문제가 없습니다.");
      return;
    }

    const picked: TalkCsvRow[] = pool.slice(
      0,
      Math.min(QUIZ_SET_SIZE, pool.length)
    );

    setQuestions(picked);
    setCurrentIndex(0);
    setSelected("");
    setSubmitted(false);
    setScore(0);
    setWrongList([]);
    setSaveDone(false);
    setCoachOpen(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    resetPronunciationState();
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
          app: "talk",
          qtype: "choice",
          item_key: String((currentQuestion as any).item_key || currentQuestion.qid || ""),
          qid: currentQuestion.qid,
          selected,
          correct: currentQuestion.answer_jp,

          stage: currentQuestion.stage,
          tag: currentQuestion.tag,
          tag_kr: currentQuestion.tag_kr,
          sub: currentQuestion.sub,
          sub_kr: currentQuestion.sub_kr,

          situation_kr: currentQuestion.situation_kr,
          partner_jp: currentQuestion.partner_jp,
          partner_kr: currentQuestion.partner_kr,
          answer_jp: currentQuestion.answer_jp,
          answer_kr: currentQuestion.answer_kr,
          explain_kr: currentQuestion.explain_kr,
        },
      ]);
    }

    setCoachOpen(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    resetPronunciationState();
    setSubmitted(true);
    playSfx(ok ? "correct" : "wrong");

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

      const displaySub = reviewMode
        ? "오답 복습"
        : selectedSub === "전체"
          ? "전체"
          : getSubLabel(selectedSub);

      const payload = buildTalkAttemptPayload({
        user_id: user.id,
        user_email: user.email ?? "",
        level: currentQuestion?.level || "N3",
        pos_mode: reviewMode
          ? "회화 · 오답 복습"
          : `회화 · ${getTagLabel(selectedTag)} · ${displaySub}`,
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

      if (selectedSub !== "전체") {
        await markCompletedSub(selectedStage, selectedTag, selectedSub);
      }

      setSaveDone(true);

      const completedLabel =
        selectedSub === "전체" ? "현재 세트" : getSubLabel(selectedSub);

      const nextSubValue = getNextSubValue();

      setQuestions([]);
      setCurrentIndex(0);
      setCurrentChoices([]);
      setSelected("");
      setSubmitted(false);
      setScore(0);
      setWrongList([]);
      setCoachOpen(false);
      setCoachAnswer("");
      setCoachError("");
      setCoachLoading(false);
      setCoachQuestion("");
      setAudioError("");
      setAudioLoadingKey("");
      resetPronunciationState();
      setViewMode("select");
      setFinishMessage("");

      playSfx("reward");

      if (nextSubValue) {
        const nextLabel = getSubLabel(nextSubValue);
        setSelectedSub(nextSubValue);

        setCompletionTitle(`🎉 [완] ${completedLabel} 완료`);
        setCompletionBody(
          `좋아요. 다음 상황 문제 "${nextLabel}"를 이어서 풀어볼까요?`
        );
        setCompletionNextSubValue(nextSubValue);
        setCompletionModalOpen(true);
      } else {
        setCompletionTitle(`🏆 [완] ${completedLabel} 완료`);
        setCompletionBody("현재 유형의 상황 문제를 모두 풀었습니다.");
        setCompletionNextSubValue(null);
        setCompletionModalOpen(true);
      }
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
      setCoachOpen(false);
      setCoachAnswer("");
      setCoachError("");
      setCoachLoading(false);
      setCoachQuestion("");
      setAudioError("");
      setAudioLoadingKey("");
      resetPronunciationState();

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
    setRewardNoticeRequested(true);
    if (saving) return;
    if (pronScoring) {
      setPronError("점수 계산 중입니다. 잠시만 기다려 주세요.");
      return;
    }
    if (!pronChecked) {
      setPronError("먼저 녹음을 완료해 주세요.");
      return;
    }
    if (!showRewardCard) {
      if (showPronOnlyNotice) {
        setPronError(
          "발음은 100점이지만, 문제 선택이 오답이라 보상은 지급되지 않습니다. (정답/발음은 별개로 관리돼요.)"
        );
      } else if (showNeedPerfectNotice) {
        setPronError(
          "보상은 '녹음 + 100점'일 때만 받을 수 있어요. 지금 바로 녹음하고 100점을 만들어 보세요."
        );
      }
      return;
    }

    setPronError("");
    playSfx("reward");
    await handleNext();
  };

  const handleSkipNext = async () => {
    await handleNext();
  };

  const handleRestart = async () => {
    await clearDailyState("talk");

    restoringRef.current = false;
    resumedOnceRef.current = false;

    setViewMode("select");
    setQuestions([]);
    setCurrentIndex(0);
    setCurrentChoices([]);
    setSelected("");
    setSubmitted(false);
    setScore(0);
    setWrongList([]);
    setSaveDone(false);
    setCoachOpen(false);
    setCoachAnswer("");
    setCoachError("");
    setCoachLoading(false);
    setCoachQuestion("");
    setAudioError("");
    setAudioLoadingKey("");
    setFinishMessage("");
    setCompletionModalOpen(false);
    setCompletionTitle("");
    setCompletionBody("");
    setCompletionNextSubValue(null);
    resetPronunciationState();
    setDailyStateLoaded(false);
    setSpokenSentenceCount(0);
    clearTalkLocalStateForToday();
  };

  if (loading || !dailyStateLoaded) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="mt-4 text-3xl font-bold">🗣️ 일본어회화</h1>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="mt-4 text-3xl font-bold">🗣️ 일본어회화</h1>
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
            <p className="mt-2 text-sm text-gray-600">
              오답 수: {wrongList.length}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              오늘 말한 문장: {spokenSentenceCount}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleRestart}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              다시 선택하기
            </button>

            <a
              href="/mypage/wrong-talk"
              className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800"
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
          <h1 className="text-3xl font-bold">🗣️ 일본어회화</h1>
          <p className="mt-3 text-base text-gray-600">
            1문제씩: 상황 → 상대 발화 → 보기 선택 → 제출 → 정답/설명
          </p>

          <div
            className={
              quotaLimitReached
                ? "mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4"
                : "mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"
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
                    quotaLimitReached
                      ? "text-sm font-semibold text-red-700"
                      : "text-sm font-semibold text-gray-800"
                  }
                >
                  {isPro
                    ? `유료 · 발음듣기·녹음 무제한`
                    : `무료 · 발음듣기 ${listenUsed}/${DAILY_TALK_LISTEN_LIMIT} · 녹음 ${recordUsed}/${DAILY_TALK_RECORD_LIMIT}`}
                </p>
                <p
                  className={
                    quotaLimitReached
                      ? "mt-1 text-xs text-red-600"
                      : "mt-1 text-xs text-gray-500"
                  }
                >
                  {isPro
                    ? "자세한 이용 안내 보기"
                    : quotaLimitReached
                      ? "오늘 이용 한도 도달"
                      : `발음 ${remainingListen}회 · 녹음 ${remainingRecord}회 남음`}
                </p>
              </div>
              <span
                className={
                  quotaLimitReached
                    ? "shrink-0 text-base text-red-500"
                    : "shrink-0 text-base text-gray-500"
                }
              >
                {planInfoOpen ? "⌄" : "›"}
              </span>
            </button>

            {planInfoOpen ? (
              <div
                className={
                  quotaLimitReached
                    ? "mt-3 border-t border-red-200 pt-3 text-sm leading-6 text-red-700"
                    : "mt-3 border-t border-gray-200 pt-3 text-sm leading-6 text-gray-600"
                }
              >
                <p>
                  {isPro
                    ? "유료 플랜은 발음듣기와 녹음을 제한 없이 이용할 수 있고, AI 스마트코치도 사용할 수 있습니다."
                    : quotaMessage ||
                    "무료 플랜은 하루 발음듣기 3회, 녹음 3회까지 이용할 수 있습니다. AI 스마트코치는 유료 플랜에서 이용할 수 있습니다."}
                </p>
              </div>
            ) : null}

            {!isPro && quotaLimitReached ? (
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

          <div className="mt-6 space-y-4 rounded-3xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/70 p-6 shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <label className="block text-sm font-semibold tracking-[-0.01em] text-gray-700">
                코스 선택
              </label>
              <div className="relative mt-2">
                <select
                  value={selectedStage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-11 text-base font-medium text-gray-900 shadow-sm outline-none transition focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                >
                  {stageOptions.map((stage) => (
                    <option key={stage} value={stage}>
                      LV{stage}: 말문 트기
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <label className="block text-sm font-semibold tracking-[-0.01em] text-gray-700">
                유형 선택
              </label>
              <div className="relative mt-2">
                <select
                  value={selectedTag}
                  onChange={(e) => handleTagChange(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-11 text-base font-medium text-gray-900 shadow-sm outline-none transition focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                >
                  {tagOptions.map((item, index) => (
                    <option key={item.value} value={item.value}>
                      {index + 1}. {item.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <label className="block text-sm font-semibold tracking-[-0.01em] text-gray-700">
                상황 선택
              </label>
              <div className="relative mt-2">
                <select
                  value={selectedSub}
                  onChange={(e) => {
                    setSelectedSub(e.target.value);
                    setFinishMessage("");
                  }}
                  className="w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-11 text-base font-medium text-gray-900 shadow-sm outline-none transition focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                >
                  <option value="전체">전체</option>
                  {subOptions.map((item, index) => (
                    <option key={item.value} value={item.value}>
                      {index + 1}. {getSubOptionLabelWithDone(item)}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={makeQuizSet}
              className="w-full rounded-[22px] bg-black px-6 py-4 text-lg font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px]"
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
                  📈 세트 {questions.length > 0 ? 1 : 0}/1 (문항 {solvedCount}/
                  {totalCount} · 남은 {remainingCount}) · {progressPercent}%
                </p>
              </div>

              <div className="mt-4 h-3 rounded-full bg-gray-100">
                <div
                  className="h-3 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="mt-3 text-sm text-gray-500">
                문항 진행: {Math.min(currentIndex + 1, totalCount)}/{totalCount}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={makeQuizSet}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-4 text-base font-semibold"
              >
                🔄 새 세트
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-base text-gray-500">
            문항 진행: {questions.length > 0 ? currentIndex + 1 : 0}/
            {questions.length || QUIZ_SET_SIZE}
          </p>

          <div className="mt-6">
            <p className="text-lg font-semibold">
              상황:{" "}
              {currentQuestion?.situation_kr ||
                "세트를 시작하면 상황이 표시됩니다."}
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold">상대(말)</p>
              {currentQuestion?.partner_mp3 && !isPro ? (
                <button
                  className="shrink-0 p-1 text-xl leading-none"
                  onClick={() =>
                    playAudio(
                      currentQuestion.partner_mp3,
                      `partner-${currentQuestion.qid}`
                    )
                  }
                  disabled={
                    listenLimitReached ||
                    audioLoadingKey === `partner-${currentQuestion?.qid}`
                  }
                >
                  {audioLoadingKey === `partner-${currentQuestion?.qid}`
                    ? "재생 중..."
                    : "🔊"}
                </button>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 min-h-[92px]">
              {!isPro ? (
                <p lang="ja" style={JA_FONT_STYLE} className="text-lg">
                  {currentQuestion?.partner_jp || "-"}
                </p>
              ) : currentQuestion?.partner_mp3 ? (
                <div className="flex min-h-[52px] items-center justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      playAudio(
                        currentQuestion.partner_mp3,
                        `partner-${currentQuestion.qid}`
                      )
                    }
                    disabled={
                      listenLimitReached ||
                      audioLoadingKey === `partner-${currentQuestion?.qid}`
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-5 py-3 text-base font-semibold text-gray-700 shadow-sm disabled:opacity-60"
                  >
                    <span className="text-lg leading-none">🔊</span>
                    <span>
                      {audioLoadingKey === `partner-${currentQuestion?.qid}`
                        ? "재생 중..."
                        : "먼저 듣기"}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
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
                } else if (isSelected && !isCorrect) {
                  className += "border-red-600 bg-red-50";
                } else if (isAnswer) {
                  className += "border-green-600 bg-green-50";
                } else {
                  className += "border-gray-300 bg-white";
                }

                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => handleSelect(choice)}
                    className={className}
                  >
                    <span lang="ja" style={JA_FONT_STYLE}>
                      {choice}
                    </span>
                  </button>
                );
              })}
            </div>

            {!submitted ? (
              <button
                type="button"
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
                  <p className="mt-2 text-lg font-semibold">
                    {getTodayMissionText()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">🗣️ 오늘 말한 문장</p>
                  <p className="mt-1 text-3xl font-bold">
                    {spokenSentenceCount}
                  </p>
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

              <p className="mt-4 text-sm text-gray-500">
                상황: {currentQuestion?.situation_kr || "-"}
              </p>

              <div className="mt-4 rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      상대(말){" "}
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {currentQuestion?.partner_jp || "-"}
                      </span>
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
                        listenLimitReached ||
                        audioLoadingKey ===
                        `partner-dialog-${currentQuestion?.qid}`
                      }
                      className="shrink-0 p-1 text-xl leading-none"
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
                      내(말){" "}
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {currentQuestion?.answer_jp || "-"}
                      </span>
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
                        listenLimitReached ||
                        audioLoadingKey ===
                        `answer-dialog-${currentQuestion?.qid}`
                      }
                      className="shrink-0 p-1 text-xl leading-none"
                    >
                      {audioLoadingKey ===
                        `answer-dialog-${currentQuestion?.qid}`
                        ? "재생 중..."
                        : "🔊"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-medium">하테나쌤 원포인트 일본어</p>
                <p className="mt-2">{currentQuestion?.explain_kr || "-"}</p>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-red-300 bg-white">
                <button
                  type="button"
                  onClick={() => setCoachOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] font-medium text-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{coachOpen ? "⌄" : "›"}</span>
                    <span>
                      🤖 원포인트 일본어가 어려우면 하테나쌤에게 물어보세요
                    </span>
                  </div>
                </button>

                {coachOpen ? (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-5">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <TitleImage
                        src={TITLE_PATHS.coach}
                        alt="하테나쌤 스마트 코치"
                        fallback="하테나쌤 스마트 코치"
                      />

                      {isPro ? (
                        <>
                          <textarea
                            value={coachQuestion}
                            onChange={(e) => setCoachQuestion(e.target.value)}
                            placeholder="예) 더 자연스러운 표현도 있어요?"
                            className="mt-5 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                            rows={3}
                          />
                          <p className="mt-3 text-sm text-gray-500">
                            회화 표현·뉘앙스·자연스러움 위주 질문에 최적화되어
                            있어요.
                          </p>

                          {!coachLoading && coachError ? (
                            <p className="mt-3 text-sm text-red-500">
                              {coachError}
                            </p>
                          ) : null}

                          {!coachLoading && !coachError && coachAnswer ? (
                            <div className="mt-4 whitespace-pre-line rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                              {coachAnswer}
                            </div>
                          ) : null}

                          {coachLoading ? (
                            <p className="mt-3 text-sm text-gray-500">
                              답변 중...
                            </p>
                          ) : null}

                          <button
                            type="button"
                            onClick={handleAskCustomCoach}
                            disabled={coachLoading}
                            className="mt-4 w-full rounded-2xl border border-gray-300 px-4 py-3 text-base font-semibold"
                          >
                            {coachLoading
                              ? "AI 코칭 받는 중..."
                              : "AI 코칭 받기 시작"}
                          </button>
                        </>
                      ) : (
                        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                          AI 스마트코치는 유료 플랜에서 이용할 수 있습니다.
                          <a
                            href={PRO_UPGRADE_URL}
                            className="mt-3 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800"
                          >
                            ✨ 유료 플랜 보기
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <TitleImage
                  src={TITLE_PATHS.check}
                  alt="발음체크"
                  fallback="발음체크"
                />
                <p className="text-sm font-semibold text-gray-500">
                  📘 진행: {currentIndex + 1}/{totalCount}
                </p>
              </div>

              {!isPro &&
                (listenLimitReached || recordLimitReached || quotaMessage) ? (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-700">
                  {quotaMessage ||
                    "무료 플랜은 하루 발음듣기 3회, 녹음 3회까지 이용할 수 있습니다."}

                  <UpgradeHint
                    title={
                      listenLimitReached
                        ? "오늘 무료 발음듣기 사용이 모두 끝났어요."
                        : recordLimitReached
                          ? "오늘 무료 녹음 사용이 모두 끝났어요."
                          : "유료 플랜에서는 더 편하게 이어갈 수 있어요."
                    }
                    body={
                      listenLimitReached
                        ? "오늘은 준비된 발음듣기 3회를 모두 사용했습니다. 내일 다시 이용할 수 있고, 유료 플랜에서는 발음듣기를 제한 없이 이용할 수 있습니다."
                        : recordLimitReached
                          ? "오늘은 준비된 녹음 3회를 모두 사용했습니다. 내일 다시 이용할 수 있고, 유료 플랜에서는 녹음을 제한 없이 이용할 수 있습니다."
                          : "무료 플랜은 하루 발음듣기 3회, 녹음 3회까지 이용할 수 있습니다. 유료 플랜에서는 회화 연습을 훨씬 더 여유롭게 이어갈 수 있습니다."
                    }
                  />
                </div>
              ) : null}

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
                    listenLimitReached ||
                    !currentQuestion?.answer_mp3 ||
                    audioLoadingKey === `answer-pron-${currentQuestion?.qid}`
                  }
                  className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 text-lg font-semibold disabled:opacity-50"
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
                <p className="mt-2 text-sm text-gray-500">
                  녹음을 시작하면 남은 시간이 표시되고, 시간이 끝나면 자동으로 채점됩니다.
                </p>

                <div className="mt-4 rounded-[22px] bg-gray-100 px-4 py-4">
                  <div className="flex items-center gap-4 text-gray-500">
                    <button
                      type="button"
                      onClick={
                        pronStage === "recording"
                          ? stopPronRecording
                          : startPronRecording
                      }
                      disabled={recordLimitReached && pronStage !== "recording"}
                      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm transition duration-150 active:scale-95 disabled:opacity-40 ${pronStage === "recording"
                        ? "ring-4 ring-red-100"
                        : "hover:shadow-md"
                        }`}
                      aria-label={
                        pronStage === "recording" ? "녹음 정지" : "녹음 시작"
                      }
                    >
                      {pronStage === "recording" ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                          <span className="h-3 w-3 rounded-[3px] bg-white/95" />
                        </span>
                      ) : (
                        <span
                          aria-label="녹음 시작"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-400 bg-white"
                        >
                          <span className="h-3.5 w-3.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.16)]" />
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={playRecordedPronunciation}
                      disabled={!recordedAudioUrl}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition duration-150 active:scale-95 disabled:opacity-40 ${isRecordedPlaying
                        ? "ring-4 ring-gray-200 shadow-md"
                        : "hover:shadow-md"
                        }`}
                      aria-label="내 녹음 재생"
                    >
                      <span
                        className={`ml-[1px] inline-block h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] ${isRecordedPlaying
                          ? "border-l-black"
                          : "border-l-gray-700"
                          }`}
                      />
                    </button>

                    <div className="flex flex-1 items-center justify-center overflow-hidden">
                      {waveformBars.some((bar) => bar > 0.12) ? (
                        <div className="flex items-center gap-[3px]">
                          {waveformBars.map((bar, idx) => (
                            <span
                              key={idx}
                              className="w-[4px] rounded-full bg-gray-400 transition-all duration-100"
                              style={{
                                height: `${Math.max(
                                  6,
                                  Math.round(bar * 42)
                                )}px`,
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-[6px]">
                          {Array.from({ length: 34 }).map((_, idx) => (
                            <span
                              key={idx}
                              className="h-[6px] w-[6px] rounded-full bg-gray-300"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="min-w-[92px] text-right">
                      {pronStage === "recording" ? (
                        <>
                          <div className="text-[28px] font-bold tracking-[0.04em] text-red-500">
                            {recordCountdown}
                          </div>
                          <div className="text-[11px] font-medium text-gray-400">
                            남은 시간
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[22px] font-medium tracking-[0.08em] text-gray-500">
                            {pronDuration}
                          </div>
                          <div className="text-[11px] font-medium text-gray-400">
                            녹음 길이
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {pronError ? (
                  <p className="mt-4 text-sm text-red-500">{pronError}</p>
                ) : null}
              </div>

              <div className="mt-8 border-t border-gray-100 pt-6">
                <TitleImage
                  src={TITLE_PATHS.score}
                  alt="말하기 점수"
                  fallback="말하기 점수"
                />

                {pronScoring ? (
                  <div className="mt-4">
                    <p className="text-lg text-gray-600">점수 계산 중...</p>
                  </div>
                ) : pronChecked ? (
                  <div className="mt-4 space-y-5">
                    <div>
                      <p className="mt-3 text-[32px] leading-tight text-gray-800">
                        {pronTranscript || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-base text-gray-700">점수</p>
                      <p className="mt-2 text-6xl font-bold leading-none text-gray-800">
                        {pronScore ?? 0}
                      </p>
                    </div>

                    {pronFeedback ? (
                      <div className="space-y-2">
                        {pronFeedback.verdict ? (
                          <p className="text-emerald-600 font-semibold">
                            {pronFeedback.verdict}
                          </p>
                        ) : null}

                        {pronFeedback.suggestion ? (
                          <p className="text-blue-600 font-medium">
                            {pronFeedback.suggestion}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-lg text-gray-600">
                      정답을 보고 2~3번 따라 말해 보세요. 녹음이 끝나면 점수가
                      자동으로 계산됩니다.
                    </p>
                  </div>
                )}

                {!showRewardCard ? (
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleRewardComplete}
                      className="rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold"
                    >
                      ✅ 다 했어요 (보상 받기)
                    </button>

                    <button
                      type="button"
                      onClick={handleSkipNext}
                      className="rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold"
                    >
                      ➡️ 다음 문제로 (보상 없이)
                    </button>
                  </div>
                ) : null}

                {showPronOnlyNotice ? (
                  <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-4 text-[15px] font-medium text-yellow-800">
                    발음은 100점이지만, 문제 선택이 오답이라 보상은 지급되지
                    않습니다. (정답/발음은 별개로 관리돼요.)
                  </div>
                ) : null}

                {showNeedPerfectNotice ? (
                  <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-4 text-[15px] font-medium text-yellow-800">
                    보상은 '녹음 + 100점'일 때만 받을 수 있어요. 지금 바로
                    녹음하고 100점을 만들어 보세요.
                  </div>
                ) : null}
              </div>
            </div>

            {showRewardCard ? (
              <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
                <TitleImage
                  src={TITLE_PATHS.reward}
                  alt="말하기 완료 보상"
                  fallback="말하기 완료 보상"
                />

                <div className="mt-5 rounded-2xl bg-green-50 px-5 py-5">
                  <p className="text-lg font-semibold text-green-700">
                    🎉 발음 100점!
                  </p>
                  <p className="mt-2 text-2xl font-bold text-green-700">
                    +2 XP 🔊 획득
                  </p>
                </div>

                <p className="mt-5 text-base text-gray-500">
                  보상을 받고 다음 문제로 넘어갑니다.
                </p>

                <button
                  type="button"
                  onClick={handleRewardComplete}
                  disabled={saving}
                  className="mt-5 w-full rounded-2xl border border-gray-300 px-5 py-4 text-lg font-semibold disabled:opacity-60"
                >
                  {saving ? "저장 중..." : "➡️ 다음 문제 풀기"}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
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
              {completionNextSubValue ? (
                <button
                  type="button"
                  onClick={handleStartNextSub}
                  className="w-full rounded-2xl bg-black px-5 py-4 text-lg font-semibold text-white"
                >
                  다음 상황 풀기
                </button>
              ) : (
                <a
                  href="/mypage/wrong-talk"
                  className="block w-full rounded-2xl border border-gray-300 px-5 py-4 text-center text-lg font-semibold text-gray-900"
                >
                  오답노트 보기
                </a>
              )}

              <button
                type="button"
                onClick={handleBackToSelectFromCompletion}
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