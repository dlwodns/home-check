# 홈체크

전월세 계약 전에 등기부등본을 올리면, 처음 계약하는 사람도 알아듣기 쉽게 위험 신호와 계약 전 체크리스트를 알려 주는 웹 앱입니다. (Next.js · TypeScript)

> 현재 단계: 기본 화면만 있는 초기 세팅 상태입니다.

## 주요 기능

- (준비 중) 기획(미니 PRD) 후 기능을 추가합니다.

## 실행 방법

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev              # 개발 서버 (기본 3000번 포트)
PORT=3080 npm run dev    # 포트를 바꾸고 싶을 때
```

## 필요한 키

| 이름 | 설명 |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter API 키. AI 기능을 붙일 때 필요합니다. 서버에서만 읽습니다. (`.env.sample` 참고) |
