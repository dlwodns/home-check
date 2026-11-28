"use client";
// 입구 판단(11/28 사용자 요청): 앱을 새로 열 때마다 입구(Welcome: 로고 + 시작하기)가 떠 있고, 누를 때까지 넘어가지 않는다.
// 같은 탭에서 홈으로 돌아올 때는 다시 온 사람이면 바로 '내 후보 방'. 처음 온 사람(들어온 적도, 담은 방도 없음)은 늘 입구.
// 저장값은 브라우저에서만 읽을 수 있어서, 읽기 전에는 빈 화면(배경만)을 잠깐 그린다.
import { useCallback, useEffect, useState } from "react";
import Welcome from "./Welcome";
import RoomsHome from "./RoomsHome";
import { firstOpenInTab, hasEntered, markEntered } from "./ui/entered";
import { roomsStore } from "./ui/useProgress";

export default function HomeGate() {
  const [view, setView] = useState<"wait" | "welcome" | "rooms">("wait");
  const [returning, setReturning] = useState(false);
  const [hasRooms, setHasRooms] = useState(false);
  useEffect(() => {
    const rooms = roomsStore().load().rooms.length > 0;
    const back = hasEntered() || rooms;
    const fresh = firstOpenInTab();
    if (back) markEntered();
    setReturning(back);
    setHasRooms(rooms);
    setView(!back || fresh ? "welcome" : "rooms");
  }, []);
  const toRooms = useCallback(() => setView("rooms"), []);
  if (view === "wait") return <main className="container" aria-busy="true" />;
  return view === "welcome" ? <Welcome returning={returning} hasRooms={hasRooms} onSkip={toRooms} /> : <RoomsHome />;
}
