"use client";
// 집 계약 과정 미리보기(11/28 다시 만듦): 앱 화면 캡처 대신, 실제 집 계약 6단계를 직접 그린 그림으로 하나씩 설명한다.
// 장마다 그림 1개 + 한 줄(무엇을) + 왜 해요 + 홈체크가 도와주는 것. 읽는 속도는 사람마다 달라 자동으로 넘기지 않고(NN/g 캐러셀 권고),
// 이전 · 다음 · 점(몇 번째)으로 직접 넘긴다. 그림 색은 화면 색 변수(--accent 등)를 써서 어두운 화면에서도 맞는다.
import { useState, type ReactNode } from "react";

type Slide = { title: string; body: string; why: string; help: string; key?: boolean; art: ReactNode };

/* ── 그림(200×140). 색: art-bg 연한 배경 · art-main 초록 · art-warm 주황 · art-paper 종이 · art-line 선 ── */
const Frame = ({ label, children }: { label: string; children: ReactNode }) => (
  <svg className="flow-art" viewBox="0 0 200 140" role="img" aria-label={label}>
    <circle className="art-bg" cx="100" cy="74" r="62" />
    {children}
  </svg>
);

const ArtBudget = () => (
  <Frame label="지갑과 동전: 쓸 수 있는 돈 정하기">
    <rect className="art-main" x="52" y="58" width="96" height="58" rx="12" />
    <rect className="art-paper" x="118" y="76" width="34" height="22" rx="8" />
    <circle className="art-line-fill" cx="130" cy="87" r="4" />
    <circle className="art-warm" cx="78" cy="42" r="14" />
    <circle className="art-warm" cx="104" cy="32" r="12" />
    <text className="art-coin" x="78" y="47" textAnchor="middle">₩</text>
    <text className="art-coin" x="104" y="36.5" textAnchor="middle" fontSize="12">₩</text>
  </Frame>
);

const ArtSearch = () => (
  <Frame label="휴대폰 지도와 집들: 후보 방 모으기">
    <rect className="art-paper art-stroke" x="70" y="22" width="60" height="104" rx="12" />
    <rect className="art-bg-strong" x="77" y="34" width="46" height="70" rx="4" />
    <path className="art-main" d="M100 46c-9 0-15 7-15 15 0 11 15 25 15 25s15-14 15-25c0-8-6-15-15-15z" />
    <circle className="art-paper" cx="100" cy="61" r="5" />
    <path className="art-house" d="M28 104l14-12 14 12v14H28z" />
    <path className="art-house" d="M146 100l14-12 14 12v18h-28z" />
  </Frame>
);

const ArtVisit = () => (
  <Frame label="집과 돋보기, 물방울: 직접 보고 확인하기">
    <path className="art-paper art-stroke" d="M46 72l46-36 46 36v48H46z" />
    <rect className="art-main" x="80" y="88" width="24" height="32" rx="3" />
    <rect className="art-bg-strong" x="112" y="80" width="16" height="14" rx="2" />
    <path className="art-info" d="M60 92c0 0-8 9-8 14a8 8 0 0016 0c0-5-8-14-8-14z" />
    <circle className="art-glass" cx="146" cy="96" r="16" />
    <path className="art-line" d="M158 108l14 14" strokeWidth="6" strokeLinecap="round" />
  </Frame>
);

const ArtDocs = () => (
  <Frame label="등기부등본 서류와 신호등: 진짜 집주인과 빚 확인하기">
    <rect className="art-paper art-stroke" x="56" y="24" width="72" height="96" rx="8" />
    <rect className="art-line-fill" x="66" y="38" width="40" height="5" rx="2" />
    <rect className="art-muted-fill" x="66" y="52" width="52" height="4" rx="2" />
    <rect className="art-muted-fill" x="66" y="62" width="46" height="4" rx="2" />
    <rect className="art-muted-fill" x="66" y="72" width="52" height="4" rx="2" />
    <rect className="art-dark" x="118" y="70" width="56" height="24" rx="12" />
    <circle className="art-danger" cx="131" cy="82" r="6" />
    <circle className="art-warm" cx="146" cy="82" r="6" />
    <circle className="art-main-light" cx="161" cy="82" r="6" />
    <circle className="art-main" cx="84" cy="100" r="11" />
    <path d="M79 100l4 4 7-8" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);

const ArtContract = () => (
  <Frame label="계약서와 펜, 집주인 계좌: 계약하는 날">
    <rect className="art-paper art-stroke" x="40" y="28" width="70" height="92" rx="8" />
    <rect className="art-muted-fill" x="50" y="42" width="50" height="4" rx="2" />
    <rect className="art-muted-fill" x="50" y="52" width="44" height="4" rx="2" />
    <rect className="art-warm-soft" x="50" y="64" width="50" height="16" rx="3" />
    <text className="art-label" x="75" y="75" textAnchor="middle">특약</text>
    <path className="art-line" d="M52 104c8-8 12 6 20-2s10 4 18-2" fill="none" strokeWidth="2.5" strokeLinecap="round" />
    <rect className="art-main" x="122" y="62" width="50" height="34" rx="6" />
    <rect className="art-paper" x="128" y="70" width="18" height="4" rx="2" />
    <text className="art-label-on" x="147" y="89" textAnchor="middle">집주인</text>
    <path className="art-line" d="M112 80h8" strokeWidth="3" strokeLinecap="round" />
  </Frame>
);

const ArtMoveIn = () => (
  <Frame label="이삿짐 상자와 도장: 이사한 날 전입신고 · 확정일자">
    <rect className="art-box" x="44" y="78" width="44" height="40" rx="3" />
    <rect className="art-box" x="62" y="50" width="36" height="30" rx="3" />
    <path className="art-line" d="M44 92h44M62 62h36" strokeWidth="2" />
    <circle className="art-stamp" cx="138" cy="74" r="28" />
    <text className="art-stamp-text" x="138" y="70" textAnchor="middle">전입</text>
    <text className="art-stamp-text" x="138" y="86" textAnchor="middle" fontSize="11">확정일자</text>
  </Frame>
);

export const SLIDES: Slide[] = [
  { title: "1. 준비", body: "보증금 · 월세로 쓸 수 있는 돈부터 정해요", why: "보증금은 큰돈이라, 정해 둬야 볼 방이 좁혀져요", help: "할 일을 체크리스트로 챙겨요", art: <ArtBudget /> },
  { title: "2. 집 찾기", body: "앱 · 중개사무소에서 후보 방을 모아요", why: "여러 곳을 봐야 동네 시세를 알 수 있어요", help: "마음에 드는 방을 담아 두고, 동네 시세와 비교해요", art: <ArtSearch /> },
  { title: "3. 집 보러 가기", body: "물 · 곰팡이 · 잠금 · 소음을 직접 봐요", why: "사진으로는 안 보이는 게 많아요", help: "'괜찮아요 / 다시 보세요' 기준을 보여 줘요", art: <ArtVisit /> },
  {
    title: "4. 계약 전 서류 확인",
    body: "등기부등본으로 진짜 집주인과 빚을 확인해요",
    why: "집주인이 다르거나 빚이 많으면 보증금을 못 돌려받을 수 있어요",
    help: "PDF를 올리면 위험 · 주의 · 안전 신호등으로 알려 줘요",
    key: true,
    art: <ArtDocs />,
  },
  { title: "5. 계약하는 날", body: "계약서 · 특약을 읽고, 보증금은 집주인 이름 계좌로만 보내요", why: "다른 사람 계좌로 보내면 돌려받기 어려워요", help: "집주인에게 물어볼 말 · 특약 문장을 복사해 줘요", art: <ArtContract /> },
  { title: "6. 입주 후", body: "이사한 날 바로 전입신고 · 확정일자를 받아요", why: "신고한 다음 날부터 보증금을 지키는 힘이 생겨요", help: "그날을 휴대폰 캘린더에 넣어 줘요", art: <ArtMoveIn /> },
];

export default function FlowPreview() {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <section className="flow-preview" aria-roledescription="미리보기" aria-label="집 계약 과정 미리보기">
      <div className={`flow-card${s.key ? " flow-key" : ""}`} key={i}>
        {s.art}
        <div className="flow-text" aria-live="polite">
          {s.key && <span className="flow-badge">가장 중요해요</span>}
          <h2 className="flow-title">{s.title}</h2>
          <p className="flow-body">{s.body}</p>
          <p className="flow-why">
            <strong>왜 해요?</strong> {s.why}
          </p>
          <p className="flow-help">
            <strong>홈체크가</strong> {s.help}
          </p>
        </div>
      </div>
      <div className="flow-controls">
        <button type="button" className="ghost" onClick={() => setI(i - 1)} disabled={i === 0}>
          ← 이전
        </button>
        <span className="flow-dots" role="group" aria-label="단계 고르기">
          {SLIDES.map((x, k) => (
            <button key={x.title} type="button" className={k === i ? "on" : undefined} aria-label={x.title} aria-current={k === i ? "step" : undefined} onClick={() => setI(k)} />
          ))}
        </span>
        <button type="button" className="ghost" onClick={() => setI(i + 1)} disabled={last}>
          다음 →
        </button>
      </div>
      <p className="small muted">
        {i + 1} / {SLIDES.length}
        {last ? " · 여기까지가 계약 완료예요" : ""}
      </p>
    </section>
  );
}
