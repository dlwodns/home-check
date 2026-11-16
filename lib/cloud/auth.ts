// 로그인 · 가입 입력 검사와 오류 문장 (화면 없이 테스트할 수 있게 분리).
// 가입 확인 메일 · 비밀번호 찾기는 쓰지 않는다(11/17 결정) → 비밀번호 두 번 입력 · 주소 한 번 더 확인으로 실수를 줄인다.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // 비밀번호를 저장하는 방식(bcrypt)이 읽는 최대 길이

export interface AuthInput {
  email: string;
  password: string;
  password2?: string;
}

export type AuthErrors = Partial<Record<"email" | "password" | "password2", string>>;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateAuth(input: AuthInput, mode: "login" | "signup"): AuthErrors {
  const e: AuthErrors = {};
  const email = normalizeEmail(input.email);
  if (!email) e.email = "이메일을 적어 주세요.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "이메일 모양을 확인해 주세요. 예: name@example.com";
  if (!input.password) e.password = "비밀번호를 적어 주세요.";
  else if (mode === "signup" && input.password.length < PASSWORD_MIN) e.password = `비밀번호는 ${PASSWORD_MIN}자 이상으로 정해 주세요.`;
  else if (input.password.length > PASSWORD_MAX) e.password = `비밀번호는 ${PASSWORD_MAX}자까지 쓸 수 있어요.`;
  if (mode === "signup" && !e.password && input.password !== input.password2) e.password2 = "두 비밀번호가 달라요. 다시 확인해 주세요.";
  return e;
}

/** Supabase 오류 → 사람이 알아듣는 말. 모르는 오류는 원문을 보여 주지 않고 일반 문장으로 */
export function authErrorText(err: { message?: string; status?: number; code?: string } | null | undefined): string {
  if (!err) return "";
  const m = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (m.includes("already registered") || m.includes("user_already_exists") || m.includes("email_exists")) return "이미 가입한 이메일이에요. 로그인해 주세요.";
  if (m.includes("weak_password") || m.includes("password should")) return `비밀번호가 너무 쉬워요. ${PASSWORD_MIN}자 이상으로 섞어서 정해 주세요.`;
  if (err.status === 429 || m.includes("rate limit") || m.includes("over_request_rate_limit")) return "잠깐 너무 많이 시도했어요. 1분쯤 뒤에 다시 해 주세요.";
  if (m.includes("signup") && m.includes("disabled")) return "지금은 새로 가입할 수 없어요.";
  if (m.includes("fetch") || m.includes("network")) return "인터넷 연결을 확인해 주세요.";
  return "잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.";
}

/** 화면에 보여 줄 때 이메일 가운데를 가린다: dlwodns@gmail.com → dl*****@gmail.com */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "";
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}
