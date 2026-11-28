"use client";
// 방 없이 보는 '계약까지 가는 길'(11/28 UX): 방 화면과 같은 길 모양. 1 · 2단계(준비 · 집 찾기)를 하고,
// 방을 찾으면 '방 담기'로 이어진다(3단계부터는 방마다 한다). 방 안에서 열면 그 방의 길로 보낸다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Branch, Step } from "@/lib/content";
import { stepStats } from "@/lib/store/stats";
import { roomHref } from "@/lib/store/rooms";
import { useProgress } from "../ui/useProgress";
import { setTermsOff, useTermsOff } from "../ui/termPrefs";
import HomeLink from "../ui/HomeLink";
import BackButton from "../ui/Back";
import PathList, { type PathRow } from "../ui/PathList";

export default function StepsClient({ steps, branches }: { steps: Step[]; branches: Branch[] }) {
  const { progress, loaded, room } = useProgress();
  const router = useRouter();
  const termsOff = useTermsOff();
  useEffect(() => {
    if (room) router.replace(roomHref(room.id));
  }, [room, router]);

  const stats = stepStats(steps, branches, progress);
  const before = steps.filter((s) => s.no <= 2);
  const cur = before.find((s) => stats.perStep[s.no - 1].done < stats.perStep[s.no - 1].total) ?? null;
  const rows: PathRow[] = steps.map((s) => {
    const st = stats.perStep[s.no - 1];
    if (s.no <= 2) return { key: s.id, no: s.no, title: s.title, status: cur?.no === s.no ? "current" : st.done === st.total ? "done" : "locked", href: `/steps/${s.no}` };
    return { key: s.id, no: s.no, title: s.title, status: "locked", lockedHint: "방을 담으면 3단계부터 이어서 해요" };
  });
  // 1 · 2단계를 다 했으면 지금 할 일은 '방 담기'(3단계 자리에 카드)
  if (!cur) rows[2] = { ...rows[2], status: "current" };

  return (
    <main className="container check">
      <nav className="topbar">
        <BackButton fallback="/" />
        <HomeLink />
        <span>계약까지 가는 길</span>
      </nav>
      <h1 className="title">아직 방을 찾기 전이에요</h1>
      <p className="muted small">1 · 2단계를 하고 방을 찾으면 담아서 이어 가요</p>

      {loaded && (
        <PathList
          rows={rows}
          current={
            cur ? (
              <>
                <p className="focus-kicker">지금 할 일 · {cur.no} / 6</p>
                <h2>{cur.title}</h2>
                <p className="focus-why">{cur.summary}</p>
                <Link href={`/steps/${cur.no}`} className="primary-link">
                  이 단계 시작하기 →
                </Link>
              </>
            ) : (
              <>
                <p className="focus-kicker">지금 할 일</p>
                <h2>방을 찾았나요?</h2>
                <p className="focus-why">주소와 보증금만 담으면 3단계부터 그 방에 맞춰 이어 가요</p>
                <Link href="/rooms/new" className="primary-link">
                  다음: 방 담기 →
                </Link>
              </>
            )
          }
        />
      )}

      <Link href="/check" className="nav-btn">
        등기부등본만 바로 점검
      </Link>
      {termsOff && (
        <p className="small muted">
          어려운 말 밑줄 · 설명이 꺼져 있어요 ·{" "}
          <button type="button" className="linklike" onClick={() => setTermsOff(false)}>
            다시 켜기
          </button>
        </p>
      )}
    </main>
  );
}
