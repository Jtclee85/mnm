// 연구대회 심사용 제출 메타데이터 — 앱 내부 심사용 시작화면(SubmissionStartScreen)과
// USB 제출용 index.html 템플릿(scripts/build-submission-package.js에서 치환)이 공통으로 사용한다.
// 주의: 이 파일에 시도명, 학교명, 출품자명, 이메일, GitHub 계정명을 넣지 않는다.

export const SUBMISSION_APP_NAME = '뭐냐면';

// TODO: 제출 전 최종 연구보고서 제목으로 수정할 것
export const SUBMISSION_REPORT_TITLE =
  'AI 기반 자료 재구성을 통한 사회(역사) 교과 깊이 있는 탐구학습 지원 방안';

export const SUBMISSION_TARGET_GRADE = '초등학교 4~6학년';

export const SUBMISSION_DESCRIPTION =
  '원본자료를 쉽게 읽고, 질문을 고르고, 내 생각을 정리하는 AI 기반 자료조사 학습 도구입니다.';

// TODO: 제출 전 실제 배포 주소로 수정할 것
export const SUBMISSION_APP_URL = 'https://mnm-kappa.vercel.app/';
