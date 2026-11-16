"use client";
// 내 후보 방 목록을 화면에서 쓰는 훅. 첫 화면은 빈 목록으로 그리고, 브라우저에서 저장된 방을 불러온다.
import { useCallback, useEffect, useState } from "react";
import { EMPTY_ROOMS, type RoomsState } from "@/lib/store/rooms";
import { roomsStore } from "./useProgress";

export function useRooms() {
  const [state, setState] = useState<RoomsState>(EMPTY_ROOMS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(roomsStore().load());
    setLoaded(true);
  }, []);

  /** 저장소의 최신 값에 바꿀 내용을 적용한다 (다른 화면에서 바뀐 체크를 덮어쓰지 않게) */
  const update = useCallback((change: (s: RoomsState) => RoomsState) => {
    const store = roomsStore();
    const next = change(store.load());
    store.save(next);
    setState(next);
    return next;
  }, []);

  return { rooms: state.rooms, update, loaded };
}
