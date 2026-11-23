// @vitest-environment jsdom
// 뜻밖의 오류 화면: 한글 안내 · 저장된 방은 그대로라는 안심 · '다시 시도'가 reset을 부른다
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";

vi.mock("next/link", () => ({ default: (p: { href: string; children: React.ReactNode; className?: string }) => <a href={p.href} className={p.className}>{p.children}</a> }));

describe("오류 화면", () => {
  it("한글로 안내하고, 다시 시도를 누르면 reset이 불린다", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("x")} reset={reset} />);
    expect(screen.getByRole("heading", { name: "화면을 여는 중에 문제가 생겼어요" })).toBeTruthy();
    expect(screen.getByText(/이 기기에 그대로 있어요/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "내 후보 방으로" }).getAttribute("href")).toBe("/");
  });
});
