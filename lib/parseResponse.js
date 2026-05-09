export const gradeLevelMap = {
  low: '초등 저학년',
  high: '초등 고학년',
  발표: '발표 준비용'
};

export const modeMap = {
  understand: '이해 모드',
  inquiry: '탐구 모드',
  presentation: '발표 준비 모드'
};

const extractTagBlock = (text, tag) => {
  if (!text) return '';
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
};

const splitLines = (text) => {
  if (!text) return [];
  return text
    .split(/\r?\n|•|·/g)
    .map((line) => line.trim())
    .filter(Boolean);
};

export const parseQuizBlock = (quizText) => {
  if (!quizText) return null;

  const lines = quizText
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);

  let question = '';
  let answer = '';
  let explanation = '';
  let options = [];
  let type = 'mcq';
  let inOptions = false;

  for (const line of lines) {
    if (/^문제\s*:/i.test(line)) {
      question = line.replace(/^문제\s*:/i, '').trim();
      continue;
    }
    if (/^선택지\s*:/i.test(line)) {
      inOptions = true;
      continue;
    }
    if (/^정답\s*:/i.test(line)) {
      inOptions = false;
      answer = line.replace(/^정답\s*:/i, '').trim();
      continue;
    }
    if (/^해설\s*:/i.test(line)) {
      inOptions = false;
      explanation = line.replace(/^해설\s*:/i, '').trim();
      continue;
    }
    if (inOptions) {
      const opt = line.replace(/^[0-9]+\.\s*/, '').trim();
      if (opt) options.push(opt);
    }
  }

  if (options.length === 2 && options.includes('O') && options.includes('X')) {
    type = 'ox';
  }

  if (!question && lines.length > 0) {
    question = lines[0];
  }

  // OX 퀴즈가 아닌 경우 선택지를 무작위로 섞고 정답 인덱스 갱신
  if (type !== 'ox' && options.length > 1) {
    const correctText = options[Math.max(0, parseInt(answer, 10) - 1)];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    answer = String(options.indexOf(correctText) + 1);
  }

  return { type, question, options, answer, explanation };
};

export const parseSectionedResponse = (rawText) => {
  const easy = extractTagBlock(rawText, 'easy');
  const summary = extractTagBlock(rawText, 'summary');
  const keywords = extractTagBlock(rawText, 'keywords');
  const vocabulary = extractTagBlock(rawText, 'vocabulary');
  const questions = extractTagBlock(rawText, 'questions');
  const searches = extractTagBlock(rawText, 'searches');
  const reteach = extractTagBlock(rawText, 'reteach');
  const further = extractTagBlock(rawText, 'further');
  const presentationTitle = extractTagBlock(rawText, 'presentation_title');
  const presentationScript = extractTagBlock(rawText, 'presentation_script');
  const presentationOrder = extractTagBlock(rawText, 'presentation_order');
  const expectedQuestions = extractTagBlock(rawText, 'expected_questions');
  const teacher = extractTagBlock(rawText, 'teacher');
  const quiz = extractTagBlock(rawText, 'quiz');
  const evaluation = extractTagBlock(rawText, 'evaluation');

  return {
    easy,
    summaryLines: splitLines(summary),
    keywordLines: splitLines(keywords),
    vocabularyLines: splitLines(vocabulary),
    questionLines: splitLines(questions),
    searchLines: splitLines(searches),
    reteachLines: splitLines(reteach),
    furtherLines: splitLines(further),
    presentationTitle,
    presentationScriptLines: splitLines(presentationScript),
    presentationOrderLines: splitLines(presentationOrder),
    expectedQuestionLines: splitLines(expectedQuestions),
    teacher,
    quiz,
    evaluation
  };
};

export const copyText = async (text) => {
  await navigator.clipboard.writeText(text);
};
