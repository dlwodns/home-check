"use client";
// 화면을 그리다 뜻밖의 오류가 나면 Next.js 기본(영어) 화면 대신 이 화면. 저장된 방은 브라우저에 그대로라고 안심시키고 갈 곳을 준다.
import Link from "next/link";
import BrandMark from "./ui/BrandMark";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container check">
      <p className="brand">
        <BrandMark />
        홈체크
      </p>
      <h1 className="title">화면을 여는 중에 문제가 생겼어요</h1>
      <p className="muted">담아 둔 후보 방과 체크는 이 기기에 그대로 있어요. 다시 시도하거나 처음 화면으로 가 주세요.</p>
      <button type="button" className="cta" onClick={reset}>
        다시 시도
      </button>
      <Link href="/" className="cta cta-soft">
        내 후보 방으로
      </Link>
    </main>
  );
}
