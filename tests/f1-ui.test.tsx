// @vitest-environment jsdom
// F1 계약 단계 길잡이를 사용자처럼 눌러 보는 테스트.
import { StrictMode, type AnchorHTMLAttributes } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { branches, steps } from "@/lib/content";
import StartClient from "@/app/StartClient";
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

describe("계약 과정 미리보기 (/guide)", () => {
  it("입구의 미리보기와 같은 화면: 같은 이름 · 그림 6장 · 끝에 '방 담기' / '방 찾기부터'", () => {
    render(<StartClient />);
    expect(screen.getByRole("heading", { name: "계약 과정 미리보기" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "집 계약 과정 미리보기" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "다음: 방 담기 →" }).getAttribute("href")).toBe("/rooms/new");
    expect(screen.getByRole("link", { name: "다음: 방 찾기부터 →" }).getAttribute("href")).toBe("/steps/1");
    expect(screen.queryByRole("button", { name: /처음이에요|해 봤어요/ })).toBeNull(); // 갈래는 입구에서 한 번만
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

describe("해 봤어요(경험자) 6단계 목록", () => {
  it("경험자도 '건너뛰어도 돼요' 없이 6단계 모두, 등기부등본 바로 점검은 맨 위에", async () => {
    seed({ mode: "experienced", branch: "broker" });
    render(<StepsClient steps={steps} branches={branches} />);
    expect((await screen.findByRole("link", { name: "등기부등본만 바로 점검" })).getAttribute("href")).toBe("/check");
    expect(screen.queryByText(/건너뛰어도 돼요/)).toBeNull();
    expect(screen.getByText("지금 할 차례").closest("a")?.getAttribute("href")).toBe("/steps/1");
    expect(screen.getByText(/6단계 중 0단계 완료/)).toBeTruthy();
  });
});

describe("단계 화면", () => {
  const step4 = steps.find((s) => s.no === 4)!;

  it("4단계 + 직거래: 직거래 체크리스트가 붙고, 체크하면 저장된다", async () => {
    seed({ branch: "direct" });
    const user = userEvent.setup();
    render(<StepClient step={step4} total={6} branches={branches} steps={steps} />);
    expect(await screen.findByRole("heading", { name: "직거래라서 꼭 할 것" })).toBeTruthy();
    const box = screen.getByRole("checkbox", { name: /신분증으로 확인하기/ });
    await user.click(box);
    expect(saved().checked["direct.owner_id"]).toBe(true);
    // 체크하면 줄을 긋지 않고 색 + '✓ 했어요'로 표시(11/28)
    expect(box.closest("li")!.className).toContain("done");
    expect(within(box.closest("li")!).getByText("✓ 했어요")).toBeTruthy();
    expect(screen.getAllByText("다 했으면 왼쪽 네모를 눌러 체크해 주세요").length).toBe(1);
    await user.click(box);
    expect(saved().checked["direct.owner_id"]).toBeUndefined();
  });

  it("갈래를 안 골랐으면 다른 화면으로 보내지 않고 이 화면에서 묻는다 → 고르면 맞춤 할 일이 붙는다", async () => {
    const user = userEvent.setup();
    render(<StepClient step={step4} total={6} branches={branches} steps={steps} />);
    expect(await screen.findByRole("heading", { name: "방, 어디서 찾았어요?" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "집주인과 직접 (직거래)" }));
    expect(saved().branch).toBe("direct");
    expect(screen.getByRole("heading", { name: "직거래라서 꼭 할 것" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "방, 어디서 찾았어요?" })).toBeNull();
  });

  it("용어를 누르면 한 줄 설명이 나오고, 체크는 바뀌지 않는다", async () => {
    const user = userEvent.setup();
    render(<StepClient step={step4} total={6} branches={branches} steps={steps} />);
    const term = screen.getAllByRole("button", { name: "등기부등본" })[0];
    await user.click(term);
    expect(term.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("note").textContent).toContain("집 주인이 누구인지");
    expect(screen.getAllByRole("checkbox").every((c) => !(c as HTMLInputElement).checked)).toBe(true);
  });

  it("해당 없을 수 있는 항목에는 '건너뛰어도 돼요' 안내가 붙는다", () => {
    render(<StepClient step={steps[0]} total={6} branches={branches} steps={steps} />);
    expect(screen.getByRole("checkbox", { name: /기숙사 · 사택.*해당 없으면 건너뛰어도 돼요/ })).toBeTruthy();
  });

  it("React StrictMode(두 번 그리기)에서도 용어 밑줄이 살아 있다", () => {
    render(
      <StrictMode>
        <StepClient step={step4} total={6} branches={branches} steps={steps} />
      </StrictMode>,
    );
    expect(screen.getAllByRole("button", { name: "등기부등본" }).length).toBeGreaterThan(0);
  });

  it("등기부등본 점검 항목에서 점검 화면으로 갈 수 있다", () => {
    render(<StepClient step={step4} total={6} branches={branches} steps={steps} />);
    const item = screen.getByRole("checkbox", { name: /등기부등본 점검하기/ }).closest("li")!;
    expect(within(item).getByRole("link", { name: "다음: 등기부등본 점검 →" }).getAttribute("href")).toBe("/check");
  });
});
