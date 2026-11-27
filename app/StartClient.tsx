"use client";
// 시작 화면의 두 갈래: 처음이에요(1단계부터, '어디서 찾았어요?' 먼저) / 해 봤어요(바로 6단계 목록).
import Link from "next/link";
import FlowPreview from "./ui/FlowPreview";
import BrandMark from "./ui/BrandMark";
import { useRouter } from "next/navigation";
import { useProgress } from "./ui/useProgress";
import HomeLink from "./ui/HomeLink";

export default function StartClient() {
  const router = useRouter();
  const { progress, update, loaded } = useProgress();
  const started = loaded && progress.mode !== null;

  const go = (mode: "first" | "experienced") => {
    update((p) => ({ ...p, mode }));
    router.push(mode === "first" && !progress.branch ? "/where" : "/steps");
  };

  return (
    <main className="container start">
      <nav className="topbar">
        <Link href="/" className="back" aria-label="내 후보 방으로">
          ←
        </Link>
        <span>계약 과정 미리 보기</span>
        <HomeLink />
      </nav>
      <p className="brand">
        <BrandMark />
        홈체크
      </p>
      <h1>
        처음 하는 집계약,
        <br />
        한 단계씩 같이 해요
      </h1>
      <p className="muted">방을 찾기 전이라도 괜찮아요. 계약 완료까지 지금 할 일을 순서대로 알려 드려요.</p>
      <FlowPreview />

      {started && (
        <Link href="/steps" className="cta">
          하던 것 이어서 하기
        </Link>
      )}

      <div className="choices">
        <button type="button" className="choice choice-main" onClick={() => go("first")}>
          <strong>처음이에요</strong>
          <span>1단계부터 하나씩 알려 드려요</span>
        </button>
        <button type="button" className="choice" onClick={() => go("experienced")}>
          <strong>해 봤어요</strong>
          <span>필요한 단계나 서류 점검으로 바로 가요</span>
        </button>
      </div>

      <section className="card">
        <h2>홈체크가 도와주는 것</h2>
        <ol className="plain">
          <li>계약까지 6단계, 지금 할 일 안내</li>
          <li>등기부등본 위험 신호를 쉬운 말로 점검</li>
          <li>어려운 용어는 눌러서 바로 뜻 보기</li>
        </ol>
        <Link href="/rooms/new">방을 찾았다면: 후보 방 추가하기 →</Link>
      </section>
      <p className="muted small">진행 상황은 지금 이 브라우저에만 저장돼요.</p>
    </main>
  );
}
