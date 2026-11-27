"use client";
// 계약 과정 미리보기(A): 실제 화면 5장이 자막과 함께 자동으로 넘어간다(영상 파일 없이 '시뮬레이션'처럼).
// 원할 때만 보는 곳(로비 '계약 과정 미리보기')에 두고, 멈춤 · 이전 · 다음을 직접 누를 수 있게 한다(WCAG 2.2.2).
// '동작 줄이기' 설정이면 자동으로 넘기지 않는다. 화면은 scripts로 배포본에서 찍은 것(가짜 예시 서류).
import { useEffect, useState } from "react";

export const SLIDES = [
  { src: "/preview/1-room.jpg", title: "① 관심 있는 방 담기", body: "어디서 찾았든 주소 · 보증금 · 월세만 적어요." },
  { src: "/preview/2-doc.jpg", title: "② 등기부등본 올리기", body: "인터넷등기소에서 뗀 PDF를 올려요. 휴대폰 안에서만 읽어요." },
  { src: "/preview/3-result.jpg", title: "③ 신호등으로 결과 보기", body: "위험 · 주의 · 안전과 가장 먼저 확인할 것 하나를 알려 줘요." },
  { src: "/preview/4-next.jpg", title: "④ 집주인에게 물어볼 말 · 특약", body: "복사해서 바로 보낼 수 있는 문장을 이 방에 맞춰 만들어요." },
  { src: "/preview/5-steps.jpg", title: "⑤ 지금 할 일 하나 · 그날 만나요", body: "방마다 지금 할 일 하나만 보여 주고, 다음 날짜를 챙겨요." },
] as const;

const INTERVAL_MS = 3200;

export default function FlowPreview() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    // 동작 줄이기면 자동 재생하지 않는다(확인할 수 없는 환경도 멈춘 채로 시작)
    setPlaying(typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [playing]);
  const go = (n: number) => setI((n + SLIDES.length) % SLIDES.length);
  const s = SLIDES[i];
  return (
    <section className="flow-preview" aria-roledescription="미리보기" aria-label="홈체크 사용 흐름 미리보기">
      <div className="flow-phone">
        {SLIDES.map((x, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={x.src} src={x.src} alt={k === i ? `${x.title} 화면` : ""} aria-hidden={k !== i} className={k === i ? "on" : undefined} loading={k === 0 ? "eager" : "lazy"} />
        ))}
      </div>
      <div className="flow-caption" aria-live={playing ? "off" : "polite"}>
        <strong>{s.title}</strong>
        <span>{s.body}</span>
      </div>
      <div className="flow-controls">
        <button type="button" className="ghost" onClick={() => go(i - 1)} aria-label="이전 화면">
          ←
        </button>
        <span className="flow-dots" aria-hidden="true">
          {SLIDES.map((x, k) => (
            <span key={x.src} className={k === i ? "on" : undefined} />
          ))}
        </span>
        <button type="button" className="ghost" onClick={() => setPlaying((p) => !p)}>
          {playing ? "멈춤" : "재생"}
        </button>
        <button type="button" className="ghost" onClick={() => go(i + 1)} aria-label="다음 화면">
          →
        </button>
      </div>
      <p className="small muted">
        {i + 1} / {SLIDES.length} · 화면은 지어낸 예시 서류로 찍었어요.
      </p>
    </section>
  );
}
