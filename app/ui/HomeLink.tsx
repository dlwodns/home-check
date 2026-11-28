"use client";
// 화면 왼쪽 위(← 옆) 홈체크 로고: 모든 화면에서 같은 자리(홈 화면은 왼쪽 위 브랜드 로고). 누르면 홈(처음 온 사람은 로비, 들어와 본 사람은 '내 후보 방')으로 새로 불러온다.
// 화면 안 이동(Link) 대신 페이지를 새로 열고, 처음 열 때처럼 입구(로고 + 시작하기)부터 다시 보인다(11/28 사용자 요청).
import { replayEntry } from "./entered";

export default function HomeLink() {
  return (
    <a href="/" onClick={replayEntry} className="home-link" aria-label="홈체크 처음으로 (새로고침)" title="홈체크 처음으로">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-7 9 7" />
        <path d="M6 10v9h12v-9" />
        <path d="M9 13.6l2.2 2.2 4-4.2" />
      </svg>
    </a>
  );
}
