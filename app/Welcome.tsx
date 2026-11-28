"use client";
// 앱을 열 때마다 보이는 입구(11/28): ① 로고 + [시작하기]만(누를 때까지 그대로) → ② 과정 먼저 알아보기 / 건너뛰기.
// 처음 온 사람: "집 계약, 해 본 적 있어요?" → 처음이면 과정 미리보기, 해 봤으면 건너뛰고 방 담기.
// 다시 온 사람(returning): "과정 다시 볼까요?" → 미리보기 또는 건너뛰고 '내 후보 방'(onSkip). 이미 고른 처음/해 봤어요는 바꾸지 않는다.
// 참고: 당근 · 듀오링고 첫 화면(버튼 하나), 듀오링고 '처음부터 / 내 수준 찾기', Speeko(질문 이유 한 줄), Trainual(설명은 원할 때만),
// Shazam · Audible(가입 없이 바로 써 보는 길 → '등기부등본만 바로 점검'). 긴 소개 페이지는 /welcome(홈체크 소개)에 남긴다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FlowPreview from "./ui/FlowPreview";
import { markEntered } from "./ui/entered";
import { useProgress } from "./ui/useProgress";

export default function Welcome({ returning = false, hasRooms = false, onSkip }: { returning?: boolean; hasRooms?: boolean; onSkip?: () => void }) {
  const router = useRouter();
  const { update } = useProgress();
  const [stage, setStage] = useState<"start" | "ask" | "preview">("start");

  const choose = (mode: "first" | "experienced") => {
    if (returning) {
      if (mode === "first") setStage("preview");
      else onSkip?.();
      return;
    }
    update((p) => ({ ...p, mode }));
    if (mode === "first") setStage("preview");
    else {
      markEntered();
      router.push("/rooms/new");
    }
  };

  if (stage === "start")
    return (
      <main className="welcome">
        <div className="lobby-mark" aria-hidden="true">
          <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path className="draw draw-1" pathLength={1} d="M3 11l9-7 9 7" />
            <path className="draw draw-2" pathLength={1} d="M6 10v9h12v-9" />
            <path className="draw draw-3" pathLength={1} d="M9 13.6l2.2 2.2 4-4.2" />
          </svg>
        </div>
        <p className="welcome-brand rise rise-2">홈체크</p>
        <h1 className="lobby-title">
          <span className="rise rise-2">이 방,</span>
          <span className="rise rise-3 accent">계약해도 될까?</span>
        </h1>
        <div className="welcome-actions rise rise-4">
          <button type="button" className="primary" onClick={() => setStage("ask")}>
            시작하기
          </button>
          <Link href="/check" className="nav-btn" onClick={markEntered}>
            등기부등본만 바로 점검
          </Link>
        </div>
        <p className="small muted welcome-foot">
          참고용 안내예요. 최종 확인은 공인중개사 · 법률 전문가에게. · <Link href="/welcome">홈체크 소개</Link>
        </p>
      </main>
    );

  if (stage === "ask")
    return (
      <main className="welcome welcome-ask">
        <h1 className="welcome-q">{returning ? "집 구하는 과정, 다시 볼까요?" : "집 계약, 해 본 적 있어요?"}</h1>
        <p className="muted">{returning ? hasRooms ? "건너뛰면 담아 둔 방으로 바로 가요." : "건너뛰면 홈으로 가요. 관심 있는 방을 바로 담을 수 있어요." : "해 봤다면 아는 단계(준비 · 집 찾기 · 집 보기)는 접어 둘게요."}</p>
        <div className="welcome-choices">
          <button type="button" className="primary" onClick={() => choose("first")}>
            {returning ? "과정 알아보기" : "처음이에요 · 과정 먼저 알아보기"}
          </button>
          <button type="button" className="ghost welcome-skip" onClick={() => choose("experienced")}>
            {returning ? "건너뛰기" : "해 봤어요 · 건너뛰기"}
          </button>
        </div>
        <button type="button" className="ghost" onClick={() => setStage("start")}>
          ← 이전: 처음 화면
        </button>
      </main>
    );

  return (
    <main className="welcome welcome-preview">
      <h1 className="welcome-q">이렇게 함께 해요</h1>
      <FlowPreview />
      {returning ? (
        <button type="button" className="primary" onClick={onSkip}>
          {hasRooms ? "다음: 내 후보 방 →" : "다음: 홈 →"}
        </button>
      ) : (
        <Link href="/rooms/new" className="primary-link" onClick={markEntered}>
          다음: 방 담기 →
        </Link>
      )}
      {/* 방이 아직 없으면 같은 미리보기(/guide)를 또 보여 주지 않고 1단계(준비)부터 한 길로 */}
      <Link href="/steps/1" className="nav-btn" onClick={markEntered}>
        다음: 방 찾기부터 →
      </Link>
      <p className="small muted">방을 찾았으면 &apos;방 담기&apos;, 아직이면 &apos;방 찾기부터&apos;</p>
    </main>
  );
}
