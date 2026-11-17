"use client";
// 입구 판단: 처음 온 사람(들어온 적도, 담은 방도 없음) → 로비, 그 밖에는 바로 '내 후보 방'.
// 저장값은 브라우저에서만 읽을 수 있어서, 읽기 전에는 빈 화면(배경만)을 잠깐 그린다.
import { useEffect, useState } from "react";
import Lobby from "./Lobby";
import RoomsHome from "./RoomsHome";
import { hasEntered, markEntered } from "./ui/entered";
import { roomsStore } from "./ui/useProgress";

export default function HomeGate() {
  const [view, setView] = useState<"wait" | "lobby" | "rooms">("wait");
  useEffect(() => {
    const returning = hasEntered() || roomsStore().load().rooms.length > 0;
    if (returning) markEntered();
    setView(returning ? "rooms" : "lobby");
  }, []);
  if (view === "wait") return <main className="container" aria-busy="true" />;
  return view === "lobby" ? <Lobby /> : <RoomsHome />;
}
