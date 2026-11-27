"use client";
// 처음 온 사람의 입구(11/28): ① 로고 + [시작하기]만 → ② "집 계약, 해 본 적 있어요?" → 처음이면 과정 미리보기, 해 봤으면 건너뛰고 방 담기.
// 참고: 당근 · 듀오링고 첫 화면(버튼 하나), 듀오링고 '처음부터 / 내 수준 찾기', Speeko(질문 이유 한 줄), Trainual(설명은 원할 때만),
// Shazam · Audible(가입 없이 바로 써 보는 길 → '등기부등본만 바로 점검'). 긴 소개 페이지는 /welcome(홈체크 소개)에 남긴다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FlowPreview from "./ui/FlowPreview";
import { markEntered } from "./ui/entered";
import { useProgress } from "./ui/useProgress";

export default function Welcome() {
  const router = useRouter();
  const { update } = useProgress();
  const [stage, setStage] = useState<"start" | "ask" | "preview">("start");

  const choose = (mode: "first" | "experienced") => {
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
          <Link href="/check" className="welcome-quick" onClick={markEntered}>
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
        <h1 className="welcome-q">집 계약, 해 본 적 있어요?</h1>
        <p className="muted">해 봤다면 아는 단계(준비 · 집 찾기 · 집 보기)는 접어 둘게요.</p>
        <div className="welcome-choices">
          <button type="button" className="primary" onClick={() => choose("first")}>
            처음이에요 · 과정 먼저 알아보기
          </button>
          <button type="button" className="ghost welcome-skip" onClick={() => choose("experienced")}>
            해 봤어요 · 건너뛰기
          </button>
        </div>
        <button type="button" className="linklike small" onClick={() => setStage("start")}>
          ← 처음 화면으로
        </button>
      </main>
    );

  return (
    <main className="welcome welcome-preview">
      <h1 className="welcome-q">이렇게 함께 해요</h1>
      <FlowPreview />
      <Link href="/rooms/new" className="primary-link" onClick={markEntered}>
        이제 방 담고 시작하기 →
      </Link>
      <Link href="/guide" className="small" onClick={markEntered}>
        아직 방을 못 찾았어요 · 6단계 미리 보기
      </Link>
    </main>
  );
}
