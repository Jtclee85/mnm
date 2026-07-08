# GPT 챗봇 (Simple Template)

## 🚀 시작 방법

1. `.env.local.example` 파일을 `.env.local`로 복사하고 OpenAI 키 입력
2. 로컬에서:
   ```
   npm install
   npm run dev
   ```
3. 브라우저에서 `http://localhost:3000` 접속 → 챗봇 테스트

## ☁️ Vercel 배포

1. 저장소를 Vercel에 연결
2. 환경변수 `OPENAI_API_KEY` 등록
   - 추천 영상 기능을 쓰려면 `YOUTUBE_API_KEY`도 등록
3. Deploy → 생성된 URL로 접속하면 ✅ 바로 챗봇 사용 가능

## YouTube 추천 영상 기능

추천 영상은 YouTube 전체 검색 결과가 아니라, 교사가 승인한 채널 안에서만 검색합니다.

1. Vercel 또는 `.env.local`에 `YOUTUBE_API_KEY`를 설정합니다.
2. `lib/approvedYoutubeChannels.js`에 승인 후보 채널의 `name`/`searchName`/`handle`을 입력합니다.
3. `npm run youtube:channels` 명령으로 `channelId` 후보를 조회합니다.
4. 교사가 결과를 확인한 뒤 정확한 `channelId`만 `approvedYoutubeChannels.js`에 복사합니다.
5. `channelId`가 비어 있는 채널은 추천 검색에서 제외됩니다.
