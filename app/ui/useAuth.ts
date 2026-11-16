"use client";
// 지금 로그인한 사람(있으면). 키가 없으면 enabled=false → 화면은 로그인 버튼을 숨기고 지금처럼 동작한다.
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/cloud/client";

export interface AuthUser {
  id: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    setEnabled(Boolean(sb));
    if (!sb) {
      setLoaded(true);
      return;
    }
    let alive = true;
    const toUser = (u: { id: string; email?: string | null } | null | undefined) => (u ? { id: u.id, email: u.email ?? "" } : null);
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(toUser(data.session?.user));
      setLoaded(true);
    });
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(toUser(session?.user));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { user, loaded, enabled };
}
