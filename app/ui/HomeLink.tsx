// 화면 위쪽 오른편 홈체크 로고: 누르면 홈(처음 온 사람은 로비, 들어와 본 사람은 '내 후보 방')으로.
import Link from "next/link";

export default function HomeLink() {
  return (
    <Link href="/" className="home-link" aria-label="홈으로" title="홈으로">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-7 9 7" />
        <path d="M6 10v9h12v-9" />
        <path d="M9 13.6l2.2 2.2 4-4.2" />
      </svg>
      <span>홈체크</span>
    </Link>
  );
}
