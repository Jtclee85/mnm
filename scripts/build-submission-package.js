#!/usr/bin/env node
/**
 * 연구대회 USB 제출 패키지 생성 스크립트
 *
 * submission-template/ 을 dist-submission/ 으로 복사하면서
 * {{PLACEHOLDER}}를 lib/submissionMeta.js 값으로 치환하고,
 * 결과물에 시도명/학교명/출품자명 등 금지어가 없는지 점검한다.
 *
 * 사용법: npm run build:submission
 * Node.js 기본 모듈(fs, path)만 사용한다.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TEMPLATE_DIR = path.join(ROOT, 'submission-template');
const OUTPUT_DIR = path.join(ROOT, 'dist-submission');
const META_PATH = path.join(ROOT, 'lib', 'submissionMeta.js');
const OFFLINE_BUILD_DIR = path.join(ROOT, '.next-offline');
const OFFLINE_OUTPUT_DIR = path.join(OUTPUT_DIR, 'offline-demo');
const SHARE_OUTPUT_DIR = path.join(OUTPUT_DIR, 'share');
const DEMO_LOCAL_PATH = path.join(ROOT, 'submission-demo', 'demo-snapshot.local.json');
const DEMO_EXAMPLE_PATH = path.join(ROOT, 'submission-demo', 'demo-snapshot.example.json');

// 챗봇 마스코트 이미지 후보 — 있으면 dist-submission/assets/로 복사, 없으면 데모가 💬 이모지로 대체
const MASCOT_CANDIDATES = [
  path.join(ROOT, 'public', 'chatbot-mascot.png'),
  path.join(ROOT, 'public', 'images', 'chatbot-mascot.png'),
];
const MASCOT_OUT = path.join(OUTPUT_DIR, 'assets', 'chatbot-mascot.png');

// ── 1. lib/submissionMeta.js 읽기 ──
// ESM(export const) 파일이므로 CJS require 대신 export 키워드를 제거한 뒤 평가한다.
function loadSubmissionMeta() {
  const source = fs.readFileSync(META_PATH, 'utf8').replace(/^export\s+const/gm, 'const');
  return new Function(`
    ${source}
    return {
      SUBMISSION_APP_NAME,
      SUBMISSION_REPORT_TITLE,
      SUBMISSION_TARGET_GRADE,
      SUBMISSION_DESCRIPTION,
      SUBMISSION_APP_URL,
    };
  `)();
}

// ── 2. dist-submission/ 안전하게 초기화 ──
// 실수로 다른 경로를 지우지 않도록 레포 루트 바로 아래의 dist-submission만 허용한다.
function resetOutputDir() {
  const resolved = path.resolve(OUTPUT_DIR);
  if (path.dirname(resolved) !== path.resolve(ROOT) || path.basename(resolved) !== 'dist-submission') {
    throw new Error(`예상하지 못한 출력 경로입니다: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
}

// ── 3. 제출 시작 파일 복사 + placeholder 치환 ──
function copySubmissionShell(meta) {
  const replacements = {
    '{{APP_NAME}}': meta.SUBMISSION_APP_NAME,
    '{{REPORT_TITLE}}': meta.SUBMISSION_REPORT_TITLE,
    '{{TARGET_GRADE}}': meta.SUBMISSION_TARGET_GRADE,
    '{{DESCRIPTION}}': meta.SUBMISSION_DESCRIPTION,
    '{{APP_URL}}': meta.SUBMISSION_APP_URL,
  };

  for (const filename of ['index.html', '실행안내.txt']) {
    const srcPath = path.join(TEMPLATE_DIR, filename);
    const destPath = path.join(OUTPUT_DIR, filename);
    let content = fs.readFileSync(srcPath, 'utf8');
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.split(placeholder).join(value);
    }
    fs.writeFileSync(destPath, content);
  }
}

// ── 3-1. 실제 앱 컴포넌트 기반 오프라인 데모 정적 export ──
function buildOfflineDemo() {
  if (!fs.existsSync(DEMO_LOCAL_PATH)) {
    console.warn('경고: submission-demo/demo-snapshot.local.json이 없습니다.');
    console.warn('       submission-demo/demo-snapshot.example.json으로 오프라인 데모를 생성합니다.');
    console.warn('       실제 심사용 패키지에는 앱에서 내보낸 세션 스냅샷을 넣어 주세요.\n');
  }
  if (!fs.existsSync(DEMO_LOCAL_PATH) && !fs.existsSync(DEMO_EXAMPLE_PATH)) {
    throw new Error('오프라인 데모 snapshot 파일이 없습니다. submission-demo/demo-snapshot.example.json을 확인하세요.');
  }

  fs.rmSync(OFFLINE_BUILD_DIR, { recursive: true, force: true });

  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_OFFLINE_DEMO_MODE: 'true',
      NEXT_PUBLIC_SUBMISSION_MODE: 'false',
    },
  });

  if (result.status !== 0) {
    throw new Error('오프라인 데모 정적 빌드에 실패했습니다.');
  }

  const offlinePageCandidates = [
    path.join(OFFLINE_BUILD_DIR, 'offline-demo', 'index.html'),
    path.join(OFFLINE_BUILD_DIR, 'offline-demo.html'),
  ];
  const offlinePage = offlinePageCandidates.find((p) => fs.existsSync(p));
  if (!offlinePage) {
    throw new Error(`오프라인 데모 export 결과를 찾을 수 없습니다: ${offlinePageCandidates.join(', ')}`);
  }

  fs.mkdirSync(OFFLINE_OUTPUT_DIR, { recursive: true });
  const offlineIndexOut = path.join(OFFLINE_OUTPUT_DIR, 'index.html');
  fs.copyFileSync(offlinePage, offlineIndexOut);
  stripCrossoriginForFileProtocol(offlineIndexOut);
  copyDirIfExists(path.join(OFFLINE_BUILD_DIR, '_next'), path.join(OFFLINE_OUTPUT_DIR, '_next'));
  copyExportedPageToSubmission('share', SHARE_OUTPUT_DIR);

  for (const entry of fs.readdirSync(OFFLINE_BUILD_DIR, { withFileTypes: true })) {
    if (entry.name === '_next' || entry.name === 'offline-demo') continue;
    if (['.html', '.json', '.js'].some((ext) => entry.name.endsWith(ext))) continue;
    const srcPath = path.join(OFFLINE_BUILD_DIR, entry.name);
    const destPath = path.join(OFFLINE_OUTPUT_DIR, entry.name);
    if (entry.isDirectory()) copyDirIfExists(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }

  return fs.existsSync(DEMO_LOCAL_PATH);
}

function copyExportedPageToSubmission(routeName, destDir) {
  const pageCandidates = [
    path.join(OFFLINE_BUILD_DIR, routeName, 'index.html'),
    path.join(OFFLINE_BUILD_DIR, `${routeName}.html`),
  ];
  const pagePath = pageCandidates.find((p) => fs.existsSync(p));
  if (!pagePath) {
    throw new Error(`${routeName} export 결과를 찾을 수 없습니다: ${pageCandidates.join(', ')}`);
  }

  fs.mkdirSync(destDir, { recursive: true });
  const indexOut = path.join(destDir, 'index.html');
  fs.copyFileSync(pagePath, indexOut);
  stripCrossoriginForFileProtocol(indexOut);
  copyDirIfExists(path.join(OFFLINE_BUILD_DIR, '_next'), path.join(destDir, '_next'));

  for (const assetName of ['chatbot-mascot.png', 'title-mnm.png']) {
    const assetPath = path.join(OFFLINE_BUILD_DIR, assetName);
    if (fs.existsSync(assetPath)) fs.copyFileSync(assetPath, path.join(destDir, assetName));
  }
}

function stripCrossoriginForFileProtocol(htmlPath) {
  // Chrome blocks file:// script/link loads when crossorigin is present. The files are local
  // and same-folder relative, so removing only this attribute keeps the export USB-friendly.
  const html = fs.readFileSync(htmlPath, 'utf8')
    .replace(/\s+crossorigin(?:="")?/g, '');
  fs.writeFileSync(htmlPath, html);
}

function copyDirIfExists(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDirIfExists(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

// ── 3-2. 챗봇 마스코트 이미지 복사 ──
function copyMascot() {
  const found = MASCOT_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) return false;
  fs.mkdirSync(path.dirname(MASCOT_OUT), { recursive: true });
  fs.copyFileSync(found, MASCOT_OUT);
  return true;
}

// ── 4. 결과물 점검 ──
// 금지어(시도명/학교명/출품자명/계정명)와 치환되지 않은 placeholder를 검사한다.
// 레포 코드 전체가 아니라 dist-submission/ 결과물만 점검한다.
const FORBIDDEN_WORDS = ['인천', '인천해원초', '해원초', '이진복', 'jbeduwork', 'jtclee85', '@gclass', 'api_key', 'apikey'];
const FORBIDDEN_PATTERNS = [
  { label: 'OpenAI API key pattern', re: /sk-(?:proj-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,})/i },
];

function verifyOutput() {
  const problems = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(ROOT, fullPath);

      for (const word of FORBIDDEN_WORDS) {
        if (entry.name.toLowerCase().includes(word.toLowerCase())) {
          problems.push(`금지어 발견 (파일명): ${relPath} ← "${word}"`);
        }
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (['.html', '.txt', '.js', '.css', '.json'].includes(path.extname(entry.name))) {
        // 텍스트 파일만 내용 검사 — 이미지 등 바이너리는 파일명 검사만 한다.
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const word of FORBIDDEN_WORDS) {
          if (content.toLowerCase().includes(word.toLowerCase())) {
            problems.push(`금지어 발견 (내용): ${relPath} ← "${word}"`);
          }
        }
        for (const { label, re } of FORBIDDEN_PATTERNS) {
          if (re.test(content)) {
            problems.push(`금지 패턴 발견 (내용): ${relPath} ← ${label}`);
          }
        }
        const leftover = content.match(/\{\{[A-Z_]+\}\}/g);
        if (leftover) {
          problems.push(`치환되지 않은 placeholder: ${relPath} ← ${[...new Set(leftover)].join(', ')}`);
        }
      }
    }
  };

  walk(OUTPUT_DIR);
  return problems;
}

// ── 실행 ──
function main() {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(`오류: 템플릿 폴더가 없습니다 — ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  const meta = loadSubmissionMeta();
  resetOutputDir();
  copySubmissionShell(meta);
  const usedRealSnapshot = buildOfflineDemo();
  const mascotCopied = copyMascot();

  const problems = verifyOutput();
  if (problems.length > 0) {
    console.error('제출 패키지 점검 실패 — 아래 문제를 해결한 뒤 다시 실행하세요.\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }

  if (meta.SUBMISSION_APP_URL.includes('YOUR-DEPLOYED-APP-URL')) {
    console.warn('경고: lib/submissionMeta.js의 SUBMISSION_APP_URL이 아직 placeholder입니다. 실제 배포 주소로 수정하세요.\n');
  }

  console.log('제출 패키지 생성 완료: dist-submission/');
  console.log('  - index.html');
  console.log('  - 실행안내.txt');
  console.log('  - offline-demo/index.html');
  console.log(`  - offline-demo/_next/* ${usedRealSnapshot ? '(실제 세션 스냅샷 기반)' : '(예시 스냅샷 기반)'}`);
  console.log('  - share/index.html');
  if (mascotCopied) console.log('  - assets/chatbot-mascot.png');
  console.log('\n다음 단계: dist-submission/ 폴더를 USB에 복사하세요.');
  console.log('USB 폴더명에 시도명·학교명·출품자명을 넣지 마세요. (예: "뭐냐면_심사용")');
}

main();
