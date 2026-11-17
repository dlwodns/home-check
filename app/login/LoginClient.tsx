"use client";
// 로그인 · 가입. 가입 확인 메일 · 비밀번호 찾기는 없다(11/17 결정) → 비밀번호 두 번, 이메일 한 번 더 확인, 잊으면 못 들어온다는 안내.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { getSupabase } from "@/lib/cloud/client";
import { authErrorText, normalizeEmail, PASSWORD_MIN, validateAuth, type AuthErrors } from "@/lib/cloud/auth";
import { useAuth } from "../ui/useAuth";
import HomeLink from "../ui/HomeLink";

type Mode = "login" | "signup";

export default function LoginClient() {
  const router = useRouter();
  const { user, loaded, enabled } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [errors, setErrors] = useState<AuthErrors>({});
  const [serverError, setServerError] = useState("");
  const [confirming, setConfirming] = useState(false); // 가입 전 "이 주소가 맞나요?"
  const [busy, setBusy] = useState(false);
  const ids = { email: useId(), pw: useId(), pw2: useId() };

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
    setServerError("");
    setConfirming(false);
  };

  const run = async () => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setServerError("");
    const creds = { email: normalizeEmail(email), password };
    const { error } = mode === "login" ? await sb.auth.signInWithPassword(creds) : await sb.auth.signUp(creds);
    setBusy(false);
    if (error) {
      setConfirming(false);
      setServerError(authErrorText(error));
      return;
    }
    router.push("/");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateAuth({ email, password, password2 }, mode);
    setErrors(v);
    if (Object.keys(v).length) return;
    if (mode === "signup" && !confirming) {
      setConfirming(true);
      return;
    }
    void run();
  };

  const err = (k: keyof AuthErrors, id: string) =>
    errors[k] ? (
      <p className="error-text" id={`${id}-err`} role="alert">
        {errors[k]}
      </p>
    ) : null;

  return (
    <main className="container check">
      <nav className="topbar">
        <Link href="/" className="back" aria-label="내 후보 방으로">
          ←
        </Link>
        <span>{mode === "login" ? "로그인" : "가입하기"}</span>
        <HomeLink />
      </nav>

      {loaded && !enabled && (
        <p className="card">로그인은 아직 준비 중이에요. 지금은 이 휴대폰에만 저장돼요.</p>
      )}

      {loaded && enabled && user && (
        <div className="card">
          <p>이미 로그인했어요.</p>
          <Link href="/account" className="cta cta-soft">
            내 계정 보기
          </Link>
        </div>
      )}

      {loaded && enabled && !user && (
        <>
          <h1 className="title">{mode === "login" ? "다시 오셨네요" : "다른 기기에서도 이어 보기"}</h1>
          <p className="muted">로그인하면 후보 방과 체크가 계정에도 저장돼서 휴대폰 · PC 어디서나 이어서 볼 수 있어요. 로그인하지 않아도 모든 기능을 쓸 수 있어요.</p>

          <div className="seg-choice" role="tablist" aria-label="로그인 또는 가입">
            <button type="button" role="tab" aria-selected={mode === "login"} className={`chip${mode === "login" ? " chip-on" : ""}`} onClick={() => switchMode("login")}>
              로그인
            </button>
            <button type="button" role="tab" aria-selected={mode === "signup"} className={`chip${mode === "signup" ? " chip-on" : ""}`} onClick={() => switchMode("signup")}>
              처음이에요 · 가입
            </button>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor={ids.email}>이메일</label>
              <input
                id={ids.email}
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                disabled={confirming}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? `${ids.email}-err` : undefined}
              />
              {err("email", ids.email)}
            </div>
            <div className="field">
              <label htmlFor={ids.pw}>비밀번호{mode === "signup" ? ` (${PASSWORD_MIN}자 이상)` : ""}</label>
              <input
                id={ids.pw}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                disabled={confirming}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? `${ids.pw}-err` : undefined}
              />
              {err("password", ids.pw)}
            </div>
            {mode === "signup" && (
              <div className="field">
                <label htmlFor={ids.pw2}>비밀번호 한 번 더</label>
                <input
                  id={ids.pw2}
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  disabled={confirming}
                  onChange={(e) => setPassword2(e.target.value)}
                  aria-invalid={Boolean(errors.password2)}
                  aria-describedby={errors.password2 ? `${ids.pw2}-err` : undefined}
                />
                {err("password2", ids.pw2)}
              </div>
            )}

            {mode === "signup" && (
              <p className="card warn small">
                <strong>비밀번호를 잊으면 이 계정에 다시 들어올 수 없어요.</strong> 비밀번호 찾기 메일은 아직 없어요. 이 휴대폰에 저장된 기록은 그대로 남아요.
              </p>
            )}

            {confirming ? (
              <div className="card confirm-email" role="group" aria-label="이메일 확인">
                <p>
                  이 주소로 가입할게요. 맞나요?
                  <br />
                  <strong>{normalizeEmail(email)}</strong>
                </p>
                <div className="row-buttons">
                  <button type="submit" className="primary" disabled={busy}>
                    {busy ? "가입하는 중…" : "맞아요, 가입하기"}
                  </button>
                  <button type="button" className="ghost" onClick={() => setConfirming(false)}>
                    고치기
                  </button>
                </div>
              </div>
            ) : (
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "확인하는 중…" : mode === "login" ? "로그인" : "다음"}
              </button>
            )}
            {serverError && (
              <p className="error-text" role="alert">
                {serverError}
              </p>
            )}
          </form>
          <p className="small muted">
            이메일은 로그인에만 써요. <Link href="/privacy">개인정보 · 데이터 안내</Link>
          </p>
        </>
      )}
    </main>
  );
}
