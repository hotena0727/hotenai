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

function normJp(text: string) {
  return kataToHira(stripPunctuation(text)).toLowerCase();
}

function normJpLoose(text: string) {
  return normJp(text)
    .replace(/ー/g, "")
    .replace(/っ/g, "")
    .replace(/[ゃゅょぁぃぅぇぉゎ]/g, (ch) =>
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
  return normJpLoose(text)
    .replace(/ふいんき/g, "ふんいき")
    .replace(/を/g, "お");
}

function toReadingLike(text: string) {
  return replaceCommonVariants(text);
}

function removeJapaneseSpaces(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, "");
}

function normalizeForSurfaceMatch(text: string) {
  return removeJapaneseSpaces(text).replace(
    /[、。．，,！？!？「」『』（）()$begin:math:display$$end:math:display${}…~"'`´]/g,
    ""
  );
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

function analyzeSpeechFlow(rawTranscript: string, normalizedReading: string) {
  const raw = String(rawTranscript || "").trim();
  const norm = String(normalizedReading || "");

  const fillerCount = countOccurrences(
    raw,
    /(えっと|ええと|あの|その|うーん|えーと|ま|なんか)/g
  );

  let repeatedCharCount = 0;
  for (let i = 1; i < norm.length; i += 1) {
    if (norm[i] === norm[i - 1]) {
      repeatedCharCount += 1;
    }
  }

  let repeatedFragmentCount = 0;
  for (let size = 1; size <= 2; size += 1) {
    for (let i = 0; i + size * 2 <= norm.length; i += 1) {
      const a = norm.slice(i, i + size);
      const b = norm.slice(i + size, i + size * 2);
      if (a && a === b) {
        repeatedFragmentCount += 1;
      }
    }
  }

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

  const penalty =
    fillerCount * 2 +
    repeatedCharCount * 1 +
    repeatedFragmentCount * 2 +
    repeatedTokenCount * 4;

  const hasFlowIssue =
    fillerCount > 0 ||
    repeatedCharCount > 0 ||
    repeatedFragmentCount > 0 ||
    repeatedTokenCount > 0;

  return {
    fillerCount,
    repeatedCharCount,
    repeatedFragmentCount,
    repeatedTokenCount,
    penalty,
    hasFlowIssue,
  };
}

function buildExpectedReading(answerJp: string, answerYomi: string) {
  return toReadingLike(answerYomi || answerJp);
}

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

  if (answerYomi && rawSurfaceScore >= 90) {
    return {
      actualReading: expectedReading,
      adoptedExpectedYomi: true,
      surfaceScore: rawSurfaceScore,
    };
  }

  return {
    actualReading: toReadingLike(transcript),
    adoptedExpectedYomi: false,
    surfaceScore: rawSurfaceScore,
  };
}

function similarityScoreWithYomiPriority(
  transcript: string,
  answerJp: string,
  answerYomi: string,
  gate = 0.12,
  floorToZero = 10
) {
  const expectedReading = buildExpectedReading(answerJp, answerYomi);

  const { actualReading, adoptedExpectedYomi, surfaceScore } =
    buildActualReadingWithYomiPriority(transcript, answerJp, answerYomi);

  if (!expectedReading || !actualReading) {
    return {
      score: 0,
      expectedReading,
      actualReading,
      adoptedExpectedYomi,
      surfaceScore,
    };
  }

  const flow = analyzeSpeechFlow(transcript, actualReading);

  if (expectedReading === actualReading) {
    const cappedPerfect = flow.hasFlowIssue
      ? Math.max(95, 100 - flow.penalty)
      : 100;

    return {
      score: cappedPerfect,
      expectedReading,
      actualReading,
      adoptedExpectedYomi,
      surfaceScore,
    };
  }

  const bb = bigrams(expectedReading);
  if (bb.size > 0) {
    const overlap =
      [...bigrams(actualReading)].filter((item) => bb.has(item)).length /
      Math.max(1, bb.size);

    if (overlap < gate) {
      return {
        score: 35,
        expectedReading,
        actualReading,
        adoptedExpectedYomi,
        surfaceScore,
      };
    }
  }

  const scoreRead = scoreByDistance(actualReading, expectedReading);

  let weighted = Math.round(scoreRead);

  if (surfaceScore >= 85) {
    weighted += 4;
  }

  weighted -= flow.penalty;

  if (flow.hasFlowIssue && weighted >= 100) {
    weighted = 97;
  }

  const finalScore =
    weighted < floorToZero
      ? 35
      : Math.max(35, Math.min(100, weighted));

  return {
    score: finalScore,
    expectedReading,
    actualReading,
    adoptedExpectedYomi,
    surfaceScore,
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
  answer: string,
  transcript: string,
  expectedReading: string,
  actualReading: string,
  adoptedExpectedYomi = false
) {
  const diff = getFirstDiffInfo(expectedReading, actualReading);
  const flow = analyzeSpeechFlow(transcript, actualReading);

  const yomiGuideComment = adoptedExpectedYomi
    ? `\n📝 한자 표기로 인식됐지만, 발음은 맞게 판단했어요.`
    : "";

  const flowComment = flow.hasFlowIssue
    ? `\n💡 이번에는 조금 더 끊지 않고 자연스럽게 이어서 말해 보세요.`
    : "";

  if (score >= 98) {
    return `🎯 아주 좋습니다\n🗣️ ${answer} 를 정확하고 자연스럽게 말했어요.${yomiGuideComment}`;
  }

  if (score >= 90) {
    return [
      `🎯 좋습니다`,
      `🗣️ 거의 정확합니다.`,
      `지금처럼 말해도 충분히 좋아요.`,
      `한 번만 더 또렷하고 자연스럽게 이어서 말해 보세요.${yomiGuideComment}${flowComment}`,
    ].join("\n");
  }

  if (score >= 80) {
    if (diff) {
      return [
        `🎯 좋습니다`,
        `🗣️ 큰 흐름은 잘 맞아요.`,
        `${diff.index + 1}번째 글자 근처를 한 번만 더 확인해 보세요.`,
        `정답 기준: ${diff.expectedTail}`,
        `인식 결과: ${diff.actualTail}`,
        `전체적으로는 잘 따라오고 있습니다.${yomiGuideComment}${flowComment}`,
      ].join("\n");
    }

    return [
      `🎯 좋습니다`,
      `🗣️ 큰 흐름은 맞아요.`,
      `정답을 보며 한 번 더 자연스럽게 이어서 말해 보세요.${yomiGuideComment}${flowComment}`,
    ].join("\n");
  }

  if (score >= 65) {
    if (diff) {
      return [
        `🎯 조금만 더`,
        `🗣️ 잘 말하고 있어요.`,
        `${diff.index + 1}번째 글자 근처가 조금 달라 보입니다.`,
        `정답 기준: ${diff.expectedTail}`,
        `인식 결과: ${diff.actualTail}`,
        `천천히 한 번 더 따라 말해 보세요.${flowComment}`,
      ].join("\n");
    }

    return [
      `🎯 조금만 더`,
      `🗣️ 전체 흐름은 따라가고 있어요.`,
      `정답을 보면서 한 번 더 천천히 말해 보세요.${flowComment}`,
    ].join("\n");
  }

  return [
    `🎯 천천히 다시`,
    `🗣️ 괜찮아요. 지금은 말해보는 것 자체가 중요합니다.`,
    `정답을 보며 짧게 한 번 더 따라 말해 보세요.${flowComment}`,
  ].join("\n");
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

    const prompt = [
      "다음 일본어 음성을 전사하세요.",
      "가능하면 히라가나 중심으로 전사하세요.",
      "동음이의어 한자가 가능하면 정답 문장에 가까운 표기를 우선하세요.",
      "정답과 같은 발음이면 정답 문장에 가까운 표기를 우선해 주세요.",
      "이 평가는 사용자가 실제로 말해보는 경험을 돕는 목적입니다.",
      "정답 읽기와 일치하는 경우, 가능한 한 정답에 가까운 표기를 우선하세요.",
      `정답 문장: ${answerJp}`,
      answerYomi ? `정답 읽기: ${answerYomi}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const fd = new FormData();
    fd.append("file", inputFile, name);
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
      return Response.json(
        { error: "전사 결과가 비어 있습니다." },
        { status: 500 }
      );
    }

    const judged = similarityScoreWithYomiPriority(
      transcript,
      answerJp,
      answerYomi
    );

    const feedback = makeDetailedFeedback(
      judged.score,
      answerJp,
      transcript,
      judged.expectedReading,
      judged.actualReading,
      judged.adoptedExpectedYomi
    );

    return Response.json({
      transcript,
      score: judged.score,
      feedback,
      model: TRANSCRIBE_MODEL,
    });
  } catch (error) {
    console.error("talk-pron-score error:", error);
    const message = error instanceof Error ? error.message : String(error);

    return Response.json(
      {
        error: `[서버 내부 오류] ${
          message || "말하기 점수를 계산하지 못했습니다."
        }`,
      },
      { status: 500 }
    );
  }
}