// @vitest-environment jsdom
// 집 계약 과정 미리보기(그림): 6단계가 그림 · 한 줄 · 왜 해요 · 홈체크가 도와주는 것으로 하나씩 넘어가고, 자동으로 넘기지 않는다.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import FlowPreview, { SLIDES } from "@/app/ui/FlowPreview";
import { steps } from "@/lib/content";

describe("집 계약 과정 미리보기", () => {
  it("6단계 제목이 계약 단계 데이터와 같은 순서 · 이름이다", () => {
    expect(SLIDES.map((s) => s.title)).toEqual(steps.map((s) => `${s.no}. ${s.title}`));
  });

  it("장마다 그림(이름 있는 그림) · 왜 해요 · 홈체크가 도와주는 것이 있고, 이전 · 다음 · 점으로 넘긴다", async () => {
    const user = userEvent.setup();
    render(<FlowPreview />);
    expect(screen.getByRole("heading", { name: SLIDES[0].title })).toBeTruthy();
    expect(screen.getByRole("img", { name: /지갑과 동전/ })).toBeTruthy();
    expect(screen.getByText("왜 해요?")).toBeTruthy();
    expect((screen.getByRole("button", { name: "← 이전 장" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "다음 장 →" }));
    expect(screen.getByRole("heading", { name: SLIDES[1].title })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "4. 계약 전 서류 확인" }));
    expect(screen.getByText("가장 중요해요")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "6. 입주 후" }));
    expect((screen.getByRole("button", { name: "다음 장 →" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/여기까지가 계약 완료예요/)).toBeTruthy();
  });
});
