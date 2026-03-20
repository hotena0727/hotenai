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
    fillerCount * 4 +
    repeatedCharCount * 3 +
    repeatedFragmentCount * 4 +
    repeatedTokenCount * 8;

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

function similarityScore(a: string, b: string, gate = 0.15, floorToZero = 15) {
  const aStrict = normJp(a);
  const bStrict = normJp(b);

  if (!aStrict || !bStrict) return 0;

  const aLoose = normJpLoose(a);
  const bLoose = normJpLoose(b);

  const aRead = toReadingLike(a);
  const bRead = toReadingLike(b);

  const flow = analyzeSpeechFlow(a, aRead);

  if (aRead && bRead && aRead === bRead) {
    const cappedPerfect = flow.hasFlowIssue
      ? Math.max(88, 100 - flow.penalty)
      : 100;
    return cappedPerfect;
  }

  const bb = bigrams(bRead);
  if (bb.size > 0) {
    const overlap =
      [...bigrams(aRead)].filter((item) => bb.has(item)).length /
      Math.max(1, bb.size);

    if (overlap < gate) return 0;
  }

  const scoreStrict = scoreByDistance(aStrict, bStrict);
  const scoreLoose = scoreByDistance(aLoose, bLoose);
  const scoreRead = scoreByDistance(aRead, bRead);

  let weighted = Math.round(
    scoreStrict * 0.05 + scoreLoose * 0.1 + scoreRead * 0.85
  );

  weighted -= flow.penalty;

  if (flow.hasFlowIssue && weighted >= 100) {
    weighted = 96;
  }

  return weighted < floorToZero
    ? 0
    : Math.max(0, Math.min(100, weighted));
}

function isKanaChar(ch: string) {
  return /[ぁ-んァ-ンー]/.test(ch);
}

function normalizeKanaOnly(text: string) {
  return kataToHira(String(text || "").normalize("NFKC"));
}

function splitByKanaRuns(text: string) {
  const chars = Array.from(String(text || ""));
  const parts: { text: string; isKana: boolean }[] = [];

  for (const ch of chars) {
    const isKana = isKanaChar(ch);
    const last = parts[parts.length - 1];
    if (last && last.isKana === isKana) {
      last.text += ch;
    } else {
      parts.push({ text: ch, isKana });
    }
  }

  return parts;
}

function buildAnswerReadingMap(answerJp: string, answerYomi: string) {
  const parts = splitByKanaRuns(answerJp).filter((p) => p.text.trim() !== "");
  const yomi = normalizeKanaOnly(answerYomi);
  const mapped: { jp: string; reading: string; isKana: boolean }[] = [];

  let cursor = 0;

  for (let i = 0; i < parts.length; i += 1) {
    const cur = parts[i];

    if (cur.isKana) {
      const kana = normalizeKanaOnly(cur.text);
      const idx = yomi.indexOf(kana, cursor);

      if (idx >= 0) {
        if (
          idx > cursor &&
          mapped.length > 0 &&
          !mapped[mapped.length - 1].isKana
        ) {
          mapped[mapped.length - 1].reading += yomi.slice(cursor, idx);
        }
        mapped.push({ jp: cur.text, reading: kana, isKana: true });
        cursor = idx + kana.length;
      } else {
        mapped.push({ jp: cur.text, reading: kana, isKana: true });
      }
      continue;
    }

    const nextKanaPart = parts.slice(i + 1).find((p) => p.isKana);
    if (!nextKanaPart) {
      mapped.push({
        jp: cur.text,
        reading: yomi.slice(cursor),
        isKana: false,
      });
      cursor = yomi.length;
      continue;
    }

    const nextKana = normalizeKanaOnly(nextKanaPart.text);
    const nextIdx = yomi.indexOf(nextKana, cursor);

    if (nextIdx >= 0) {
      mapped.push({
        jp: cur.text,
        reading: yomi.slice(cursor, nextIdx),
        isKana: false,
      });
      cursor = nextIdx;
    } else {
      mapped.push({
        jp: cur.text,
        reading: "",
        isKana: false,
      });
    }
  }

  return mapped;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAllSafe(text: string, search: string, replacement: string) {
  if (!search) return text;
  return text.replace(new RegExp(escapeRegExp(search), "g"), replacement);
}

function hiraganizeByAnswerMap(
  transcript: string,
  answerJp: string,
  answerYomi: string
) {
  if (!answerYomi) return toReadingLike(transcript);

  const answerMap = buildAnswerReadingMap(answerJp, answerYomi);
  if (!answerMap.length) return toReadingLike(transcript);

  let out = String(transcript || "");
  let matchedCount = 0;

  for (const item of answerMap) {
    if (item.isKana) continue;
    if (!item.jp || !item.reading) continue;

    if (out.includes(item.jp)) {
      out = replaceAllSafe(out, item.jp, item.reading);
      matchedCount += 1;
    }
  }

  // answer_jp 안에 있던 한자만 안전하게 읽기로 치환
  // 치환이 전혀 안 됐더라도 최종 비교는 히라가나 정규화 문자열로 통일
  return toReadingLike(out);
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
  actualReading: string
) {
  const diff = getFirstDiffInfo(expectedReading, actualReading);
  const flow = analyzeSpeechFlow(transcript, actualReading);

  const flowComment = flow.hasFlowIssue
    ? `\n💡 이번에는 끊지 말고 한 호흡으로 더 자연스럽게 말해 보세요.`
    : "";

  if (score >= 100) {
    return `🎯 아주 좋습니다\n🗣️ ${answer} 를 정확하고 자연스럽게 말했어요.`;
  }

  if (score >= 90) {
    if (diff) {
      return [
        `🎯 좋습니다`,
        `🗣️ 거의 정확합니다.`,
        `다만 ${diff.index + 1}번째 글자 근처를 한 번 더 확인해 보세요.`,
        `정답 기준: ${diff.expectedTail}`,
        `인식 결과: ${diff.actualTail}`,
        flow.hasFlowIssue
          ? `💡 이번에는 끊지 말고 한 호흡으로 더 자연스럽게 말해 보세요.`
          : ``,
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (flow.hasFlowIssue) {
      return [
        `🎯 좋습니다`,
        `🗣️ 발음 자체는 거의 정확합니다.`,
        `다만 조금 끊기거나 반복된 부분이 있었어요.`,
        `한 번에 자연스럽게 이어서 말하면 100점에 더 가까워집니다.`,
      ].join("\n");
    }

    return `🎯 좋습니다\n🗣️ 거의 정확합니다. ${answer} 를 한 번만 더 또렷하게 말해 보세요.${flowComment}`;
  }

  if (score >= 75) {
    if (diff) {
      return [
        `🎯 좋습니다`,
        `🗣️ 큰 흐름은 맞아요.`,
        `${diff.index + 1}번째 글자 근처가 조금 달라요.`,
        `정답 기준: ${diff.expectedTail}`,
        `인식 결과: ${diff.actualTail}`,
        flow.hasFlowIssue ? `끊김이나 반복도 조금 줄여 보세요.` : ``,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return `🎯 좋습니다\n🗣️ ${transcript || answer} 에서 큰 흐름은 맞아요. 정답을 보며 한 번 더 또렷하고 자연스럽게 말해 보세요.${flowComment}`;
  }

  if (score >= 50) {
    if (diff) {
      return [
        `🎯 조금만 더`,
        `🗣️ 몇 군데가 달라요.`,
        `${diff.index + 1}번째 글자 근처를 다시 들어보세요.`,
        `정답 기준: ${diff.expectedTail}`,
        `인식 결과: ${diff.actualTail}`,
        flow.hasFlowIssue
          ? `천천히 끊지 말고 한 번에 말하는 것도 의식해 보세요.`
          : ``,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return `🎯 조금만 더\n🗣️ ${answer} 와 비슷하지만 몇 군데가 달라요. 정답을 보고 2~3번 따라 말해 보세요.${flowComment}`;
  }

  if (diff) {
    return [
      `🎯 천천히 다시`,
      `🗣️ 발음 차이가 조금 큽니다.`,
      `${diff.index + 1}번째 글자 근처부터 다시 또박또박 말해 보세요.`,
      `정답 기준: ${diff.expectedTail}`,
      `인식 결과: ${diff.actualTail}`,
      flow.hasFlowIssue
        ? `이번에는 중간에 끊지 말고 짧게 한 번에 말해 보세요.`
        : ``,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return `🎯 천천히 다시\n🗣️ ${answer} 를 보고 또박또박, 하지만 끊지 말고 한 번에 말해 보세요.`;
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
      "한자보다 히라가나 표기를 우선해 주세요.",
      "정답과 같은 발음이면 가능한 한 히라가나로 적어 주세요.",
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

    // 핵심:
    // 표시용 transcript는 원본 그대로 두고,
    // 점수/피드백용은 무조건 히라가나 기준 문자열로 통일
    const scoringTranscript = answerYomi
      ? hiraganizeByAnswerMap(transcript, answerJp, answerYomi)
      : toReadingLike(transcript);

    const expectedReading = toReadingLike(answerYomi || answerJp);
    const actualReading = scoringTranscript;

    const scoreAgainstYomi = answerYomi
      ? similarityScore(scoringTranscript, answerYomi)
      : 0;

    const scoreAgainstJp = similarityScore(scoringTranscript, answerJp);

    const score = answerYomi ? scoreAgainstYomi : scoreAgainstJp;

    const feedback = makeDetailedFeedback(
      score,
      answerJp,
      transcript,
      expectedReading,
      actualReading
    );

    return Response.json({
      transcript,
      transcript_for_scoring: scoringTranscript,
      score,
      feedback,
      model: TRANSCRIBE_MODEL,
      expected_reading: expectedReading,
      actual_reading: actualReading,
      score_against_yomi: scoreAgainstYomi,
      score_against_jp: scoreAgainstJp,
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