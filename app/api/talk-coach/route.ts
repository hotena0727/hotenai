import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function fallbackMessage() {
  return "💬 지금은 답변이 조금 어려워요.\n조금 있다가 다시 물어봐 주세요 🙂\n(잠시 후 재시도)";
}

function normalizeParagraphs(text: string): string {
  const raw = String(text || "").trim();
  if (!raw) return fallbackMessage();

  const parts = raw
    .split(/\n\s*\n+/)
    .map((p) =>
      p
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return fallbackMessage();

  const splitSentences = (s: string) => {
    const chunks = s
      .split(/(?<=[。！？!?\.])\s+/)
      .map((x) => x.trim())
      .filter(Boolean);
    return chunks.length ? chunks : [s];
  };

  const caps = [1, 2];
  const capped = parts.map((p, i) => {
    const sents = splitSentences(p);
    const cap = caps[i] ?? 2;
    return sents.slice(0, cap).join(" ").trim();
  });

  let joined = capped.join("\n\n").trim();
  if (joined.length > 520) {
    joined = joined.slice(0, 520).trim();
  }
  return joined || fallbackMessage();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const question = String(body.question || "").trim();
    const context = String(body.context || "").trim();
    const plan = String(body.plan || "").trim().toLowerCase();

    if (!question) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }

    const systemPrompt = `
너는 하테나 일본어 회화 훈련의 AI 스마트코치다.

역할:
- 일본어 회화 답변이 맞는지 짧고 정확하게 피드백한다.
- 학습자를 불안하게 만들지 말고, 차분하고 친절하게 설명한다.
- 과장된 칭찬, 장황한 설명, 세일즈 문구는 피한다.

형식:
- 반드시 2문단으로 답한다.
- 1문단: 정답 여부 또는 핵심 문제를 1문장으로 짧게 설명
- 2문단: 왜 그런지, 또는 더 자연스러운 표현/대안을 최대 2문장으로 설명

스타일:
- 한국어 중심으로 설명한다.
- 필요한 경우 일본어 표현은 예시로 짧게 섞는다.
- 답변은 짧고 선명하게 유지한다.
- 불필요하게 많은 이모지는 쓰지 않는다.
`.trim();

    const userPrompt = `
질문:
${question}

회화 문맥:
${context}

추가 조건:
- 2문단만 작성
- 첫 문단은 핵심만
- 둘째 문단은 이유 또는 더 자연스러운 대안
- 너무 길게 쓰지 말 것
- 학습자가 바로 이해할 수 있게 답할 것
${plan === "pro" ? "- 현재 사용자는 PRO 플랜 사용자다." : ""}
`.trim();

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL_LOW || "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = response.output_text?.trim() || "";
    const answer = normalizeParagraphs(rawText);

    return Response.json({ answer });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        answer: fallbackMessage(),
        error: "AI 코치 응답 생성 중 오류가 발생했습니다.",
      },
      { status: 200 },
    );
  }
}
