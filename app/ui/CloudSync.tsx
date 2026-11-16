"use client";
// 로그인 중일 때만 동작: 로그인하면 이 기기 기록과 계정 기록을 합치고, 그 뒤로는 바뀔 때마다(1.2초 모아서) 계정에 올린다.
// 화면에는 아무것도 그리지 않고, 상태만 SYNC_EVENT로 알린다(SyncBadge가 보여 줌).
import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/cloud/client";
import { readLocal, supabaseDb, syncOnce, type SyncDb } from "@/lib/cloud/sync";
import { SAVED_EVENT } from "@/lib/store/events";
import { progressStore, roomsStore } from "./useProgress";

export const SYNC_EVENT = "homecheck:sync";
export type SyncStatus = "off" | "syncing" | "saved" | "error";

let lastStatus: SyncStatus = "off";
export const currentSyncStatus = () => lastStatus;

function announce(status: SyncStatus) {
  lastStatus = status;
  window.dispatchEvent(new CustomEvent<SyncStatus>(SYNC_EVENT, { detail: status }));
}

const stores = () => ({ rooms: roomsStore(), progress: progressStore() });

export default function CloudSync() {
  const db = useRef<SyncDb | null>(null);
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    const start = async (userId: string) => {
      db.current = supabaseDb(sb, userId);
      ready.current = false;
      announce("syncing");
      try {
        await syncOnce(db.current, stores());
        ready.current = true;
        announce("saved");
      } catch {
        announce("error");
      }
    };
    const stop = () => {
      db.current = null;
      ready.current = false;
      announce("off");
    };

    const { data } = sb.auth.onAuthStateChange((event, session) => {
      // 탭을 새로 열 때(INITIAL_SESSION)와 로그인할 때 한 번 합친다. 토큰 갱신 때는 다시 합치지 않는다
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION") && db.current === null) void start(session.user.id);
      if (!session?.user) stop();
    });

    const onSaved = () => {
      if (!db.current || !ready.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const target = db.current;
        if (!target) return;
        announce("syncing");
        try {
          await target.push(readLocal(stores()));
          announce("saved");
        } catch {
          announce("error");
        }
      }, 1200);
    };
    window.addEventListener(SAVED_EVENT, onSaved);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener(SAVED_EVENT, onSaved);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}
