"use client";
// "이 방, 어디서 찾았어요?" — 고른 갈래에 따라 4단계에 중개사 · 직거래 체크리스트가 붙는다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Branch } from "@/lib/store/progress";
import { roomHref, withRoom } from "@/lib/store/rooms";
import { useProgress } from "../ui/useProgress";
import HomeLink from "../ui/HomeLink";

const OPTIONS: { id: Branch; title: string; desc: string }[] = [
  { id: "broker", title: "공인중개사를 통해서", desc: "중개사무소, 직방 · 다방의 중개 매물" },
  { id: "direct", title: "집주인과 직접 (직거래)", desc: "피터팬 같은 직거래 카페, 커뮤니티, 지인 소개" },
  { id: "none", title: "아직 못 찾았어요", desc: "예산 정하기부터 같이 시작해요" },
];

export default function WhereClient({ question }: { question: string }) {
  const router = useRouter();
  const { progress, update, loaded, room, roomId } = useProgress();
  const [picked, setPicked] = useState<Branch | null>(null);

  useEffect(() => {
    if (loaded) setPicked(progress.branch);
  }, [loaded, progress.branch]);

  const next = () => {
    if (!picked) return;
    update((p) => ({ ...p, branch: picked, mode: p.mode ?? "first" }));
    router.push(withRoom("/steps", roomId));
  };

  return (
    <main className="container check">
      <nav className="topbar">
        <Link href={room ? roomHref(room.id) : "/guide"} className="back" aria-label={room ? "이 방으로" : "처음 화면으로"}>
          ←
        </Link>
        <span>시작하기</span>
        <HomeLink />
      </nav>
      <h1 className="title">{question}</h1>
      <p className="muted">어디서 찾았는지에 따라 내가 챙길 것이 달라져요.</p>

      <div className="choices" role="radiogroup" aria-label={question}>
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={picked === o.id}
            className={`choice${picked === o.id ? " choice-picked" : ""}`}
            onClick={() => setPicked(o.id)}
          >
            <strong>{o.title}</strong>
            <span>{o.desc}</span>
          </button>
        ))}
      </div>

      {picked === "direct" && (
        <p className="card warn small">
          직거래는 중개수수료가 없는 대신, <strong>집주인 본인 확인</strong>을 내가 직접 해야 해요. 직거래 전용
          체크리스트를 4단계에 넣어 둘게요.
        </p>
      )}
      {picked === "broker" && (
        <p className="card small">
          중개사가 있어도 <strong>내가 직접 확인해야 하는 것</strong>이 있어요. 중개사 체크리스트를 4단계에 넣어 둘게요.
        </p>
      )}

      <button type="button" className="primary" disabled={!picked} onClick={next}>
        다음
      </button>
    </main>
  );
}
