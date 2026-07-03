const { test, expect } = require('@playwright/test');

// 분석 모드 4개(이해/탐구/발표/글쓰기)가 모두 화면에 그려질 수 있도록
// parseSectionedResponse가 인식하는 태그를 두루 채운 가짜 분석 결과.
const FAKE_ANALYSIS_TEXT = `
<easy>이것은 테스트용 쉬운 설명입니다.</easy>
<summary>핵심 내용 1
핵심 내용 2</summary>
<keywords>키워드1
키워드2</keywords>
<vocabulary>낱말1: 설명
낱말2: 설명</vocabulary>
<questions>질문1
질문2</questions>
<searches>검색어1
검색어2</searches>
<reteach>다시 설명1
다시 설명2</reteach>
<further>더 알아보기1
더 알아보기2</further>
<presentation_title>테스트 발표 제목</presentation_title>
<presentation_script>발표 대본1
발표 대본2</presentation_script>
<presentation_order>발표 순서1
발표 순서2</presentation_order>
<expected_questions>예상 질문1
예상 질문2</expected_questions>
<writing_outline>[처음]
- 도입
[가운데]
- 핵심
[끝]
- 마무리</writing_outline>
`;

// 실제 앱(pages/index.js requestStream)이 기대하는 SSE 포맷:
// "data: <JSON 문자열 청크>\n\n" 라인들의 연속.
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

async function mockChatApi(page) {
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: FAKE_SSE_BODY,
    })
  );
}

// 실제 OpenAI API는 호출하지 않고 /api/chat 응답만 가로채서 분석을 끝까지 진행시킨다.
async function runAnalysis(page) {
  await mockChatApi(page);
  await page.getByTestId('topic-input').fill('세종대왕');
  await page
    .getByTestId('source-textarea')
    .fill('세종대왕은 조선의 4대 왕으로, 훈민정음을 만들어 백성들이 글을 쉽게 배울 수 있도록 했다.');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('result-canvas')).toBeVisible();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// 이 프로젝트의 주 사용 환경은 1920×1080 PC/교실 환경이다 (모바일은 보조 환경).
// 아래 스위트는 그 기준에서 앱의 기본 구조가 살아 있는지 확인한다.
test.describe('뭐냐면 — desktop-1920 기준 스모크 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[desktop-1920] 앱 제목이 보인다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '뭐냐면' })).toBeVisible();
  });

  test('[desktop-1920] 조사 주제 입력창에 입력할 수 있다', async ({ page }) => {
    const topicInput = page.getByTestId('topic-input');
    await expect(topicInput).toBeVisible();
    await topicInput.fill('세종대왕');
    await expect(topicInput).toHaveValue('세종대왕');
  });

  test('[desktop-1920] 조사자료 입력창에 입력할 수 있다', async ({ page }) => {
    const sourceTextarea = page.getByTestId('source-textarea');
    await expect(sourceTextarea).toBeVisible();
    await sourceTextarea.fill('세종대왕은 조선의 4대 왕으로 훈민정음을 만들었다.');
    await expect(sourceTextarea).toHaveValue('세종대왕은 조선의 4대 왕으로 훈민정음을 만들었다.');
  });

  test('[desktop-1920] "분석 시작" 버튼이 보인다', async ({ page }) => {
    await expect(page.getByTestId('analyze-button')).toBeVisible();
    await expect(page.getByTestId('analyze-button')).toHaveText('분석 시작');
  });

  test('[desktop-1920] 저장된 조사 기록을 삭제할 수 있다', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('mnm-sessions', JSON.stringify({
        세종대왕: {
          topic: '세종대왕',
          sourceText: '훈민정음 조사자료',
          language: 'ko',
          activeMode: 'understand',
          conversation: [],
          analysisByMode: {},
          toolResults: {},
          updatedAt: new Date().toISOString(),
        },
      }));
      localStorage.setItem('mnm-student-notes', JSON.stringify({
        세종대왕: { understand: { summary: '옛 메모' } },
      }));
    });
    await page.reload();

    await page.getByRole('button', { name: '세종대왕', exact: true }).click();
    await expect(page.getByTestId('topic-input')).toHaveValue('세종대왕');

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '세종대왕 조사 기록 삭제' }).click();

    await expect(page.getByRole('button', { name: '세종대왕', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('topic-input')).toHaveValue('');

    const stored = await page.evaluate(() => ({
      sessions: JSON.parse(localStorage.getItem('mnm-sessions') || '{}'),
      notes: JSON.parse(localStorage.getItem('mnm-student-notes') || '{}'),
    }));
    expect(stored.sessions.세종대왕).toBeUndefined();
    expect(stored.notes.세종대왕).toBeUndefined();
  });

  test('[desktop-1920] 분석 후 학습 모드(이해/탐구/발표/글쓰기)를 선택할 수 있다', async ({ page }) => {
    await runAnalysis(page);

    const understandTab = page.getByTestId('mode-tab-understand');
    await expect(understandTab).toBeVisible();
    await expect(understandTab).toHaveAttribute('aria-selected', 'true');

    for (const mode of ['inquiry', 'presentation', 'writing']) {
      const tab = page.getByTestId(`mode-tab-${mode}`);
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('[desktop-1920] 분석 후 좌우 2단(왼쪽 입력/대화 패널, 오른쪽 결과 캔버스) 레이아웃이 보인다', async ({ page }) => {
    await runAnalysis(page);

    const leftPanel = page.getByTestId('left-panel');
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(leftPanel).toBeVisible();
    await expect(resultCanvas).toBeVisible();

    const leftBox = await leftPanel.boundingBox();
    const resultBox = await resultCanvas.boundingBox();

    // 좌측 패널이 결과 캔버스보다 왼쪽에서 시작하고, 두 영역이 가로로 겹치지 않아야
    // "좌우 2단" 레이아웃이라고 할 수 있다(세로로 쌓이는 모바일 레이아웃과 구분).
    expect(leftBox.x).toBeLessThan(resultBox.x);
    expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(resultBox.x + 1);

    // 참고: 추후 사이드 도움말 패널을 추가한다면, 1920×1080에서는 이 결과 캔버스의
    // 오른쪽(또는 그 우측에 세 번째 컬럼)으로 안정적으로 배치되어야 하며,
    // 이 테스트가 검증하는 "좌-우 비겹침" 전제를 그대로 따라야 한다.
  });

  test('[desktop-1920] 기본 설정/결과/후속 질문 카드 영역이 서로 겹치지 않는다', async ({ page }) => {
    await runAnalysis(page);

    // SectionCard는 좌측 패널(후속 질문 영역 포함)과 결과 캔버스 양쪽에서
    // 공통으로 쓰이는 카드 단위이므로, 화면에 보이는 모든 카드를 한 번에 검사한다.
    const cards = await page.getByTestId('section-card').all();
    const boxes = [];
    for (const card of cards) {
      if (await card.isVisible()) {
        const box = await card.boundingBox();
        if (box) boxes.push(box);
      }
    }

    expect(boxes.length).toBeGreaterThan(0);

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(rectsOverlap(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  test('[desktop-1920] 주요 버튼(자료 분석 시작/결과 복사/퀴즈 만들기)이 보이고 클릭 가능하다', async ({ page }) => {
    await expect(page.getByTestId('analyze-button')).toBeEnabled();

    await runAnalysis(page);

    const copyButton = page.getByTestId('copy-easy-button');
    await expect(copyButton).toBeVisible();
    await expect(copyButton).toBeEnabled();

    const quizButton = page.getByTestId('tool-quiz');
    await expect(quizButton).toBeVisible();
    await expect(quizButton).toBeEnabled();
  });
});
