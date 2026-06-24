import OpenAI from "openai";

export const config = {
  runtime: 'edge',
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 접근 불가 시 'gpt-5-mini' 또는 기존 'gpt-4o-mini'로 폴백 가능
const MODEL = "gpt-5.4-mini";

// 한국어 기준 약 7,500 토큰 이내로 제어 (시스템 프롬프트 포함)
const MAX_TOTAL_CHARS = 15000;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  const { messages } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: '잘못된 요청입니다.' }), { status: 400 });
  }

  const totalChars = messages.reduce(
    (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
    0
  );

  if (totalChars > MAX_TOTAL_CHARS) {
    return new Response(
      JSON.stringify({ error: '입력 자료가 너무 깁니다. 조사자료를 짧게 줄여 주세요.' }),
      { status: 400 }
    );
  }

  // 마지막 user 메시지만 검사 (시스템 프롬프트·이전 대화는 이미 통제된 내용)
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const inputText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

  if (inputText.length >= 2) {
    try {
      const modResult = await openai.moderations.create({
        model: 'omni-moderation-latest',
        input: inputText,
      });

      if (modResult.results[0]?.flagged) {
        return new Response(
          JSON.stringify({
            error: '앗, 이 내용은 학습 도우미가 다루기 어려운 내용이에요. 조사 주제나 자료를 다시 한 번 확인해 줄래?',
          }),
          { status: 400 }
        );
      }
    } catch (modError) {
      // fail-open: moderation 호출 실패 시 수업 흐름을 멈추지 않고 통과.
      // 보안을 강화하려면 여기서 400을 반환하는 fail-closed로 변경할 것.
      console.error("Moderation API 호출 오류 (통과 처리):", modError);
    }
  }

  try {
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
    });

    const webStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            const encoded = new TextEncoder().encode(`data: ${JSON.stringify(delta)}\n\n`);
            controller.enqueue(encoded);
          }
        }
        controller.close();
      },
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error) {
    console.error("OpenAI API 호출 오류:", error);

    if (error?.status === 429) {
      return new Response(
        JSON.stringify({ error: '지금 너무 많이 사용 중이에요. 잠시 후 다시 시도해 주세요.' }),
        { status: 429 }
      );
    }

    return new Response(JSON.stringify({ error: '오류가 발생했습니다. 다시 시도해 주세요.' }), { status: 500 });
  }
}
