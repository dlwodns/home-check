"use client";
// 홈 = 내 후보 방. "관심 있는 방, 계약해도 될까요?" — 방마다 점검 결과(신호등)와 6단계 진행을 한눈에.
import Link from "next/link";
import BrandMark from "./ui/BrandMark";
import AccountLink from "./ui/AccountLink";
import { branches, steps } from "@/lib/content";
import { roomHref } from "@/lib/store/rooms";
import StepBar from "./ui/StepBar";
import { VERDICT_GLYPH } from "./ui/TrafficLight";
import { checkLine, freshVisit, lastRoomId, moneyLine, nextAction, roomSteps, VERDICT_TEXT } from "./ui/roomView";
import { useEffect, useState } from "react";
import { useProgress } from "./ui/useProgress";
import { useRooms } from "./ui/useRooms";

export default function RoomsHome() {
  const { rooms, loaded } = useRooms();
  const { progress } = useProgress();
  // 새로 들어왔을 때만 짧은 입장 효과(0.3초, 동작 줄이기면 없음) — 화면 안에서 오갈 때는 매번 나오지 않게
  const [enter, setEnter] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  useEffect(() => {
    setEnter(freshVisit());
    setLastId(lastRoomId());
  }, []);
  const continueRoom = rooms.find((r) => r.id === lastId) ?? rooms[0];
  const cont = continueRoom ? nextAction(continueRoom, progress.mode, steps, branches) : null;

  return (
    <main className={`container home${enter ? " enter" : ""}`}>
      <div className="home-top">
        <p className="brand">
          <BrandMark />
          홈체크
        </p>
        <AccountLink />
      </div>
      <h1>
        관심 있는 방,
        <br />
        <span className="accent">계약해도 될까요?</span>
      </h1>
      <p className="muted lead">위험부터 확인하고, 그 방에 맞는 계약 방법까지 알려 드려요</p>

      {loaded && continueRoom && cont && (
        <Link href={cont.href} className="continue-card">
          <span className="small muted">{continueRoom.id === lastId ? "지난번 본 방" : "이어서 하기"} · {continueRoom.label}</span>
          <strong>{cont.text}</strong>
          <span className="continue-go" aria-hidden="true">
            이어하기 →
          </span>
        </Link>
      )}

      {loaded && rooms.length > 0 && (
        <section aria-labelledby="rooms-title" className="rooms">
          <div className="rooms-head">
            <h2 id="rooms-title">
              내 후보 방 <span className="accent">{rooms.length}</span>
            </h2>
            <span className="small muted">이 기기에 저장돼요</span>
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
                          <span className="pill-glyph" aria-hidden="true">
                            {VERDICT_GLYPH[r.check.verdict]}
                          </span>
                          {VERDICT_TEXT[r.check.verdict].label}
                        </span>
                      ) : (
                        <span className="pill pill-none">점검 전</span>
                      )}
                    </span>
                    <span className="room-line">{checkLine(r.check)}</span>
                    <span className="room-next">다음 할 일: {nextAction(r, progress.mode, steps, branches).text}</span>
                    <StepBar segs={segs} />
                    {/* 다음 할 일이 이미 '지금 단계'를 말하면 같은 줄을 또 쓰지 않는다 */}
                    {!r.check && current && <span className="small muted">지금 {current.no}단계 · {current.title}</span>}
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
      <p className="small muted home-foot">
        참고용 안내예요 · <Link href="/welcome">홈체크 소개</Link> · <Link href="/privacy">개인정보 · 데이터 안내</Link>
      </p>
    </main>
  );
}
