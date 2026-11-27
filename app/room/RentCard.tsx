"use client";
// 방 상세 "① 이 방, 안전한가요?" 아래: 이 방 보증금 · 월세를 같은 동 신고 거래와 비교(참고).
// 거래가 적거나 없으면 비교하지 않고 그대로 알려 준다(0이나 '적정'으로 치지 않음).
import { useEffect, useState } from "react";
import { compareRoom, monthSpan, type RentStats, type Spread } from "@/lib/rent";
import type { Room } from "@/lib/store/rooms";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ok"; stats: RentStats };

const won = (n: number) => n.toLocaleString("ko-KR");
const range = (s: Spread) => `${won(s.p25)}–${won(s.p75)}만 원 (중간 ${won(s.mid)})`;

export default function RentCard({ room }: { room: Pick<Room, "deposit" | "rent" | "region"> }) {
  const region = room.region;
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!region) return;
    let alive = true;
    setState({ kind: "loading" });
    const q = new URLSearchParams({ sgg: region.sgg, dong: region.dong });
    fetch(`/api/rent?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((stats: RentStats) => alive && setState({ kind: "ok", stats }))
      .catch(() => alive && setState({ kind: "error" }));
    return () => {
      alive = false;
    };
  }, [region]);

  if (!region) {
    return <p className="card small muted rent">동네(법정동)를 몰라서 동네 시세는 비교하지 않았어요.</p>;
  }
  if (state.kind === "loading") {
    return (
      <div className="card rent rent-loading" role="status" aria-label={`${region.dong} 시세를 찾는 중이에요`}>
        <span className="skel skel-title" />
        <span className="skel" />
        <span className="skel skel-short" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <p className="card small rent" role="status">
        지금은 동네 시세를 불러오지 못했어요.{" "}
        <a href="https://rt.molit.go.kr/" target="_blank" rel="noopener noreferrer">
          국토부 실거래가 공개시스템
        </a>
        에서 직접 볼 수 있어요.
      </p>
    );
  }

  const { stats } = state;
  const cmp = compareRoom({ deposit: room.deposit, rent: room.rent }, stats);
  const isMonthly = (room.rent ?? 0) > 0;
  return (
    <div className={`card rent rent-${cmp.level}`}>
      <p className="rent-head">
        <span className="rent-icon" aria-hidden="true">
          ▤
        </span>
        <strong>{cmp.text}</strong>
      </p>
      {isMonthly && stats.monthly && (
        <ul className="rent-lines small">
          <li>보증금: {range(stats.monthly.deposit)}</li>
          <li>월세: {range(stats.monthly.rent)}</li>
        </ul>
      )}
      {!isMonthly && stats.jeonse && (
        <ul className="rent-lines small">
          <li>전세 보증금: {range(stats.jeonse.deposit)}</li>
        </ul>
      )}
      <p className="small muted">
        {region.dong} 단독 · 다가구 {isMonthly ? "월세" : "전세"} 신고 거래 {(isMonthly ? stats.monthly?.count : stats.jeonse?.count) ?? 0}건, 최근{" "}
        {stats.months.length}개월({monthSpan(stats.months)} 계약) 기준 · 오피스텔 · 빌라는 들어 있지 않은 참고용이에요.
      </p>
      <p className="small muted">
        출처:{" "}
        <a href="https://www.data.go.kr/data/15126472/openapi.do" target="_blank" rel="noopener noreferrer">
          국토교통부 단독/다가구 전월세 신고(공공데이터포털)
        </a>
      </p>
    </div>
  );
}
