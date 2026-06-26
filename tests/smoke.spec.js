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

test.describe('뭐냐면 — 기본 구조 스모크 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('앱 제목이 보인다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '뭐냐면' })).toBeVisible();
  });

  test('조사 주제 입력창에 입력할 수 있다', async ({ page }) => {
    const topicInput = page.getByTestId('topic-input');
    await expect(topicInput).toBeVisible();
    await topicInput.fill('세종대왕');
    await expect(topicInput).toHaveValue('세종대왕');
  });

  test('조사자료 입력창에 입력할 수 있다', async ({ page }) => {
    const sourceTextarea = page.getByTestId('source-textarea');
    await expect(sourceTextarea).toBeVisible();
    await sourceTextarea.fill('세종대왕은 조선의 4대 왕으로 훈민정음을 만들었다.');
    await expect(sourceTextarea).toHaveValue('세종대왕은 조선의 4대 왕으로 훈민정음을 만들었다.');
  });

  test('"분석 시작" 버튼이 보인다', async ({ page }) => {
    await expect(page.getByTestId('analyze-button')).toBeVisible();
    await expect(page.getByTestId('analyze-button')).toHaveText('분석 시작');
  });

  test('분석 후 학습 모드(이해/탐구/발표/글쓰기)를 선택할 수 있다', async ({ page }) => {
    // 실제 OpenAI API는 호출하지 않고 /api/chat 응답만 가로채서 가짜 결과로 대체한다.
    await mockChatApi(page);

    await page.getByTestId('topic-input').fill('세종대왕');
    await page
      .getByTestId('source-textarea')
      .fill('세종대왕은 조선의 4대 왕으로, 훈민정음을 만들어 백성들이 글을 쉽게 배울 수 있도록 했다.');
    await page.getByTestId('analyze-button').click();

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
});
