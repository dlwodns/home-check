// @vitest-environment jsdom
// 로그인 · 가입 화면: 가입 전 이메일 한 번 더 확인, 비밀번호 안내, 오류 문장, 키가 없을 때.
import type { AnchorHTMLAttributes } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const auth = {
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
  signUp: vi.fn(async () => ({ error: null })),
  signInWithPassword: vi.fn(async () => ({ error: null as null | { message: string } })),
};
let enabled = true;
vi.mock("@/lib/cloud/client", () => ({ getSupabase: () => (enabled ? { auth } : null) }));

const { default: LoginClient } = await import("@/app/login/LoginClient");

beforeEach(() => {
  enabled = true;
  push.mockClear();
  Object.values(auth).forEach((f) => f.mockClear());
});
afterEach(cleanup);

describe("가입", () => {
  it("다음 → '이 주소가 맞나요?' → 맞아요를 눌러야 가입하고, 홈으로 간다", async () => {
    const user = userEvent.setup();
    render(<LoginClient />);
    await user.click(await screen.findByRole("tab", { name: /가입/ }));
    expect(screen.getByText(/비밀번호를 잊으면 이 계정에 다시 들어올 수 없어요/)).toBeTruthy();
    await user.type(screen.getByLabelText("이메일"), " Me@Example.com ");
    await user.type(screen.getByLabelText(/^비밀번호 \(8자 이상\)/), "longenough1");
    await user.type(screen.getByLabelText("비밀번호 한 번 더"), "longenough1");
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "이메일 확인" }).textContent).toContain("me@example.com");
    await user.click(screen.getByRole("button", { name: "맞아요, 가입하기" }));
    expect(auth.signUp).toHaveBeenCalledWith({ email: "me@example.com", password: "longenough1" });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("'고치기'를 누르면 다시 고칠 수 있고, 두 비밀번호가 다르면 막는다", async () => {
    const user = userEvent.setup();
    render(<LoginClient />);
    await user.click(await screen.findByRole("tab", { name: /가입/ }));
    await user.type(screen.getByLabelText("이메일"), "a@b.co");
    await user.type(screen.getByLabelText(/^비밀번호 \(8자 이상\)/), "longenough1");
    await user.type(screen.getByLabelText("비밀번호 한 번 더"), "different1");
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("alert").textContent).toMatch(/두 비밀번호가 달라요/);
    expect(screen.queryByRole("group", { name: "이메일 확인" })).toBeNull();
  });
});

describe("로그인", () => {
  it("틀리면 쉬운 말로 알려 주고 홈으로 가지 않는다", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    const user = userEvent.setup();
    render(<LoginClient />);
    await user.type(await screen.findByLabelText("이메일"), "a@b.co");
    await user.type(screen.getByLabelText("비밀번호"), "whatever1");
    await user.click(screen.getAllByRole("button", { name: "로그인" }).at(-1)!);
    expect(await screen.findByText("이메일 또는 비밀번호가 맞지 않아요.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("키가 없으면(로그인 준비 전) 안내만 보이고 입력칸은 없다", async () => {
    enabled = false;
    render(<LoginClient />);
    expect(await screen.findByText(/로그인은 아직 준비 중이에요/)).toBeTruthy();
    expect(screen.queryByLabelText("이메일")).toBeNull();
  });
});
