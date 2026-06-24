import OpenAI from "openai";

export const config = {
  runtime: 'edge',
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-5.4-mini";
const MAX_SOURCE_CHARS = 6000;
const MAX_CONVERSATION_CHARS = 2500;

const jsonHeaders = { 'Content-Type': 'application/json' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: jsonHeaders });
  }

  const { topic = '', sourceText = '', userText = '', conversation = [] } = await req.json();
  const trimmedTopic = String(topic).trim();
  const trimmedSource = String(sourceText).trim();
  const trimmedUserText = String(userText).trim();

  if (!trimmedTopic || !trimmedSource || !trimmedUserText) {
    return new Response(
      JSON.stringify({
        relevant: false,
        reason: 'missing_context',
        redirect: '먼저 조사 주제와 자료를 확인한 뒤, 조사 주제와 관련된 질문을 해 줘.',
      }),
      { status: 200, headers: jsonHeaders }
    );
  }

  try {
    const modResult = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: trimmedUserText,
    });

    if (modResult.results[0]?.flagged) {
      return new Response(
        JSON.stringify({
          relevant: false,
          reason: 'moderation_flagged',
          redirect: '그 내용은 학습 대화로 이어가기 어려워. 조사 주제와 자료를 바탕으로 다시 질문해 줘.',
        }),
        { status: 200, headers: jsonHeaders }
      );
    }
  } catch (error) {
    console.error('Moderation API error in relevance guard:', error);
    return new Response(
      JSON.stringify({
        relevant: false,
        reason: 'moderation_unavailable',
        redirect: '질문을 안전하게 확인하는 중 문제가 생겼어. 잠시 뒤 조사 주제와 관련된 질문으로 다시 물어봐 줘.',
      }),
      { status: 200, headers: jsonHeaders }
    );
  }

  const recentConversation = Array.isArray(conversation)
    ? conversation
        .slice(-6)
        .map(msg => `${msg?.role === 'user' ? '학생' : '도우미'}: ${String(msg?.content || '').slice(0, 500)}`)
        .join('\n')
        .slice(0, MAX_CONVERSATION_CHARS)
    : '';

  const sourceExcerpt = trimmedSource.slice(0, MAX_SOURCE_CHARS);

  try {
    const result = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: [
            '너는 초등 사회과 조사학습 AI 코스웨어의 주제 이탈 감지기다.',
            '학생 질문이 현재 조사 주제, 원본 자료, 분석 결과, 발표 준비, 글쓰기, 탐구 확장과 실질적으로 관련 있는지 판정한다.',
            '허용: 조사 주제 직접 질문, 원본 자료 내용, 관련 배경지식, 관련 인물/장소/시대/개념, 발표/글쓰기 도움, 최근 대화의 맥락을 잇는 질문.',
            '차단: K-POP, 연예인, 게임, 만화, 친구 이야기, 잡담, 현재 조사 주제와 연결되지 않는 다른 주제.',
            '애매하지만 학생이 조사 주제와 연결하려는 의도가 보이면 relevant=true로 판정한다.',
            '차단할 때 redirect는 다정하고 짧게, 조사 주제로 돌아오도록 안내한다.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `[조사 주제]\n${trimmedTopic}`,
            `[원본 자료 발췌]\n${sourceExcerpt}`,
            `[최근 대화]\n${recentConversation || '없음'}`,
            `[학생 질문]\n${trimmedUserText}`,
            '위 학생 질문이 현재 조사학습과 관련 있으면 relevant=true, 아니면 false로 판정해라.',
          ].join('\n\n'),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'relevance_result',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              relevant: { type: 'boolean' },
              reason: { type: 'string' },
              redirect: { type: 'string' },
            },
            required: ['relevant', 'reason', 'redirect'],
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return new Response(
      JSON.stringify({
        relevant: parsed.relevant === true,
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        redirect: typeof parsed.redirect === 'string' && parsed.redirect.trim()
          ? parsed.redirect
          : '그 질문은 지금 조사 주제와는 조금 멀어 보여. 오른쪽 결과에서 궁금한 낱말이나 사건을 골라 물어봐!',
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    console.error('Relevance guard error:', error);
    return new Response(
      JSON.stringify({
        relevant: false,
        reason: 'relevance_check_failed',
        redirect: '질문이 조사 주제와 관련 있는지 확인하지 못했어. 오른쪽 결과와 관련된 질문으로 다시 물어봐 줘.',
      }),
      { status: 200, headers: jsonHeaders }
    );
  }
}
