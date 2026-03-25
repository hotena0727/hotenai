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
    .replace(/[、。．，,！？!？?「」『』（）()\[\]{}…~"'`´]/g, "");
}

function normalizeJapaneseVariantSurface(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/友だち/g, "友達")
    .replace(/こども/g, "子供")
    .replace(/子ども/g, "子供")
    .replace(/下さい/g, "ください")
    .replace(/マンガ/g, "漫画")
    .replace(/まんが/g, "漫画")
    .replace(/ときどき/g, "時々")
    .replace(/ほんとう/g, "本当")
    .replace(/いっしょ/g, "一緒")
    .replace(/すし/g, "寿司")
    .replace(/ほう/g, "方")
    .replace(/あとで/g, "後で");
}

function normalizeForSurfaceMatch(text: string) {
  return normalizeJapaneseVariantSurface(text)
    .replace(/[\s\u3000]+/g, "")
    .replace(/[、。．，,！？!？?「」『』（）()\[\]{}…~"'`´]/g, "");
}

function hasEndingMismatch(expectedReading: string, transcriptReading: string) {
  const a = String(expectedReading || "");
  const b = String(transcriptReading || "");

  if (!a || !b) return false;

  const tailLens = [4, 3, 2];

  for (const len of tailLens) {
    if (a.length >= len && b.length >= len) {
      const aTail = a.slice(-len);
      const bTail = b.slice(-len);
      if (aTail !== bTail) return true;
      return false;
    }
  }

  return false;
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

function normalizeJapaneseCountersToReading(text: string) {
  return String(text || "")
    .normalize("NFKC")

    // ヶ月 / か月 / カ月 / ヵ月
    .replace(/12(?:ヶ月|か月|カ月|ヵ月)|十二(?:ヶ月|か月|カ月|ヵ月)/g, "じゅうにかげつ")
    .replace(/11(?:ヶ月|か月|カ月|ヵ月)|十一(?:ヶ月|か月|カ月|ヵ月)/g, "じゅういっかげつ")
    .replace(/10(?:ヶ月|か月|カ月|ヵ月)|十(?:ヶ月|か月|カ月|ヵ月)/g, "じゅっかげつ")
    .replace(/9(?:ヶ月|か月|カ月|ヵ月)|九(?:ヶ月|か月|カ月|ヵ月)/g, "きゅうかげつ")
    .replace(/8(?:ヶ月|か月|カ月|ヵ月)|八(?:ヶ月|か月|カ月|ヵ月)/g, "はっかげつ")
    .replace(/7(?:ヶ月|か月|カ月|ヵ月)|七(?:ヶ月|か月|カ月|ヵ月)/g, "ななかげつ")
    .replace(/6(?:ヶ月|か月|カ月|ヵ月)|六(?:ヶ月|か月|カ月|ヵ月)/g, "ろっかげつ")
    .replace(/5(?:ヶ月|か月|カ月|ヵ月)|五(?:ヶ月|か月|カ月|ヵ月)/g, "ごかげつ")
    .replace(/4(?:ヶ月|か月|カ月|ヵ月)|四(?:ヶ月|か月|カ月|ヵ月)/g, "よんかげつ")
    .replace(/3(?:ヶ月|か月|カ月|ヵ月)|三(?:ヶ月|か月|カ月|ヵ月)/g, "さんかげつ")
    .replace(/2(?:ヶ月|か月|カ月|ヵ月)|二(?:ヶ月|か月|カ月|ヵ月)/g, "にかげつ")
    .replace(/1(?:ヶ月|か月|カ月|ヵ月)|一(?:ヶ月|か月|カ月|ヵ月)/g, "いっかげつ")

    // 回
    .replace(/12回|十二回/g, "じゅうにかい")
    .replace(/11回|十一回/g, "じゅういっかい")
    .replace(/10回|十回/g, "じゅっかい")
    .replace(/9回|九回/g, "きゅうかい")
    .replace(/8回|八回/g, "はっかい")
    .replace(/7回|七回/g, "ななかい")
    .replace(/6回|六回/g, "ろっかい")
    .replace(/5回|五回/g, "ごかい")
    .replace(/4回|四回/g, "よんかい")
    .replace(/3回|三回/g, "さんかい")
    .replace(/2回|二回/g, "にかい")
    .replace(/1回|一回/g, "いっかい")

    // 人
    .replace(/10人|十人/g, "じゅうにん")
    .replace(/9人|九人/g, "きゅうにん")
    .replace(/8人|八人/g, "はちにん")
    .replace(/7人|七人/g, "しちにん")
    .replace(/6人|六人/g, "ろくにん")
    .replace(/5人|五人/g, "ごにん")
    .replace(/4人|四人/g, "よにん")
    .replace(/3人|三人/g, "さんにん")
    .replace(/2人|二人/g, "ふたり")
    .replace(/1人|一人/g, "ひとり")

    // 時間
    .replace(/24時間|二十四時間/g, "にじゅうよじかん")
    .replace(/12時間|十二時間/g, "じゅうにじかん")
    .replace(/11時間|十一時間/g, "じゅういちじかん")
    .replace(/10時間|十時間/g, "じゅうじかん")
    .replace(/9時間|九時間/g, "くじかん")
    .replace(/8時間|八時間/g, "はちじかん")
    .replace(/7時間|七時間/g, "しちじかん")
    .replace(/6時間|六時間/g, "ろくじかん")
    .replace(/5時間|五時間/g, "ごじかん")
    .replace(/4時間|四時間/g, "よじかん")
    .replace(/3時間|三時間/g, "さんじかん")
    .replace(/2時間|二時間/g, "にじかん")
    .replace(/1時間|一時間/g, "いちじかん")

    // 分
    .replace(/45分|四十五分/g, "よんじゅうごふん")
    .replace(/30分|三十分/g, "さんじゅっぷん")
    .replace(/25分|二十五分/g, "にじゅうごふん")
    .replace(/20分|二十分/g, "にじゅっぷん")
    .replace(/15分|十五分/g, "じゅうごふん")
    .replace(/12分|十二分/g, "じゅうにふん")
    .replace(/11分|十一分/g, "じゅういっぷん")
    .replace(/10分|十分/g, "じゅっぷん")
    .replace(/9分|九分/g, "きゅうふん")
    .replace(/8分|八分/g, "はっぷん")
    .replace(/7分|七分/g, "ななふん")
    .replace(/6分|六分/g, "ろっぷん")
    .replace(/5分|五分/g, "ごふん")
    .replace(/4分|四分/g, "よんぷん")
    .replace(/3分|三分/g, "さんぷん")
    .replace(/2分|二分/g, "にふん")
    .replace(/1分|一分/g, "いっぷん")

    // 日
    .replace(/24日|二十四日/g, "にじゅうよっか")
    .replace(/20日|二十日/g, "はつか")
    .replace(/14日|十四日/g, "じゅうよっか")
    .replace(/10日|十日/g, "とおか")
    .replace(/9日|九日/g, "ここのか")
    .replace(/8日|八日/g, "ようか")
    .replace(/7日|七日/g, "なのか")
    .replace(/6日|六日/g, "むいか")
    .replace(/5日|五日/g, "いつか")
    .replace(/4日|四日/g, "よっか")
    .replace(/3日|三日/g, "みっか")
    .replace(/2日|二日/g, "ふつか")
    .replace(/1日|一日/g, "ついたち")

    // 月
    .replace(/12月|十二月/g, "じゅうにがつ")
    .replace(/11月|十一月/g, "じゅういちがつ")
    .replace(/10月|十月/g, "じゅうがつ")
    .replace(/9月|九月/g, "くがつ")
    .replace(/8月|八月/g, "はちがつ")
    .replace(/7月|七月/g, "しちがつ")
    .replace(/6月|六月/g, "ろくがつ")
    .replace(/5月|五月/g, "ごがつ")
    .replace(/4月|四月/g, "しがつ")
    .replace(/3月|三月/g, "さんがつ")
    .replace(/2月|二月/g, "にがつ")
    .replace(/1月|一月/g, "いちがつ")

    // 年
    .replace(/10年|十年/g, "じゅうねん")
    .replace(/9年|九年/g, "きゅうねん")
    .replace(/8年|八年/g, "はちねん")
    .replace(/7年|七年/g, "しちねん")
    .replace(/6年|六年/g, "ろくねん")
    .replace(/5年|五年/g, "ごねん")
    .replace(/4年|四年/g, "よねん")
    .replace(/3年|三年/g, "さんねん")
    .replace(/2年|二年/g, "にねん")
    .replace(/1年|一年/g, "いちねん");
}

function replaceCommonVariants(text: string) {
  return normJpForReading(text)
    .replace(/ふいんき/g, "ふんいき")
    .replace(/を/g, "お")
    .replace(/にほん/g, "にっぽん")
    .replace(/こんにちわ/g, "こんにちは")
    .replace(/わたしわ/g, "わたしは")
    .replace(/youtube/g, "ゆーちゅーぶ")
    .replace(/ゆうちゅうぶ/g, "ゆーちゅーぶ")
    .replace(/ゆーつーぶ/g, "ゆーちゅーぶ")
    .replace(/ゆーちゅぶ/g, "ゆーちゅーぶ");
}

function toReadingLike(text: string) {
  return replaceCommonVariants(
    normalizeJapaneseCountersToReading(text)
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

/**
 * 흐름 평가는 최소한만 반영
 * - filler
 * - 토큰 반복
 */
function analyzeSpeechFlow(rawTranscript: string, _normalizedReading: string) {
  const raw = String(rawTranscript || "").trim();

  const fillerCount = countOccurrences(
    raw,
    /(えっと|ええと|うーん|えーと)/g
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

    const normalizedAnswerSurface = normalizeForSurfaceMatch(answerJp);
    const normalizedTranscriptSurface = normalizeForSurfaceMatch(transcript);

    const isSameSurface =
      normalizedAnswerSurface === normalizedTranscriptSurface;

    const endingMismatch = isSameSurface
      ? false
      : hasEndingMismatch(expectedReading, transcriptReading);

    const shouldAdoptExpectedYomi =
      !hasCriticalMismatch &&
      !endingMismatch &&
      (
        (hasKanji(transcript) && rawSurfaceScore >= 88) ||
        (!hasKanji(transcript) && scoreByDistance(transcriptReading, expectedReading) >= 96)
      );

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

function getRecommendedSeconds(answerYomi: string, answerJp: string) {
  const base = String(answerYomi || answerJp || "").trim();
  const len = Array.from(base).length;

  if (len <= 8) return 3;
  if (len <= 14) return 4;
  if (len <= 20) return 5;
  if (len <= 28) return 6;
  return 7;
}

function estimateSlowSpeechPenalty(
  durationMs: number,
  expectedReading: string,
  answerYomi: string,
  answerJp: string
) {
  if (!durationMs || !expectedReading) {
    return {
      penalty: 0,
      cps: 0,
      isSlow: false,
      recommendedSec: 0,
      actualSec: 0,
      overtimeSec: 0,
    };
  }

  const seconds = durationMs / 1000;
  if (seconds <= 0) {
    return {
      penalty: 0,
      cps: 0,
      isSlow: false,
      recommendedSec: 0,
      actualSec: 0,
      overtimeSec: 0,
    };
  }

  const readingLen = Array.from(expectedReading).length;
  const cps = readingLen / seconds;
  const recommendedSec = getRecommendedSeconds(answerYomi, answerJp);
  const overtimeSec = Math.max(0, seconds - recommendedSec);

  let penalty = 0;

  // 1) 권장 시간 초과 감점: 기준보다 늦으면 바로 체감되게
  if (overtimeSec > 0) {
    penalty += Math.ceil(overtimeSec) * 8;
  }

  // 2) 너무 느린 말속도는 추가 감점
  if (cps < 1.2) {
    penalty += 12;
  } else if (cps < 1.5) {
    penalty += 8;
  } else if (cps < 1.8) {
    penalty += 4;
  }

  return {
    penalty,
    cps,
    isSlow: penalty > 0,
    recommendedSec,
    actualSec: seconds,
    overtimeSec,
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
  const slow = estimateSlowSpeechPenalty(
    durationMs,
    expectedReading,
    answerYomi,
    answerJp
  );

  if (expectedReading === actualReading) {
    const overtimeOnlyPenalty = Math.max(
      0,
      Math.ceil(slow.overtimeSec) * 3
    );

    const totalPenalty = flow.penalty + overtimeOnlyPenalty;

    return {
      score: Math.max(95, 100 - totalPenalty),
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
      "절대로 번역하지 말고, 들린 일본어를 그대로 전사하세요.",
      "출력은 반드시 일본어로만 하세요. 한국어, 영어 번역은 하지 마세요.",
      "가능하면 히라가나 중심으로 전사하세요.",
      `정답 문장 후보: ${answerJp}`,
      answerYomi ? `정답 읽기 후보: ${answerYomi}` : "",
      "음성이 정답 문장 후보와 비슷하게 들리면, 그 문장에 가까운 일본어 표기로 전사하세요.",
      "들리지 않거나 확실하지 않으면 추측하지 말고 짧게 전사하세요.",
    ]
      .filter(Boolean)
      .join("\n");

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

    const slow = estimateSlowSpeechPenalty(
      durationMs,
      judged.expectedReading,
      answerYomi,
      answerJp
    );

    const debug = {
      answerJp,
      answerYomi,
      transcript,
      expectedReading: judged.expectedReading,
      actualReading: judged.actualReading,
      expectedEqActual: judged.expectedReading === judged.actualReading,
      surfaceScore: judged.surfaceScore,
      answerSurfaceScore: scoreByDistance(
        normalizeForSurfaceMatch(transcript),
        normalizeForSurfaceMatch(answerJp)
      ),
      slowPenalty: slow.penalty,
      slowCps: slow.cps,
      slowOvertimeSec: slow.overtimeSec,
      flowPenalty: analyzeSpeechFlow(transcript, judged.actualReading).penalty,
    };

    return Response.json({
      transcript: judged.displayTranscript,
      rawTranscript: transcript,
      displayAsAnswer: judged.displayAsAnswer,
      score: judged.score,
      feedback,
      model: TRANSCRIBE_MODEL,
      debug,
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