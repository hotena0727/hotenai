export const runtime = "nodejs";

function kataToHira(text: string) {
  return text.replace(/[ァ-ン]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function stripPunctuation(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[、。．，,！？!？「」『』（）()\[\]{}…~"'`´]/g, "");
}

function normalizeForSurfaceMatch(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[、。．，,！？!？「」『』（）()\[\]{}…~"'`´]/g, "");
}

function normJp(text: string) {
  return kataToHira(stripPunctuation(text)).toLowerCase();
}

/**
 * reading 비교용 정규화
 * - 장음(ー) 유지
 * - 촉음(っ) 유지
 * - 작은 글자만 큰 글자로 보정
 */
function normJpForReading(text: string) {
  return normJp(text).replace(/[ゃゅょぁぃぅぇぉゎ]/g, (ch) =>
    (
      {
        ゃ: "や",
        ゅ: "ゆ",
        ょ: "よ",
        ぁ: "あ",
        ぃ: "い",
        ぅ: "う",
        ぇ: "え",
        ぉ: "お",
        ゎ: "わ",
      } as Record<string, string>
    )[ch] || ch
  );
}

function replaceCommonVariants(text: string) {
  return normJpForReading(text)
    .replace(/ふいんき/g, "ふんいき")
    .replace(/を/g, "お");
}

function toReadingLike(text: string) {
  return replaceCommonVariants(text);
}

function bigrams(s: string) {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i += 1) {
    out.add(s.slice(i, i + 2));
  }
  return out;
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 0; i < a.length; i += 1) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      const ins = cur[j] + 1;
      const del = prev[j + 1] + 1;
      const sub = prev[j] + (a[i] === b[j] ? 0 : 1);
      cur.push(Math.min(ins, del, sub));
    }
    prev = cur;
  }

  return prev[prev.length - 1] ?? 0;
}

function scoreByDistance(a: string, b: string) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 100 * (1 - dist / Math.max(a.length, b.length, 1));
}

function surfaceSimilarity(a: string, b: string) {
  const aa = normalizeForSurfaceMatch(a);
  const bb = normalizeForSurfaceMatch(b);
  if (!aa || !bb) return 0;
  return scoreByDistance(aa, bb);
}

function countOccurrences(text: string, pattern: RegExp) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * 흐름 평가는 최소한만 반영
 * - filler
 * - 토큰 반복
 */
function analyzeSpeechFlow(rawTranscript: string, _normalizedReading: string) {
  const raw = String(rawTranscript || "").trim();

  const fillerCount = countOccurrences(
    raw,
    /(えっと|ええと|あの|その|うーん|えーと|なんか)/g
  );

  const rawTokens = raw
    .normalize("NFKC")
    .split(/[\s\u3000、。,.!?！？]+/)
    .map((v) => v.trim())
    .filter(Boolean);

  let repeatedTokenCount = 0;
  for (let i = 1; i < rawTokens.length; i += 1) {
    if (rawTokens[i] === rawTokens[i - 1]) {
      repeatedTokenCount += 1;
    }
  }

  const penalty = fillerCount * 4 + repeatedTokenCount * 6;
  const hasFlowIssue = fillerCount > 0 || repeatedTokenCount > 0;

  return {
    fillerCount,
    repeatedCharCount: 0,
    repeatedFragmentCount: 0,
    repeatedTokenCount,
    penalty,
    hasFlowIssue,
  };
}

function hasKanji(text: string) {
  return /[一-龯々〆ヵヶ]/.test(text);
}

function buildExpectedReading(answerJp: string, answerYomi: string) {
  return toReadingLike(answerYomi || answerJp);
}

function normalizeNumericJapanese(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/か月/g, "ヶ月")
    .replace(/ケ月/g, "ヶ月")
    .replace(/ヵ月/g, "ヶ月")
    .replace(/カ月/g, "ヶ月");
}

function extractCriticalTokens(text: string) {
  const s = normalizeNumericJapanese(text);

  const matches =
    s.match(
      /(\d+ヶ月|\d+月|\d+年|\d+回|\d+日|\d+時間|\d+分|\d+人|\d+つ|\d+個|\d+本|\d+枚|\d+歳|[一二三四五六七八九十百千万]+ヶ月|[一二三四五六七八九十百千万]+月|[一二三四五六七八九十百千万]+年|[一二三四五六七八九十百千万]+回|[一二三四五六七八九十百千万]+日|[一二三四五六七八九十百千万]+時間|[一二三四五六七八九十百千万]+分|[一二三四五六七八九十百千万]+人|[一二三四五六七八九十百千万]+つ|[一二三四五六七八九十百千万]+個|[一二三四五六七八九十百千万]+本|[一二三四五六七八九十百千万]+枚|[一二三四五六七八九十百千万]+歳)/g
    ) || [];

  return matches;
}

function hasCriticalTokenMismatch(answerJp: string, transcript: string) {
  const a = extractCriticalTokens(answerJp);
  const b = extractCriticalTokens(transcript);

  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return true;

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return true;
  }

  return false;
}

/**
 * 핵심:
 * - 채점 = reading 기준
 * - 표시 = transcript 그대로
 * - 한자/히라가나 차이만 무시
 * - 단, 숫자/기간 같은 핵심 토큰이 다르면 yomi 강제채택 금지
 */
function buildActualReadingWithYomiPriority(
  transcript: string,
  answerJp: string,
  answerYomi: string
) {
  const expectedReading = buildExpectedReading(answerJp, answerYomi);

  if (!transcript) {
    return {
      actualReading: "",
      adoptedExpectedYomi: false,
      surfaceScore: 0,
    };
  }

  const rawSurfaceScore = surfaceSimilarity(transcript, answerJp);
  const transcriptReading = toReadingLike(transcript);

  if (answerYomi) {
    const hasCriticalMismatch = hasCriticalTokenMismatch(answerJp, transcript);

    const shouldAdoptExpectedYomi =
      hasKanji(transcript) &&
      rawSurfaceScore >= 70 &&
      !hasCriticalMismatch;

    return {
      actualReading: shouldAdoptExpectedYomi
        ? expectedReading
        : transcriptReading,
      adoptedExpectedYomi: shouldAdoptExpectedYomi,
      surfaceScore: rawSurfaceScore,
    };
  }

  return {
    actualReading: transcriptReading,
    adoptedExpectedYomi: false,
    surfaceScore: rawSurfaceScore,
  };
}

function estimateSlowSpeechPenalty(
  durationMs: number,
  expectedReading: string
) {
  if (!durationMs || !expectedReading) {
    return {
      penalty: 0,
      cps: 0,
      isSlow: false,
    };
  }

  const seconds = durationMs / 1000;
  if (seconds <= 0) {
    return {
      penalty: 0,
      cps: 0,
      isSlow: false,
    };
  }

  const readingLen = Array.from(expectedReading).length;
  const cps = readingLen / seconds;

  let penalty = 0;

  // 느리게 말하면 확실히 점수 떨어지게
  if (cps < 1.2) {
    penalty = 18;
  } else if (cps < 1.5) {
    penalty = 12;
  } else if (cps < 1.8) {
    penalty = 7;
  } else if (cps < 2.1) {
    penalty = 3;
  }

  return {
    penalty,
    cps,
    isSlow: penalty > 0,
  };
}

function calcAudioRmsFromInt16Pcm(buffer: ArrayBuffer) {
  const view = new DataView(buffer);

  if (view.byteLength <= 44) return 0;

  let sumSq = 0;
  let count = 0;

  for (let offset = 44; offset + 1 < view.byteLength; offset += 2) {
    const sample = view.getInt16(offset, true) / 32768;
    sumSq += sample * sample;
    count += 1;
  }

  if (count === 0) return 0;
  return Math.sqrt(sumSq / count);
}

function similarityScoreWithYomiPriority(
  transcript: string,
  answerJp: string,
  answerYomi: string,
  durationMs = 0,
  gate = 0.12,
  floorToZero = 10
) {
  const expectedReading = buildExpectedReading(answerJp, answerYomi);

  const { actualReading, adoptedExpectedYomi, surfaceScore } =
    buildActualReadingWithYomiPriority(transcript, answerJp, answerYomi);

  const displayAsAnswer = false;
  const displayTranscript = transcript;

  if (!expectedReading || !actualReading) {
    return {
      score: 0,
      expectedReading,
      actualReading,
      adoptedExpectedYomi,
      surfaceScore,
      displayTranscript,
      displayAsAnswer,
    };
  }

  const flow = analyzeSpeechFlow(transcript, actualReading);
  const slow = estimateSlowSpeechPenalty(durationMs, expectedReading);

  if (expectedReading === actualReading) {
    const totalPenalty = flow.penalty + slow.penalty;

    return {
      score: Math.max(0, 100 - totalPenalty),
      expectedReading,
      actualReading,
      adoptedExpectedYomi,
      surfaceScore,
      displayTranscript,
      displayAsAnswer,
    };
  }

  const bb = bigrams(expectedReading);
  if (bb.size > 0) {
    const overlap =
      [...bigrams(actualReading)].filter((item) => bb.has(item)).length /
      Math.max(1, bb.size);

    if (overlap < gate) {
      return {
        score: 0,
        expectedReading,
        actualReading,
        adoptedExpectedYomi,
        surfaceScore,
        displayTranscript,
        displayAsAnswer,
      };
    }
  }

  const scoreRead = scoreByDistance(actualReading, expectedReading);

  let weighted = Math.round(scoreRead);
  weighted -= flow.penalty + slow.penalty;

  if (flow.hasFlowIssue && weighted >= 100) {
    weighted = 97;
  }

  const finalScore =
    weighted < floorToZero
      ? 0
      : Math.max(0, Math.min(100, weighted));

  return {
    score: finalScore,
    expectedReading,
    actualReading,
    adoptedExpectedYomi,
    surfaceScore,
    displayTranscript,
    displayAsAnswer,
  };
}

function getFirstDiffInfo(expected: string, actual: string) {
  const a = Array.from(expected);
  const b = Array.from(actual);
  const max = Math.max(a.length, b.length);

  for (let i = 0; i < max; i += 1) {
    const ea = a[i] ?? "";
    const ab = b[i] ?? "";
    if (ea !== ab) {
      return {
        index: i,
        expectedChar: ea || "(없음)",
        actualChar: ab || "(없음)",
        expectedTail: a.slice(Math.max(0, i - 2), i + 4).join(""),
        actualTail: b.slice(Math.max(0, i - 2), i + 4).join(""),
      };
    }
  }

  return null;
}

function makeDetailedFeedback(
  score: number,
  _answer: string,
  transcript: string,
  expectedReading: string,
  actualReading: string,
  slow: { penalty: number; cps: number; isSlow: boolean },
  _adoptedExpectedYomi = false
) {
  const flow = analyzeSpeechFlow(transcript, actualReading);
  const diff = getFirstDiffInfo(expectedReading, actualReading);

  let verdict = "";
  if (score >= 98) verdict = "🎯 아주 좋습니다";
  else if (score >= 90) verdict = "🎯 좋습니다";
  else if (score >= 80) verdict = "🎯 괜찮아요";
  else if (score >= 65) verdict = "🎯 조금만 더";
  else verdict = "🎯 다시 해봐요";

  let suggestion = "";
  if (score >= 98) {
    suggestion = "💡 정확하고 자연스럽게 말했어요.";
  } else if (slow.isSlow) {
    suggestion = "💡 지금보다 조금만 더 자연스럽고 빠르게 말해 보세요.";
  } else if (flow.hasFlowIssue) {
    suggestion = "💡 문장을 끊지 말고 조금만 더 부드럽게 이어서 말해 보세요.";
  } else if (score >= 90) {
    suggestion = "💡 발음을 조금만 더 또렷하고 안정감 있게 말해 보세요.";
  } else if (score >= 80) {
    suggestion = "💡 말의 길이와 리듬을 조금만 더 자연스럽게 맞춰 보세요.";
  } else if (diff) {
    suggestion = "💡 정답 발음을 다시 듣고 한 번 더 따라 해 보세요.";
  } else {
    suggestion = "💡 정답 발음을 다시 듣고 리듬에 맞춰 한 번 더 말해 보세요.";
  }

  return {
    verdict,
    suggestion,
    expectedSnippet: "",
    actualSnippet: "",
  };
}

function buildSilentResponse(model: string, suggestion: string) {
  return Response.json({
    transcript: "",
    rawTranscript: "",
    displayAsAnswer: false,
    score: 0,
    feedback: {
      verdict: "🎯 다시 해봐요",
      suggestion,
      expectedSnippet: "",
      actualSnippet: "",
    },
    model,
  });
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const TRANSCRIBE_MODEL =
      process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

    const form = await req.formData();
    const inputFile = form.get("file");
    const answerJp = String(form.get("answer_jp") || "").trim();
    const answerYomi = String(form.get("answer_yomi") || "").trim();
    const durationMs = Number(form.get("duration_ms") || 0);

    if (
      !inputFile ||
      typeof inputFile !== "object" ||
      !("arrayBuffer" in inputFile)
    ) {
      return Response.json({ error: "녹음 파일이 없습니다." }, { status: 400 });
    }

    if (!answerJp) {
      return Response.json(
        { error: "정답 문장이 없습니다." },
        { status: 400 }
      );
    }

    const name =
      inputFile instanceof File && inputFile.name
        ? inputFile.name
        : "speech.wav";

    const MIN_DURATION_MS = 1000;
    const SILENCE_RMS_THRESHOLD = 0.018;

    if (durationMs < MIN_DURATION_MS) {
      return buildSilentResponse(
        TRANSCRIBE_MODEL,
        "💡 목소리가 너무 짧게 들어갔어요. 조금 더 또렷하게 말해 보세요."
      );
    }

    let audioArrayBuffer: ArrayBuffer;
    try {
      audioArrayBuffer = await (inputFile as File).arrayBuffer();
    } catch {
      return Response.json(
        { error: "녹음 파일을 읽지 못했습니다." },
        { status: 400 }
      );
    }

    const rms = calcAudioRmsFromInt16Pcm(audioArrayBuffer);

    if (rms < SILENCE_RMS_THRESHOLD) {
      return buildSilentResponse(
        TRANSCRIBE_MODEL,
        "💡 목소리가 거의 감지되지 않았어요. 마이크를 켜고 조금 더 크게 말해 보세요."
      );
    }

    const prompt = [
      "다음 일본어 음성을 전사하세요.",
      "가능하면 히라가나 중심으로 전사하세요.",
      "들리지 않거나 확실하지 않으면 추측하지 말고 짧게 전사하세요.",
    ].join("\n");

    const fd = new FormData();
    fd.append("file", new Blob([audioArrayBuffer], { type: "audio/wav" }), name);
    fd.append("model", TRANSCRIBE_MODEL);
    fd.append("language", "ja");
    fd.append("response_format", "json");
    fd.append("prompt", prompt);

    let sttRes: Response;
    try {
      sttRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: fd,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Response.json(
        { error: `[전사 요청 실패] ${message}` },
        { status: 500 }
      );
    }

    const rawText = await sttRes.text();

    if (!sttRes.ok) {
      let message = rawText;
      try {
        const parsed = rawText ? JSON.parse(rawText) : {};
        message = String(
          parsed?.error?.message || rawText || "전사에 실패했습니다."
        );
      } catch {
        message = rawText || "전사에 실패했습니다.";
      }

      return Response.json(
        { error: `[전사 응답 오류 ${sttRes.status}] ${message}` },
        { status: 500 }
      );
    }

    let transcript = "";
    try {
      const parsed = rawText ? JSON.parse(rawText) : {};
      transcript = String(parsed?.text || "").trim();
    } catch {
      transcript = "";
    }

    if (!transcript) {
      return buildSilentResponse(
        TRANSCRIBE_MODEL,
        "💡 음성이 제대로 인식되지 않았어요. 조금 더 또렷하게 다시 말해 보세요."
      );
    }

    const judged = similarityScoreWithYomiPriority(
      transcript,
      answerJp,
      answerYomi,
      durationMs
    );

    const slow = estimateSlowSpeechPenalty(durationMs, judged.expectedReading);

    const feedback = makeDetailedFeedback(
      judged.score,
      answerJp,
      transcript,
      judged.expectedReading,
      judged.actualReading,
      slow,
      judged.adoptedExpectedYomi
    );

    return Response.json({
      transcript: judged.displayTranscript,
      rawTranscript: transcript,
      displayAsAnswer: judged.displayAsAnswer,
      score: judged.score,
      feedback,
      model: TRANSCRIBE_MODEL,
    });
  } catch (error) {
    console.error("talk-pron-score error:", error);
    const message = error instanceof Error ? error.message : String(error);

    return Response.json(
      {
        error: `[서버 내부 오류] ${message || "말하기 점수를 계산하지 못했습니다."
          }`,
      },
      { status: 500 }
    );
  }
}