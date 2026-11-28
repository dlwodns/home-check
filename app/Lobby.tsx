"use client";
// 홈체크 소개(/welcome): 과정 설명은 '계약 과정 미리보기' 한 곳에만 두고(11/28), 여기는 무엇을 하는 곳인지 · 믿고 써도 되는 이유만.
// 로비(입구): 처음 온 사람에게 "여기가 어떤 곳이고, 어느 문으로 들어가면 되는지"를 보여 준다.
// 한 번 들어온 사람은 다시 보지 않고(HomeGate), 홈 아래 '홈체크 소개'(/welcome)로 언제든 다시 볼 수 있다.
// 효과는 CSS만 쓰고, 움직이는 중에도 바로 누를 수 있게 하며, '동작 줄이기' 설정이면 움직임을 뺀다(globals.css).
import Link from "next/link";
import { useEffect, useRef } from "react";
import { sources } from "@/lib/content";
import { markEntered } from "./ui/entered";

const CONFIRMED = sources.filter((s) => s.status === "confirmed").length;


const TRUST = [
  { title: "등기부등본은 이 기기 안에서만", body: "서류를 어디에도 보내거나 저장하지 않아요" },
  { title: `법령 원문으로 확인한 근거 ${CONFIRMED}개`, body: "안내마다 '근거 보기'로 원문을 확인할 수 있어요" },
  { title: "무료 · 로그인 없이", body: "다른 기기에서 이어 볼 때만 로그인하면 돼요" },
];

export default function Lobby() {
  const root = useRef<HTMLElement>(null);

  // 스크롤해서 보이는 순간 아래에서 올라오게 (지원하지 않는 브라우저는 그냥 보인다)
  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? [];
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.2 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="lobby" ref={root}>
      <section className="lobby-hero">
        <div className="lobby-mark" aria-hidden="true">
          <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path className="draw draw-1" pathLength={1} d="M3 11l9-7 9 7" />
            <path className="draw draw-2" pathLength={1} d="M6 10v9h12v-9" />
            <path className="draw draw-3" pathLength={1} d="M9 13.6l2.2 2.2 4-4.2" />
          </svg>
        </div>
        <p className="lobby-brand rise rise-1">홈체크</p>
        <h1 className="lobby-title">
          <span className="rise rise-2">이 방,</span>
          <span className="rise rise-3 accent">계약해도 될까?</span>
        </h1>
        <p className="lobby-lead rise rise-4">위험부터 확인하고, 그 방에 맞는 계약 방법까지 알려 드려요.</p>

        <div className="lobby-signal rise rise-4" aria-hidden="true">
          <span className="signal-box">
            <span className="lamp lamp-danger cycle-danger" />
            <span className="lamp lamp-caution cycle-caution" />
            <span className="lamp lamp-safe cycle-safe" />
          </span>
          <span className="lobby-signal-text">위험 · 주의 · 안전을 한눈에</span>
        </div>

        <div className="lobby-doors rise rise-5">
          <Link href="/rooms/new" className="cta lobby-main-door" onClick={markEntered}>
            방 담기
          </Link>
          <div className="lobby-side-doors">
            <Link href="/guide" className="side-door" onClick={markEntered}>
              계약 과정 미리보기
            </Link>
            <Link href="/check" className="side-door" onClick={markEntered}>
              등기부등본만 바로 점검
            </Link>
          </div>
        </div>
        <span className="lobby-scroll" aria-hidden="true">
          믿고 써도 되는 이유 ↓
        </span>
      </section>


      <section className="lobby-section" aria-labelledby="lobby-trust">
        <h2 id="lobby-trust" data-reveal>
          믿고 써도 되는 이유
        </h2>
        <ul className="lobby-trust">
          {TRUST.map((t, i) => (
            <li key={t.title} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <strong>{t.title}</strong>
              <span>{t.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lobby-section lobby-end" data-reveal>
        <Link href="/rooms/new" className="cta" onClick={markEntered}>
          방 담기
        </Link>
        <p className="small muted">
          법률 자문이 아닌 참고용 안내예요. 최종 확인은 공인중개사 · 법률 전문가에게 받아 주세요. · <Link href="/privacy">개인정보 · 데이터 안내</Link>
        </p>
      </section>
    </main>
  );
}
