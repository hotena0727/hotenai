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

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 긴 문장을 먼저 치환해야 중간에 잘리는 걸 줄일 수 있습니다.
 * 예: 来たくなると思います 를 먼저 잡고, 그 다음 思います 를 처리
 */
const PHRASE_READING_RULES: Array<[string, string]> = [
  ["また来たくなると思います", "またきたくなるとおもいます"],
  ["来たくなると思います", "きたくなるとおもいます"],
  ["行ってみたいです", "いってみたいです"],
  ["そう思います", "そうおもいます"],
  ["いいと思います", "いいとおもいます"],
];

/**
 * 회화 훈련에서 자주 나오는 표기 흔들림 보정
 * 필요할 때 여기만 추가하면 됩니다.
 */
const WORD_READING_RULES: Array<[string, string]> = [
  ["多分", "たぶん"],
  ["多い", "おおい"],
  ["思います", "おもいます"],
  ["思う", "おもう"],
  ["来たくなる", "きたくなる"],
  ["来たい", "きたい"],
  ["来ます", "きます"],
  ["来る", "くる"],
  ["行きたい", "いきたい"],
  ["行きます", "いきます"],
  ["行く", "いく"],
  ["見たい", "みたい"],
  ["見ます", "みます"],
  ["見る", "みる"],
  ["食べたい", "たべたい"],
  ["食べます", "たべます"],
  ["食べる", "たべる"],
  ["飲みたい", "のみたい"],
  ["飲みます", "のみます"],
  ["飲む", "のむ"],
  ["出来る", "できる"],
  ["出来ます", "できます"],
  ["良い", "いい"],
  ["大丈夫", "だいじょうぶ"],
  ["今日", "きょう"],
  ["明日", "あした"],
  ["昨日", "きのう"],
  ["本当", "ほんとう"],
  ["一人", "ひとり"],
  ["二人", "ふたり"],
  ["上手", "じょうず"],
  ["下手", "へた"],
  ["有名", "ゆうめい"],
  ["便利", "べんり"],
  ["簡単", "かんたん"],
  ["大変", "たいへん"],
  ["安心", "あんしん"],
  ["心配", "しんぱい"],
  ["大切", "たいせつ"],
  ["必要", "ひつよう"],
  ["自由", "じゆう"],
  ["時間", "じかん"],
  ["仕事", "しごと"],
  ["休み", "やすみ"],
  ["週末", "しゅうまつ"],
  ["雰囲気", "ふんいき"],
  ["ふいんき", "ふんいき"],
  ["通り", "とおり"],
  ["街", "まち"],
  ["町", "まち"],
];

function applyReadingRules(text: string) {
  let out = text;

  // 긴 표현 우선
  for (const [from, to] of PHRASE_READING_RULES) {
    out = out.replace(new RegExp(escapeRegExp(from), "g"), to);
  }

  // 그 다음 일반 단어
  for (const [from, to] of WORD_READING_RULES) {
    out = out.replace(new RegExp(escapeRegExp(from), "g"), to);
  }

  return out;
}

/**
 * 발음상 거의 같은데 표기만 흔들리는 대표 케이스를 완화
 * 이번 버전은 "치환 규칙 묶음" 기반으로 강화
 */
function replaceCommonVariants(text: string) {
  return applyReadingRules(text)
    .replace(/こんにちは/g, "こんにちは")
    .replace(/こんばんは/g, "こんばんは")
    .replace(/を/g, "お");
}

function toReadingLike(text: string) {
  return replaceCommonVariants(normJpLoose(text));
}

function bigrams(s: string) {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2));
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

function similarityScore(a: string, b: string, gate = 0.15, floorToZero = 15) {
  const aStrict = normJp(a);
  const bStrict = normJp(b);

  if (!aStrict || !bStrict) return 0;

  const aLoose = normJpLoose(a);
  const bLoose = normJpLoose(b);

  const aRead = toReadingLike(a);
  const bRead = toReadingLike(b);

  // 읽기 기준으로 완전히 같으면 바로 100점
  if (aRead && bRead && aRead === bRead) {
    return 100;
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

  /**
   * strict: 원문 일치
   * loose : 장음/촉음/소문자 흔들림 완화
   * read  : 한자/표기 차이 완화
   *
   * 회화 발음 채점은 read 비중을 더 높게 둡니다.
   */
  const weighted = Math.round(
    scoreStrict * 0.20 + scoreLoose * 0.15 + scoreRead * 0.65
  );

  return weighted < floorToZero
    ? 0
    : Math.max(0, Math.min(100, weighted));
}

function makeFeedback(score: number, answer: string, transcript: string) {
  if (score >= 100) {
    return `🎯 아주 좋습니다\n🗣️ ${answer} 를 정확하게 말했어요.`;
  }
  if (score >= 90) {
    return `🎯 좋습니다\n🗣️ 거의 정확합니다. ${answer} 를 한 번만 더 또렷하게 말해 보세요.`;
  }
  if (score >= 75) {
    return `🎯 좋습니다\n🗣️ ${transcript || answer} 에서 큰 흐름은 맞아요. 정답을 보며 한 번 더 또렷하게 말해 보세요.`;
  }
  if (score >= 50) {
    return `🎯 조금만 더\n🗣️ ${answer} 와 비슷하지만 몇 군데가 달라요. 정답을 보고 2~3번 따라 말해 보세요.`;
  }
  return `🎯 천천히 다시\n🗣️ ${answer} 를 보고 또박또박 2~3번 따라 말해 보세요.`;
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
      return Response.json(
        { error: "녹음 파일이 없습니다." },
        { status: 400 }
      );
    }

    if (!answerJp) {
      return Response.json(
        { error: "정답 문장이 없습니다." },
        { status: 400 }
      );
    }

    const scoringTarget = answerYomi || answerJp;

    const name =
      inputFile instanceof File && inputFile.name
        ? inputFile.name
        : "speech.wav";

    const fd = new FormData();
    fd.append("file", inputFile, name);
    fd.append("model", TRANSCRIBE_MODEL);
    fd.append("language", "ja");
    fd.append("response_format", "text");

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

    const transcript = String(rawText || "").trim();
    const score = similarityScore(transcript, scoringTarget);
    const feedback = makeFeedback(score, answerJp, transcript);

    return Response.json({
      transcript,
      score,
      feedback,
      model: TRANSCRIBE_MODEL,
      debug: {
        fileName: name,
        answer_jp: answerJp,
        answer_yomi: answerYomi,
        scoring_target: scoringTarget,
        strict_answer: normJp(scoringTarget),
        strict_transcript: normJp(transcript),
        loose_answer: normJpLoose(scoringTarget),
        loose_transcript: normJpLoose(transcript),
        read_answer: toReadingLike(scoringTarget),
        read_transcript: toReadingLike(transcript),
      },
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