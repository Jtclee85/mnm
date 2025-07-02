import OpenAI from "openai";

// 스트리밍 응답을 위한 Edge Runtime 설정
export const config = {
  runtime: 'edge',
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  const { messages } = await req.json();

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      stream: true, // ✨ 스트리밍 옵션 활성화
    });

    // Node.js의 ReadableStream을 웹 표준 ReadableStream으로 변환
    const webStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            // 클라이언트에 보낼 데이터 인코딩
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
        'X-Accel-Buffering': 'no', // Nginx 등 리버스 프록시의 버퍼링 방지
      },
    });

  } catch (error) {
    console.error("OpenAI API 호출 오류:", error);
    return new Response(JSON.stringify({ error: 'API request failed' }), { status: 500 });
  }
}
