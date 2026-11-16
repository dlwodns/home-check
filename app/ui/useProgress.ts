"use client";
// 진행 상황(처음이에요/해 봤어요 · 갈래 · 체크)을 화면에서 쓰는 훅.
// 주소에 ?room=방id 가 붙으면 그 방의 진행 상황을, 없으면 방 없이 둘러보는 전체 진행 상황을 쓴다.
// 첫 화면은 빈 상태로 그리고(서버 화면과 맞추려고), 브라우저에서 저장된 값을 불러온다.
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_PROGRESS, localProgressStore, type Progress } from "@/lib/store/progress";
import { localRoomsStore, roomIdFrom, roomProgress, updateRoom, type Room } from "@/lib/store/rooms";

const storage = () => (typeof window === "undefined" ? null : window.localStorage);
export const progressStore = () => localProgressStore(storage());
export const roomsStore = () => localRoomsStore(storage());

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [room, setRoom] = useState<Room | null>(null);
  const [loaded, setLoaded] = useState(false);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    const global = progressStore().load();
    const id = roomIdFrom(window.location.search);
    const found = id ? roomsStore().load().rooms.find((r) => r.id === id) ?? null : null;
    roomIdRef.current = found?.id ?? null;
    setRoom(found);
    setProgress(found ? roomProgress(found, global.mode) : global);
    setLoaded(true);
  }, []);

  const update = useCallback((change: (p: Progress) => Progress) => {
    setProgress((prev) => {
      const next = change(prev);
      const roomId = roomIdRef.current;
      if (roomId) {
        // 갈래 · 체크는 방에, 처음이에요/해 봤어요는 사람 기준이라 전체 설정에 저장한다
        const rs = roomsStore();
        rs.save(updateRoom(rs.load(), roomId, (r) => ({ ...r, branch: next.branch, checked: next.checked })));
        const ps = progressStore();
        ps.save({ ...ps.load(), mode: next.mode });
      } else {
        progressStore().save(next);
      }
      return next;
    });
  }, []);

  return { progress, update, loaded, room, roomId: room?.id ?? null };
}
