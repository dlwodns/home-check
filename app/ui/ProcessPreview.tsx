"use client";
// '계약 과정 미리보기' 한 곳(11/28): 입구에서 고른 미리보기와 /guide가 같은 화면을 쓴다(이름 · 내용이 갈라지지 않게).
// 그림 6장(FlowPreview) + 끝 버튼: 방을 찾았으면 '방 담기', 아직이면 '방 찾기부터'(1단계). 다시 온 사람은 내 후보 방(홈)으로.
import Link from "next/link";
import FlowPreview from "./FlowPreview";
import { markEntered } from "./entered";

export const PREVIEW_NAME = "계약 과정 미리보기";

export default function ProcessPreview({ returning = false, hasRooms = false, onSkip }: { returning?: boolean; hasRooms?: boolean; onSkip?: () => void }) {
  return (
    <>
      <h1 className="welcome-q">{PREVIEW_NAME}</h1>
      <FlowPreview />
      {returning && onSkip ? (
        <button type="button" className="primary" onClick={onSkip}>
          {hasRooms ? "다음: 내 후보 방 →" : "다음: 홈 →"}
        </button>
      ) : (
        <Link href="/rooms/new" className="primary-link" onClick={markEntered}>
          다음: 방 담기 →
        </Link>
      )}
      <Link href="/steps/1" className="nav-btn" onClick={markEntered}>
        다음: 방 찾기부터 →
      </Link>
      <p className="small muted">방을 찾았으면 &apos;방 담기&apos;, 아직이면 &apos;방 찾기부터&apos;</p>
    </>
  );
}
