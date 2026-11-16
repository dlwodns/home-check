"use client";
// 홈 = 내 후보 방. "관심 있는 방, 계약해도 될까요?" — 방마다 점검 결과(신호등)와 6단계 진행을 한눈에.
import Link from "next/link";
import BrandMark from "./ui/BrandMark";
import { branches, steps } from "@/lib/content";
import { roomHref } from "@/lib/store/rooms";
import StepBar from "./ui/StepBar";
import { checkLine, moneyLine, roomSteps, VERDICT_TEXT } from "./ui/roomView";
import { useProgress } from "./ui/useProgress";
import { useRooms } from "./ui/useRooms";

export default function RoomsHome() {
  const { rooms, loaded } = useRooms();
  const { progress } = useProgress();

  return (
    <main className="container home">
      <p className="brand">
        <BrandMark />
        홈체크
      </p>
      <h1>
        관심 있는 방,
        <br />
        <span className="accent">계약해도 될까요?</span>
      </h1>
      <p className="muted lead">위험부터 확인하고, 그 방에 맞는 계약 방법까지 알려 드려요</p>

      {loaded && rooms.length > 0 && (
        <section aria-labelledby="rooms-title" className="rooms">
          <div className="rooms-head">
            <h2 id="rooms-title">
              내 후보 방 <span className="accent">{rooms.length}</span>
            </h2>
            <span className="small muted">로그인 없이 이 휴대폰에 저장돼요</span>
          </div>
          <ul className="room-list">
            {rooms.map((r) => {
              const { segs, current } = roomSteps(r, progress.mode, steps, branches);
              return (
                <li key={r.id}>
                  <Link href={roomHref(r.id)} className="room-card">
                    <span className="room-top">
                      <span className="room-name">
                        <strong>{r.label}</strong>
                        <span className="small muted">
                          {r.label !== r.address ? `${r.address} · ` : ""}
                          {moneyLine(r)}
                        </span>
                      </span>
                      {r.check ? (
                        <span className={`pill pill-${r.check.verdict}`}>
                          <span className="dot" aria-hidden="true" />
                          {VERDICT_TEXT[r.check.verdict].label}
                        </span>
                      ) : (
                        <span className="pill pill-none">점검 전</span>
                      )}
                    </span>
                    <span className="room-line">{checkLine(r.check)}</span>
                    <StepBar segs={segs} />
                    <span className="small muted">{current ? `지금 ${current.no}단계 · ${current.title}` : "모든 단계를 마쳤어요"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {loaded && rooms.length === 0 && (
        <section className="card empty">
          <h2>아직 담은 방이 없어요</h2>
          <p className="muted">직방 · 다방 · 중개사무소 · 직거래, 어디서 찾았든 주소와 보증금만 적으면 돼요.</p>
        </section>
      )}

      <Link href="/rooms/new" className={rooms.length ? "add-room" : "cta"}>
        + 후보 방 추가 · 주소와 보증금만
      </Link>

      <nav className="home-links" aria-label="다른 길">
        <Link href="/guide">아직 방을 못 찾았어요 · 계약 과정 미리 보기 →</Link>
        <Link href="/check">등기부등본만 바로 점검하기 →</Link>
      </nav>
    </main>
  );
}
