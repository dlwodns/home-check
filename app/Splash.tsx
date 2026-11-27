"use client";
// 앱을 새로 열 때마다 짧은 입구 효과(로비와 같은 로고 그리기 · 제목 떠오르기). 누르면 바로 넘어간다.
// 같은 탭에서 홈으로 돌아올 때는 다시 나오지 않고(sessionStorage), '동작 줄이기'면 나오지 않는다(HomeGate).
import { useEffect } from "react";

export const SPLASH_MS = 1400;

export default function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, SPLASH_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <main className="splash" onClick={onDone}>
      <div className="lobby-mark" aria-hidden="true">
        <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path className="draw draw-1" pathLength={1} d="M3 11l9-7 9 7" />
          <path className="draw draw-2" pathLength={1} d="M6 10v9h12v-9" />
          <path className="draw draw-3" pathLength={1} d="M9 13.6l2.2 2.2 4-4.2" />
        </svg>
      </div>
      <h1 className="lobby-title">
        <span className="rise rise-2">이 방,</span>
        <span className="rise rise-3 accent">계약해도 될까?</span>
      </h1>
      <button type="button" className="linklike muted splash-skip" onClick={onDone}>
        건너뛰기
      </button>
    </main>
  );
}
