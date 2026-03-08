export const runtime = "nodejs";

function kataToHira(text: string) {
  return text.replace(/[ァ-ン]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function normJp(text: string) {
  return kataToHira(
    String(text || "")
      .normalize("NFKC")
      .replace(/[\s\u3000]+/g, "")
      .replace(/[、。．，,！？!？「」『』（）()\[\]{}…~\"'`´]/g, ""),
  ).toLowerCase();
}

function normJpLoose(text: string) {
  return normJp(text)
    .replace(/ー/g, "")
    .replace(/っ/g, "")
    .replace(/[ゃゅょぁぃぅぇぉゎ]/g, (ch) =>
      ({
        "ゃ": "や",
        "ゅ": "ゆ",
        "ょ": "よ",
        "ぁ": "あ",
        "ぃ": "い",
        "ぅ": "う",
        "ぇ": "え",
        "ぉ": "お",
        "ゎ": "わ",
      })[ch] || ch,
    );
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

function similarityScore(a: string, b: string, gate = 0.15, floorToZero = 15) {
  const aStrict = normJp(a);
  const bStrict = normJp(b);
  if (!aStrict || !bStrict) return 0;

  const aLoose = normJpLoose(a);
  const bLoose = normJpLoose(b);
  const bb = bigrams(bLoose);
  if (bb.size > 0) {
    const overlap = [...bigrams(aLoose)].filter((item) => bb.has(item)).length / Math.max(1, bb.size);
    if (overlap < gate) return 0;
  }

  const distS = levenshtein(aStrict, bStrict);
  const scoreS = 100 * (1 - distS / Math.max(aStrict.length, bStrict.length, 1));

  const distL = levenshtein(aLoose, bLoose);
  const scoreL = 100 * (1 - distL / Math.max(aLoose.length, bLoose.length, 1));

  const score = Math.round(0.75 * scoreS + 0.25 * scoreL);
  return score < floorToZero ? 0 : Math.max(0, Math.min(100, score));
}

function makeFeedback(score: number, answer: string, transcript: string) {
  if (score >= 100) return `🎯 아주 좋습니다\n🗣️ ${answer} 를 정확하게 말했어요.`;
  if (score >= 80) {
    return `🎯 좋습니다\n🗣️ ${transcript || answer} 에서 큰 흐름은 맞아요. ${answer} 를 한 번만 더 또렷하게 말해 보세요.`;
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
        { status: 500 },
      );
    }

    const TRANSCRIBE_MODEL =
      process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

    const form = await req.formData();
    const inputFile = form.get("file");
    const answerJp = String(form.get("answer_jp") || "").trim();

    if (
      !inputFile ||
      typeof inputFile !== "object" ||
      !("arrayBuffer" in inputFile)
    ) {
      return Response.json({ error: "녹음 파일이 없습니다." }, { status: 400 });
    }
    if (!answerJp) {
      return Response.json({ error: "정답 문장이 없습니다." }, { status: 400 });
    }

    const name = inputFile instanceof File && inputFile.name ? inputFile.name : "speech.wav";

    const fd = new FormData();
    fd.append("file", inputFile, name);
    fd.append("model", TRANSCRIBE_MODEL);
    fd.append("language", "ja");
    fd.append("response_format", "text");

    let sttRes: Response;
    try {
      sttRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Response.json({ error: `[전사 요청 실패] ${message}` }, { status: 500 });
    }

    const rawText = await sttRes.text();
    if (!sttRes.ok) {
      let message = rawText;
      try {
        const parsed = rawText ? JSON.parse(rawText) : {};
        message = String(parsed?.error?.message || rawText || "전사에 실패했습니다.");
      } catch {
        message = rawText || "전사에 실패했습니다.";
      }
      return Response.json(
        { error: `[전사 응답 오류 ${sttRes.status}] ${message}` },
        { status: 500 },
      );
    }

    const transcript = String(rawText || "").trim();
    const score = similarityScore(transcript, answerJp);
    const feedback = makeFeedback(score, answerJp, transcript);

    return Response.json({
      transcript,
      score,
      feedback,
      model: TRANSCRIBE_MODEL,
      debug: { fileName: name },
    });
  } catch (error) {
    console.error("talk-pron-score error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `[서버 내부 오류] ${message || "말하기 점수를 계산하지 못했습니다."}` },
      { status: 500 },
    );
  }
}
