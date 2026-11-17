# 화면 벤치마킹 (11/17)

국내 생활 · 금융 · 부동산 앱, 해외의 '처음 하는 일을 이끌어 주는' 앱, 점검 · 진단 · 리포트 앱을 세 갈래로 조사했다(웹 조사, 공식 디자인 블로그 · 가이드 우선). 직접 화면을 확인하지 못한 내용은 [확인 못 함]으로 표시했다. 11/16 조사(토스 · 직방 지킴 진단 · HUG · 당근 SEED)에 이어서 범위를 넓힌 것.

## 1. 세 갈래가 공통으로 말하는 것

1. **다시 온 사람은 기다리게 하지 않는다.** 앱은 바로 시작하고, 떠난 자리에서 이어가게 한다. 실행 화면은 "예술적 표현 · 브랜딩의 기회가 아니다"(Apple HIG Launching). 들어오자마자 원래 하려던 일을 하게 한다(앱인토스 UX 가이드). 여러 번에 나눠 하는 일은 다시 올 때마다 '진행 현황'부터 보여 준다(GOV.UK 과제 목록 패턴). 자주 보는 애니메이션일수록 짧고 은은하게(NN/g, 대부분 100–500ms).
2. **초록불 하나로 끝내지 않는다.** 신호등 표시는 잘못된 안도감을 준다(TUM · INRA 연구 2014). Carfax는 'reported'(신고된 것만) 때문에 소송을 겪었고, 직방 지킴 진단은 "빨간불은 들어오지만 초록불은 켜지지 않는 신호등"이라는 평을 받았다. → **확인한 범위와 확인 못 한 것**을 결과 안에 항상 적는다.
3. **불안한 일은 '다음 행동'으로 끝낸다.** 신고를 그만두는 1위 이유는 자신감 부족(Intuit). 첫 단계를 하나만 분명히 추천하자 코스 시작이 약 31% → 63%(Headspace × Irrational Labs). 위험 결과에도 "이렇게 하면 돼요"를 붙인다.
4. **색만으로 알리지 않는다.** WCAG 1.4.1. 모양 · 글자를 함께(Google 보안 진단, Carfax 문장형 라벨).
5. **축하는 끝에서 한 번, 차분하게.** 이른 축하 · 색종이는 혼란과 유치함을 부른다. 토스도 폭죽은 신용점수 상승 같은 좋은 순간에만. 위험 결과에는 절대 쓰지 않는다.

## 2. 화면별로 가져올 것 (지금 홈체크 상태와 비교)

| 화면 | 가져올 것 | 출처 | 지금 홈체크 | 작업 |
| --- | --- | --- | --- | --- |
| ① 첫 화면 · 입장 | 첫 방문만 로비, 다시 온 사람은 바로 '내 후보 방' | Apple HIG, 앱인토스, GOV.UK | ✅ 됨 | — |
| | 다시 온 사람의 '반가움'은 효과 대신 정보로: "지난번 ○○동 방, 4단계까지 했어요 → 이어하기" | Apple 상태 복원, 토스 홈 상태 카드, Headspace 교훈 | ❌ | 작음 |
| | 다시 올 때 입장 효과는 0.2–0.3초 정도로 짧게(카드가 살짝 올라오는 정도) | NN/g 시간 가이드 | ❌ (지금은 효과 없음) | 작음 |
| | '동작 줄이기'면 움직임 없이 | WCAG 2.3.3, MDN | ✅ 됨 | — |
| | PWA 실행 배경색을 첫 화면 배경과 같게 | web.dev | ✅ 흰색으로 같음 | — |
| ② 홈(내 후보 방) | 맨 위에 '다음에 할 일' 하나만 크게 | Headspace, 토스 주거래 계좌, 카카오뱅크(클릭 90%가 핵심 기능) | ❌ | 작음 |
| | 방 카드: 판정 · 한 줄 결론 · "6단계 중 N단계" · 다음 할 일 | 토스 계좌 카드, Zillow Renter Hub, GOV.UK 상태 라벨 | 🟡 다음 할 일 없음 | 작음 |
| ③ 방 추가 | 금액 칸은 숫자 키패드 | 토스 송금 | ✅ 됨 | — |
| | "잘 모르면 비워 둬도 돼요"(틀린 답 없음) 안심 문구 | TurboTax | 🟡 일부 | 작음 |
| | 등기부 올리기 옆 "이 서류가 뭐예요 · 왜 필요해요?" | 토스 Explain Why, Apple 상황별 팁 | 🟡 짧게 있음 | 작음 |
| ④ 결과 | **'확인 못 한 것'을 항상 표시**(전입세대 · 확정일자 · 국세 체납 · 신탁원부 등 등기부로 알 수 없는 것), '안전'은 "확인한 범위 안에서 큰 문제는 없었어요" | Carfax 소송, 지킴 진단 비판, TUM 연구 | ❌ | 작음 |
| | 큰 제목 아래 3줄 요약: 문제 개수 · 가장 급한 1가지 · 지금 할 일 1가지 | 지킴 진단 '종합 진단 의견' | 🟡 제목만 | 작음 |
| | 판정에 모양 + 글자 (위험 ▲ · 주의 ● · 안전 ✓) | WCAG 1.4.1, Google | 🟡 글자는 있음, 모양 없음 | 작음 |
| | 이유 하나에 '무슨 뜻 → 왜 위험 → 할 일 → 근거 보기' | Credit Karma 요인 설명 | 🟡 제목 + 근거만 | 중간 |
| | 고친 값에 "내가 고침" 표시 | HomeGauge 수정 기록 | ❌ | 중간 |
| | 시세가 추정이면 '추정'과 범위 표시 | 건강검진 정상 범위, 안심전세앱 시세 비판 | 🟡 참고선 안내만 | 중간 |
| ⑤ 다음 행동 · 계약 방법 | 특약 · 질문 복사 | 지킴 진단 상황별 특약 | ✅ 됨 | — |
| | '요청 목록': 이유마다 "특약에 넣기 / 집주인에게 묻기"를 골라 한 번에 복사 · 공유 | Spectora · HomeGauge | ❌ | 중간 |
| | 가족 공유 요약에도 '확인 못 한 것' 포함 | Carfax 교훈 | ❌ | 작음 |
| | 막히면 전문가에게: 공공 상담 창구 카드 (연락처는 공식 원문 확인 후) | 서울시 전월세보증금지원센터 | ❌ | 작음 |
| | 단계 사이 "다음은 ○○예요", 끝낸 단계도 다시 열기 | TurboTax 체크포인트, GOV.UK | 🟡 다시 열기만 | 작음 |
| | 축하는 '계약 완료' 한 번만, 초록색으로 1초 이내 · 차분하게 | Duolingo(일부 마일스톤만), 토스, 색종이 역효과 | ❌ | 작음 |
| | 잔금 전날 등기부 다시 떼기 (체크 항목) | 서울시 안내, 토스뱅크 등기변동알림 | 🟡 단계 항목 확인 필요 | 작음 |
| ⑥ 내비게이션 | 위쪽 바 고정 · 홈 버튼 같은 자리 | 앱인토스 | ✅ 됨(11/17) | — |
| | 어디서 나가도 진행 자동 저장, 다시 오면 이어하기 | Visa 디자인 시스템, Apple | 🟡 저장은 됨, 이어하기 카드 없음 | 작음 |
| ⑦ 빈 상태 · 오류 · 로딩 | 빈 홈은 문장 + 버튼 하나 | Headspace, 토스 | ✅ 됨 | — |
| | 오류에는 다른 방법(직접 입력 · 공식 사이트)을 함께 | 안심전세앱 먹통 비판, GOV.UK | ✅ 시세 · PDF에 있음 | — |
| | 기다리는 곳(동네 시세)은 회색 틀(스켈레톤), 실제로 안 기다리면 로딩 없음 | 토스 TDS Skeleton, 앱인토스 | 🟡 글자만 | 작음 |
| | 빨강은 '위험'과 오류에만, 오류가 아닌 안내에 느낌표 금지 | GOV.UK, 앱인토스 | 🟡 점검 필요 | 작음 |

## 3. 가져오지 말 것

| 패턴 | 이유 |
| --- | --- |
| 다시 올 때마다 로비 · 긴 입장 연출 · 브랜드 스플래시 | Apple HIG · 앱인토스 · NN/g 모두 반대. 결과를 확인하러 온 사람을 문 앞에서 기다리게 함 |
| 0–100 종합 안전 점수 | 정밀해 보이지만 근거 설명이 어렵고, 1–2점 차이가 오해를 부름 |
| 설명 없는 초록불 · "계약해도 됩니다" 단정 | 잘못된 안도감. "이것을 확인하면 계약을 진행할 수 있어요"처럼 조건형으로 |
| 결과 화면 · 중간 단계의 폭죽 | 위험 결과의 심각성을 흐림, 이른 축하는 혼란 |
| 연속 기록(스트릭) · 끊기는 압박 | 계약은 습관이 아니고, 불안을 키움 |
| 위험을 가볍게 만드는 순화('외상'식) | 쉬운 말 + 원래 용어를 함께: "집을 담보로 빌린 돈(근저당)" |
| 여러 장 넘기는 튜토리얼 | NN/g 테스트에서 효과 없음(11/16 제외 결정과 같음) |
| 홈 편집 · 개인화, 지도 첫 화면, 범죄 · 치안 같은 영역 확장 | 방 몇 개짜리 검증 앱에는 기능만 늘어남 |
| 들어오자마자 알림 동의 · 유료 유도 | 앱인토스 금지 패턴, 불안한 사용자에게 압박 |

## 4. 주요 출처

- Apple HIG Launching · Onboarding: https://developer.apple.com/design/human-interface-guidelines/launching · https://developer.apple.com/design/human-interface-guidelines/onboarding
- 앱인토스 UX 가이드: https://developers-apps-in-toss.toss.im/landing-page/landing-page-en/design/consumer-ux-guide
- 토스 제품 원칙 · 홈 개편 · 모션: https://toss.im/tossfeed/article/tossproductprinciples · https://toss.im/tossfeed/article/new-home · https://toss.im/tossfeed/article/why-motion-in-finance
- GOV.UK 여러 과제 끝내기: https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
- NN/g 애니메이션 시간 · 온보딩 · 단계적 공개: https://www.nngroup.com/articles/animation-duration/ · https://www.nngroup.com/articles/mobile-app-onboarding/ · https://nngroup.com/articles/progressive-disclosure/
- Headspace × Irrational Labs: https://irrationallabs.com/case-studies/headspace-doubled-course-starts/
- 직방 지킴 진단 평가: https://m.etnews.com/20260515000263
- 신호등 표시와 잘못된 안도감(TUM): https://www.eurekalert.org/news-releases/804074
- Carfax 'reported' 비판: https://www.fi-magazine.com/news/suit-alleges-carfax-reports-are-incomplete-and-unreliable
- WCAG 1.4.1 · 2.3.3: https://w3.org/WAI/WCAG22/Understanding/use-of-color.html · https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html
- Spectora · HomeGauge 요청 목록: https://support.spectora.com/en/articles/2155740-how-to-use-the-repair-request-builder · https://support.homegauge.com/en/articles/14844857-create-request-list
