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
 * 최소 규칙만 유지
 * - STT가 자주 한자로 뽑는 핵심 단어만 보정
 * - 문장 규칙은 꼭 필요한 것만
 */
const PHRASE_READING_RULES: Array<[string, string]> = [
  ["また来たくなると思います", "またきたくなるとおもいます"],
  ["来たくなると思います", "きたくなるとおもいます"],
  ["思ったより気楽に入れました", "おもったよりきらくにはいれました"],
  ["行ってみたいです", "いってみたいです"],
  ["いいと思います", "いいとおもいます"],
  ["そう思います", "そうおもいます"],
];

const WORD_READING_RULES: Array<[string, string]> = [
  ["思った", "おもった"],
  ["思います", "おもいます"],
  ["思う", "おもう"],
  ["来たくなる", "きたくなる"],
  ["来たい", "きたい"],
  ["来ます", "きます"],
  ["来る", "くる"],
  ["気楽", "きらく"],
  ["入れました", "はいれました"],
  ["入ります", "はいります"],
  ["入れる", "はいれる"],
  ["入る", "はいる"],
  ["良かった", "よかった"],
  ["良い", "いい"],
  ["行きたい", "いきたい"],
  ["行きます", "いきます"],
  ["行く", "いく"],
  ["雰囲気", "ふんいき"],
];

function applyReadingRules(text: string) {
  let out = String(text || "");

  for (const [from, to] of PHRASE_READING_RULES) {
    out = out.replace(new RegExp(escapeRegExp(from), "g"), to);
  }

  for (const [from, to] of WORD_READING_RULES) {
    out = out.replace(new RegExp(escapeRegExp(from), "g"), to);
  }

  return out;
}

function replaceCommonVariants(text: string) {
  return normJpLoose(applyReadingRules(text))
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

function similarityScore(a: string, b: string, gate = 0.15, floorToZero = 15) {
  const aStrict = normJp(a);
  const bStrict = normJp(b);

  if (!aStrict || !bStrict) return 0;

  const aLoose = normJpLoose(a);
  const bLoose = normJpLoose(b);

  const aRead = toReadingLike(a);
  const bRead = toReadingLike(b);

  // 읽기 기준 완전 일치면 100
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

  // 발음 기준을 가장 강하게 반영
  const weighted = Math.round(
    scoreStrict * 0.05 + scoreLoose * 0.10 + scoreRead * 0.85
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

    const name =
      inputFile instanceof File && inputFile.name
        ? inputFile.name
        : "speech.wav";

    const prompt = [
      "다음 일본어 음성을 전사하세요.",
      "가능하면 히라가나 중심으로 전사하세요.",
      "동음이의어 한자가 가능하면 정답 문장에 가까운 표기를 우선하세요.",
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

    // 정답은 yomi 기준이 핵심
    const scoreAgainstYomi = answerYomi
      ? similarityScore(transcript, answerYomi)
      : 0;

    // 참고용으로 jp도 비교
    const scoreAgainstJp = similarityScore(transcript, answerJp);

    // 둘 중 높은 점수 반영
    const score = Math.max(scoreAgainstYomi, scoreAgainstJp);
    const feedback = makeFeedback(score, answerJp, transcript);

    return Response.json({
      transcript,
      score,
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