// @vitest-environment jsdom
// F1 계약 단계 길잡이를 사용자처럼 눌러 보는 테스트.
import { StrictMode, type AnchorHTMLAttributes } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { branches, steps } from "@/lib/content";
import StartClient from "@/app/StartClient";
import WhereClient from "@/app/where/WhereClient";
import StepsClient from "@/app/steps/StepsClient";
import StepClient from "@/app/steps/[no]/StepClient";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const KEY = "homecheck.progress.v1";
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? "null");
const seed = (p: object) => localStorage.setItem(KEY, JSON.stringify({ v: 1, mode: "first", branch: null, checked: {}, ...p }));

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
});
afterEach(cleanup);

describe("시작 화면", () => {
  it("처음이에요 → '어디서 찾았어요?'로, 선택이 저장된다", async () => {
    const user = userEvent.setup();
    render(<StartClient />);
    await user.click(screen.getByRole("button", { name: /처음이에요/ }));
    expect(push).toHaveBeenCalledWith("/where");
    expect(saved().mode).toBe("first");
  });

  it("해 봤어요 → 바로 6단계 목록으로", async () => {
    const user = userEvent.setup();
    render(<StartClient />);
    await user.click(screen.getByRole("button", { name: /해 봤어요/ }));
    expect(push).toHaveBeenCalledWith("/steps");
  });

  it("하던 게 있으면 '이어서 하기'가 보인다", async () => {
    seed({ mode: "first" });
    render(<StartClient />);
    expect(await screen.findByRole("link", { name: "하던 것 이어서 하기" })).toBeTruthy();
  });
});

describe("어디서 찾았어요?", () => {
  it("고르기 전엔 다음을 못 누르고, 직거래를 고르면 본인 확인 안내 후 저장 · 이동", async () => {
    const user = userEvent.setup();
    render(<WhereClient question="이 방, 어디서 찾았어요?" />);
    const next = screen.getByRole("button", { name: "다음" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    await user.click(screen.getByRole("radio", { name: /집주인과 직접/ }));
    expect(screen.getByText(/집주인 본인 확인/)).toBeTruthy();
    await user.click(next);
    expect(saved().branch).toBe("direct");
    expect(push).toHaveBeenCalledWith("/steps");
  });
});

describe("6단계 목록", () => {
  it("1 · 2단계를 다 했으면 3단계가 '지금 할 차례'", async () => {
    const checked = Object.fromEntries(
      steps.slice(0, 2).flatMap((s) => s.items.map((i) => [`${s.id}.${i.id}`, true])),
    );
    seed({ branch: "direct", checked });
    render(<StepsClient steps={steps} branches={branches} />);
    const current = await screen.findByText("지금 할 차례");
    expect(current.closest("a")?.getAttribute("href")).toBe("/steps/3");
    expect(screen.getByText(/6단계 중 2단계 완료/)).toBeTruthy();
  });
});

describe("단계 화면", () => {
  const step4 = steps.find((s) => s.no === 4)!;

  it("4단계 + 직거래: 직거래 체크리스트가 붙고, 체크하면 저장된다", async () => {
    seed({ branch: "direct" });
    const user = userEvent.setup();
    render(<StepClient step={step4} total={6} branches={branches} />);
    expect(await screen.findByRole("heading", { name: "직거래라서 꼭 할 것" })).toBeTruthy();
    const box = screen.getByRole("checkbox", { name: /신분증으로 확인하기/ });
    await user.click(box);
    expect(saved().checked["direct.owner_id"]).toBe(true);
    await user.click(box);
    expect(saved().checked["direct.owner_id"]).toBeUndefined();
  });

  it("갈래를 안 골랐으면 고르러 가기 안내", async () => {
    render(<StepClient step={step4} total={6} branches={branches} />);
    expect(await screen.findByRole("link", { name: "고르러 가기" })).toBeTruthy();
  });

  it("용어를 누르면 한 줄 설명이 나오고, 체크는 바뀌지 않는다", async () => {
    const user = userEvent.setup();
    render(<StepClient step={step4} total={6} branches={branches} />);
    const term = screen.getAllByRole("button", { name: "등기부등본" })[0];
    await user.click(term);
    expect(term.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("note").textContent).toContain("집 주인이 누구인지");
    expect(screen.getAllByRole("checkbox").every((c) => !(c as HTMLInputElement).checked)).toBe(true);
  });

  it("React StrictMode(두 번 그리기)에서도 용어 밑줄이 살아 있다", () => {
    render(
      <StrictMode>
        <StepClient step={step4} total={6} branches={branches} />
      </StrictMode>,
    );
    expect(screen.getAllByRole("button", { name: "등기부등본" }).length).toBeGreaterThan(0);
  });

  it("등기부등본 점검 항목에서 점검 화면으로 갈 수 있다", () => {
    render(<StepClient step={step4} total={6} branches={branches} />);
    const item = screen.getByRole("checkbox", { name: /등기부등본 점검하기/ }).closest("li")!;
    expect(within(item).getByRole("link", { name: "등기부등본 점검하러 가기" }).getAttribute("href")).toBe("/check");
  });
});
