"use client";
// 내 계정: 저장 상태 · 로그아웃 · 계정에 저장된 기록 지우기 · 계정 삭제. 지우는 것은 모두 한 번 더 확인한다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/cloud/client";
import { maskEmail } from "@/lib/cloud/auth";
import { supabaseDb } from "@/lib/cloud/sync";
import { currentSyncStatus, SYNC_EVENT, type SyncStatus } from "../ui/CloudSync";
import { useAuth } from "../ui/useAuth";

const STATUS_TEXT: Record<SyncStatus, string> = {
  off: "계정 저장 대기 중",
  syncing: "계정에 저장하는 중…",
  saved: "✓ 계정에도 저장돼 있어요",
  error: "계정에 저장하지 못했어요. 인터넷 연결을 확인해 주세요. 이 휴대폰에는 저장돼 있어요.",
};

type Confirm = null | "clear" | "delete";

export default function AccountClient() {
  const router = useRouter();
  const { user, loaded, enabled } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("off");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(currentSyncStatus());
    const on = (e: Event) => setStatus((e as CustomEvent<SyncStatus>).detail);
    window.addEventListener(SYNC_EVENT, on);
    return () => window.removeEventListener(SYNC_EVENT, on);
  }, []);

  const sb = getSupabase();

  const logout = async () => {
    await sb?.auth.signOut();
    router.push("/");
  };

  const clearCloud = async () => {
    if (!sb || !user) return;
    setBusy(true);
    try {
      await supabaseDb(sb, user.id).clear();
      await sb.auth.signOut(); // 다시 로그인하면 이 기기 기록이 새로 올라가므로, 지운 뒤에는 로그아웃해 둔다
      setMessage("계정에 저장된 기록을 지우고 로그아웃했어요. 이 휴대폰 기록은 남아 있어요.");
    } catch {
      setMessage("지우지 못했어요. 잠시 뒤 다시 해 주세요.");
    }
    setBusy(false);
    setConfirm(null);
  };

  const deleteAccount = async () => {
    if (!sb || !user) return;
    setBusy(true);
    const { error } = await sb.rpc("delete_my_account");
    if (error) {
      setMessage("계정을 지우지 못했어요. 잠시 뒤 다시 해 주세요.");
      setBusy(false);
      setConfirm(null);
      return;
    }
    await sb.auth.signOut();
    setBusy(false);
    setConfirm(null);
    setMessage("계정과 계정에 저장된 기록을 모두 지웠어요. 이 휴대폰 기록은 남아 있어요.");
  };

  return (
    <main className="container check">
      <nav className="topbar">
        <Link href="/" className="back" aria-label="내 후보 방으로">
          ←
        </Link>
        <span>내 계정</span>
      </nav>

      {message && (
        <p className="card small" role="status">
          {message}
        </p>
      )}

      {loaded && (!enabled || !user) && !message && (
        <div className="card">
          <p>로그인하지 않았어요. 기록은 이 휴대폰에만 저장돼요.</p>
          {enabled && (
            <Link href="/login" className="cta">
              로그인 · 가입
            </Link>
          )}
        </div>
      )}

      {loaded && enabled && user && (
        <>
          <section className="card">
            <h1 className="title account-email">{maskEmail(user.email)}</h1>
            <p className="small" role="status">
              {STATUS_TEXT[status]}
            </p>
            <button type="button" className="ghost" onClick={logout}>
              로그아웃
            </button>
            <p className="small muted">로그아웃해도 이 휴대폰의 기록은 남아요. 같이 쓰는 기기라면 개인정보 안내에서 이 기기 기록도 지워 주세요.</p>
          </section>

          <section className="card">
            <h2>지우기</h2>
            {confirm === null && (
              <div className="row-buttons">
                <button type="button" className="ghost" onClick={() => setConfirm("clear")}>
                  계정에 저장된 기록 지우기
                </button>
                <button type="button" className="ghost danger" onClick={() => setConfirm("delete")}>
                  계정 삭제
                </button>
              </div>
            )}
            {confirm !== null && (
              <div className="row-buttons" role="group" aria-label="지우기 확인">
                <span className="small">
                  {confirm === "clear"
                    ? "계정에 저장된 후보 방 · 체크가 지워져요. 이 휴대폰 기록은 남아요."
                    : "계정과 계정에 저장된 기록이 모두 지워지고 되돌릴 수 없어요. 이 휴대폰 기록은 남아요."}
                </span>
                <button type="button" className="ghost danger" disabled={busy} onClick={confirm === "clear" ? clearCloud : deleteAccount}>
                  {confirm === "clear" ? "기록 지우기" : "계정 삭제하기"}
                </button>
                <button type="button" className="ghost" onClick={() => setConfirm(null)}>
                  취소
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
