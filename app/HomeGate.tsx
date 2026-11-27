"use client";
// 입구 판단: 처음 온 사람(들어온 적도, 담은 방도 없음) → 로비, 그 밖에는 바로 '내 후보 방'.
// 저장값은 브라우저에서만 읽을 수 있어서, 읽기 전에는 빈 화면(배경만)을 잠깐 그린다.
import { useCallback, useEffect, useState } from "react";
import Lobby from "./Lobby";
import RoomsHome from "./RoomsHome";
import Splash from "./Splash";
import { hasEntered, markEntered } from "./ui/entered";
import { roomsStore } from "./ui/useProgress";

const SPLASH_KEY = "homecheck.splash.v1";

/** 이 탭에서 처음 여는 것이면 true(그리고 기억). 동작 줄이기 · 확인할 수 없는 환경이면 false */
function firstOpenInTab(): boolean {
  try {
    if (sessionStorage.getItem(SPLASH_KEY)) return false;
    sessionStorage.setItem(SPLASH_KEY, "1");
  } catch {
    return false;
  }
  return typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HomeGate() {
  const [view, setView] = useState<"wait" | "lobby" | "splash" | "rooms">("wait");
  useEffect(() => {
    const returning = hasEntered() || roomsStore().load().rooms.length > 0;
    const splash = firstOpenInTab(); // 로비(처음 온 사람)는 자체 효과가 있어 기억만 한다
    if (returning) markEntered();
    setView(returning ? (splash ? "splash" : "rooms") : "lobby");
  }, []);
  const toRooms = useCallback(() => setView("rooms"), []);
  if (view === "wait") return <main className="container" aria-busy="true" />;
  if (view === "splash") return <Splash onDone={toRooms} />;
  return view === "lobby" ? <Lobby /> : <RoomsHome />;
}
