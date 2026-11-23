# 포스터 인수인계 (2026-11-23 밤 기준)

다른 대화 · 다른 사람이 이어서 포스터를 고칠 때 이 파일 하나만 읽으면 되도록 정리했습니다.

## 1. 지금 상태 한 줄

**포스터 9차(`e67a950`)가 최신**입니다. A2 1쪽, 잘림 없음 확인. 남은 일은 사용자 검토 → (필요하면) 수정 → **오늘(11/23) 자정 전 제출**.

## 2. 제출 규칙 (멘토 공지, 최종)

- A2 크기 **PDF 1개**. 인쇄해서 전시(시연 없음). 코드는 나중에 따로 제출
- 파일 이름: **`6팀-단국대학교-이재운-홈체크.pdf`** (하이픈. 언더바 쓰지 않음)
- 올리는 곳: 공유 드라이브 **6팀 → 개인과제** 폴더 (Drive 폴더 id `1i4xXz5QJVbq7Z9UFilzuyVZQxxfFXbDV`). 공유 폴더라 올리면 팀원 · 멘토에게 바로 보임 → **사용자 확인 후** 올림
- 구성 권장: 문제 → 핵심 기능 → 기대사항 (PRD 목차와 비슷하게)

## 3. 파일

| 파일 | 역할 |
| --- | --- |
| `poster/poster.html` | **포스터 원본** (모든 크기 mm · pt). 여기만 고치면 됨 |
| `poster/homecheck-poster-A2.pdf` | 뽑은 결과(제출용) |
| `poster/homecheck-poster-preview.png` | 미리보기(눈으로 확인용) |
| `poster/img/` | QR(`qr.svg`, 주소 https://home-check-pi.vercel.app), 휴대폰 화면 `screen-home-top · screen-result · screen-next.png`, 아이콘 |
| `scripts/make-poster.mjs` | HTML → PDF · PNG |
| `scripts/poster-shots.mjs` | 배포 사이트에서 앱 화면 다시 찍기 |
| `.claude/skills/poster/SKILL.md` | 포스터 제작 스킬(과제 요구). 배치 · 규칙 · 점검표 |
| `/home/user79/6팀-단국대학교-이재운-홈체크.pdf` | 제출 이름으로 복사해 둔 것. **PDF를 다시 뽑으면 이것도 다시 복사** |

## 4. 다시 뽑는 법 (이 서버 기준)

이 서버엔 Pretendard 글꼴 · 브라우저 라이브러리가 시스템에 없어서 저장소 밖 경로를 씁니다(세션 임시 폴더라 지워졌을 수 있음 → 아래 '없으면').

```bash
cd ~/home-check
F=/tmp/claude-1040/-home-user79-my-intro/8c044dc8-8cab-4a76-8300-fce3400dcf78/scratchpad/fonts
FONTCONFIG_FILE=$F/fonts.conf \
LD_LIBRARY_PATH=/tmp/claude-1040/-home-user79-my-intro/eb513e24-5244-475a-b42f-5c5e5780408b/scratchpad/libs/root/usr/lib/x86_64-linux-gnu \
CHROME_PATH=$HOME/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell \
node scripts/make-poster.mjs
cp poster/homecheck-poster-A2.pdf ~/6팀-단국대학교-이재운-홈체크.pdf
```

- **없으면**: 글꼴 = `~/wt-measure/frontend/node_modules/pretendard/dist/public/static/Pretendard-*.otf`를 한 폴더에 모으고 그 폴더를 `<dir>`로 가리키는 `fonts.conf`를 만듦. 라이브러리 = `/tmp/chromium-libs/extracted/usr/lib/x86_64-linux-gnu`도 됨. 화면 캡처(`poster-shots.mjs`)는 `npm i playwright-core`를 저장소 밖 폴더에 설치하고 `NODE_PATH`로 가리킴(파일 맨 위 설명)
- 뽑은 뒤 **반드시 확인**: `grep -aoE "/MediaBox ?\[[^]]*\]" poster/homecheck-poster-A2.pdf | sort | uniq -c` → **1줄**(`[0 0 1191.12 1684.08]` = 420 × 594mm)이어야 함. 2줄이면 넘쳐서 2쪽이 된 것 → 글을 줄이거나 여백 조정
- 미리보기 PNG를 눈으로: 아래 띠에 카드가 가리는지, 글자 넘침, 숫자 줄바꿈

## 5. 지금 구성 (9차)

- 위 띠: 아이콘 · 홈체크 · 「이 방, 계약해도 될까?」 · `6팀 · 이재운 (단국대학교)` · CHEONAN AX 개인 프로젝트 · 2026. 11
- 헤드라인 2줄: "등기부등본 한 장 올리면 / 이 방의 위험 신호와 다음 할 일까지" + "어려운 서류를 쉬운 말로 풀어 드려요"
- 휴대폰 3대: 방 담기 → **신호등 판정(가운데 크게)** → 다음에 할 일, 오른쪽 QR 56mm
- 섹션 1–5: ① 문제 ② 핵심 기능 ③ 이렇게 달라요(3열 표) ④ 검증 · 만든 과정(두 칸 너비) ⑤ 기대 효과(활용처 · 로드맵)
- 아래 띠: 참고용 안내 · 70 · 80% 기준 풀어 씀 · 주소

## 6. 사용자가 정한 규칙 (꼭 지킬 것)

1. **수상 포스터 레퍼런스에 없는 항목은 넣지 않는다.** 특히 **AI 활용 과정 문장 · 칩은 빼기로 결정**(다시 넣지 말 것). 동작 구조도 · 채점관 추측으로만 넣은 문장도 뺐음. 레퍼런스 근거: #BetterPoster(큰 결론 문장 · QR), 수상작 분석(대표 화면 크게 · 블록 4–5개), Mohawk 대회 1위(강한 숫자 하나 · 짧은 방법 흐름), 서울시 전세사기 예방 대상작(판단 기준을 숫자로), 한이음 드림업 수상작(기대효과 및 활용분야)
2. **숫자 · 사실을 지어내지 않는다.** 사용자 테스트 · 인터뷰 · 체험 시간("1분")은 실제로 안 했으므로 넣지 않음. 출처 없는 인용구 금지
3. **스스로 깎는 표현을 쓰지 않는다**('놓침 · 못 한 것 · 가짜 · 지어낸'). 사실은 바꾸지 않고 확인 가능한 긍정형으로(예: '오류 원인 13개 발견 · 수정', '다음: 실제 PDF 정확도 측정', '테스트용 가상 등기부'). 원래 숫자(처음 보는 서류에서 고치기 전 67–80%)는 README · PRD에 그대로 있음
4. 반대로 '100% · 완벽 · 안전 보장' 같은 과장도 금지
5. 다른 서비스를 이름으로 깎아내리지 않는다(비교는 '기존 방법' 일반으로)
6. 바꿀 때마다 **사용자에게 먼저 보여 주고** 진행. 커밋 메시지는 한국어로 무엇 · 왜(저장소 `CLAUDE.md`)

## 7. 포스터 숫자와 근거 (저장소에서 다시 잰 값)

| 포스터 | 실제 | 어디서 |
| --- | --- | --- |
| 340+ 자동 테스트 | 344개 통과 | `npx vitest run` |
| 근거 29개 (원문 20개 포함) | ✅20 · 🟡7 · ⚪2 | `data/sources.json` |
| 판정 규칙 18개 | 18 | `data/judge.json` flags |
| 블라인드 20건 → 오류 원인 13개 → 120개 항목 일치 | 1차 원인 7 + 2차 6, 각 60항목 × 2회 | `docs/SCHEDULE.md` A1 |
| 76% · 누적 4만 2,039건 | 40세 미만 75.86% | 국토부 발표, [이투데이 2026-11](https://www.etoday.co.kr/news/view/2646917) · PRD '근거' |
| 122명 · 47억 원 | 익산 원룸 임대업자 한 명 | 뉴시스 2019 (PRD) |
| 직거래 20대 7명 | | 매일신문 2024 (PRD) |
| 132 · 1533-8119 | 대한법률구조공단 · HUG 전세피해 및 예방지원센터 | `data/help.json` (11/17 공식 사이트 확인) |
| 70% 주의 · 80% 위험 | `caution_from 70 · danger_from 80` | `data/judge.json` ratio |

## 8. 남은 선택지 (사용자 결정 대기)

- 사용자 테스트를 하면 ④ 또는 ⑤에 결과 한 줄 추가 가능(가이드 2-8)
- 본문 24pt 권장(가이드 2-11)은 내용을 절반으로 줄여야 해서 미적용. 지금 본문 16–17pt, 캡션 13.5–15pt
- QR 56mm (가이드 권장 60–80mm). 키우면 휴대폰 화면이 줄어듦
- 앱 화면을 바꾸면 `poster-shots.mjs`로 다시 찍기(주의 샘플 · 가상 등기부만 사용)

## 9. 제출 전 점검표

- [ ] PDF 1쪽 · 420 × 594mm
- [ ] 미리보기에서 잘림 · 넘침 없음
- [ ] QR을 휴대폰으로 찍어 https://home-check-pi.vercel.app 열림
- [ ] 숫자가 7번 표와 같음
- [ ] `~/6팀-단국대학교-이재운-홈체크.pdf`를 최신으로 다시 복사
- [ ] 사용자 OK → 6팀 · 개인과제 폴더에 업로드
- [ ] 커밋 · 푸시
