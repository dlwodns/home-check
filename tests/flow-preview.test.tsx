// @vitest-environment jsdom
// 계약 과정 미리보기(A): 화면 파일이 실제로 있고, 이전 · 다음 · 멈춤이 되며, 동작 줄이기 환경에서는 자동으로 넘기지 않는다.
import { existsSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import FlowPreview, { SLIDES } from "@/app/ui/FlowPreview";

describe("계약 과정 미리보기", () => {
  it("미리보기 화면 파일이 모두 있다", () => {
    for (const s of SLIDES) expect(existsSync(`public${s.src}`), s.src).toBe(true);
  });

  it("처음엔 ①, 다음 · 이전으로 넘기고, 자동 재생은 멈춘 채로 시작한다(matchMedia 없는 환경)", async () => {
    const user = userEvent.setup();
    render(<FlowPreview />);
    expect(screen.getByText(SLIDES[0].title)).toBeTruthy();
    expect(screen.getByRole("button", { name: "재생" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "다음 화면" }));
    expect(screen.getByText(SLIDES[1].title)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "이전 화면" }));
    await user.click(screen.getByRole("button", { name: "이전 화면" }));
    expect(screen.getByText(SLIDES[SLIDES.length - 1].title)).toBeTruthy();
    expect(screen.getByRole("img", { name: `${SLIDES[SLIDES.length - 1].title} 화면` })).toBeTruthy();
  });
});
