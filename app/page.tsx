import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1>홈체크</h1>
      <p>처음 하는 집계약, 한 단계씩 같이 해요.</p>
      <p className="muted">방은 직방 · 다방에서 찾고, 계약은 홈체크와 함께.</p>
      <Link href="/check" className="cta">
        등기부등본 점검하기
      </Link>
      <p className="muted small">계약 단계 길잡이(처음이에요 / 해 봤어요)는 곧 열려요.</p>
    </main>
  );
}
