// @vitest-environment jsdom
// 11/18 디자인: "괜찮은 점" 계산, 신호등, 용어 말풍선(한 번에 하나 · Esc · 바깥 누르기 · 본 단어 옅게 · 처음 안내).
import type { AnchorHTMLAttributes } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goodPoints, headline } from "@/lib/registry/goodPoints";
import { splitAll } from "@/lib/content/terms";
import TermText from "@/app/ui/TermText";
import TermHint from "@/app/ui/TermHint";
import TrafficLight from "@/app/ui/TrafficLight";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("괜찮은 점", () => {
  const lines = { caution: 70 };

  it("걸린 이유가 없으면 집주인 · 기록 · 임차권 · 비율을 초록으로 보여 준다", () => {
    expect(goodPoints({ flags: [], ratio: 55 }, lines)).toEqual([
      "계약 상대가 등기부등본의 지금 집주인이에요",
      "압류 · 신탁 · 가처분 · 가등기 · 경매 기록이 없어요",
      "앞 세입자가 보증금을 못 받아 남긴 임차권등기가 없어요",
      "빚과 보증금을 합쳐도 시세의 55%예요 (참고선 70% 아래)",
    ]);
  });

  it("걸린 항목은 괜찮다고 말하지 않는다", () => {
    const g = goodPoints({ flags: ["owner_mismatch", "seizure", "ratio_caution"], ratio: 76 }, lines);
    expect(g).toEqual(["앞 세입자가 보증금을 못 받아 남긴 임차권등기가 없어요"]);
    expect(goodPoints({ flags: ["owner_unchecked"], ratio: null }, lines).join()).not.toContain("집주인");
  });

  it("못 읽은 칸이 있으면 아무것도 괜찮다고 하지 않는다", () => {
    expect(goodPoints({ flags: ["read_incomplete"], ratio: 10 }, lines)).toEqual([]);
  });

  it("큰 제목: 확인할 것 개수 → 없으면 판정별 문장", () => {
    expect(headline("caution", 2)).toBe("계약 전에 확인할 것이 2가지 있어요");
    expect(headline("danger", 3)).toBe("이대로 계약하면 위험해요 · 확인할 것 3가지");
    expect(headline("safe", 0)).toBe("확인한 범위 안에서는 큰 위험 신호가 없어요");
    expect(headline("caution", 0)).toBe("계약 전에 한 번 더 확인해 주세요");
  });
});

describe("신호등", () => {
  it("판정 하나만 켜지고 글자로도 알려 준다", () => {
    const { container } = render(<TrafficLight verdict="caution" />);
    expect(container.querySelectorAll(".lamp-on")).toHaveLength(1);
    expect(container.querySelector(".lamp-on")!.className).toContain("lamp-caution");
    expect(screen.getByText("주의")).toBeTruthy();
  });
});

describe("용어 말풍선", () => {
  const [a, b] = splitAll(["근저당이 있으면 확인해요", "전입신고는 14일 안에"]);
  const setup = () =>
    render(
      <p>
        <TermText segments={a} /> / <TermText segments={b} />
      </p>,
    );

  it("누르면 말풍선이 뜨고, 다른 단어를 누르면 앞의 것은 닫힌다 (한 번에 하나)", async () => {
    const user = userEvent.setup();
    setup();
    const t1 = screen.getByRole("button", { name: "근저당" });
    const t2 = screen.getByRole("button", { name: "전입신고" });
    await user.click(t1);
    expect(t1.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("note")).toHaveLength(1);
    await user.click(t2);
    expect(t1.getAttribute("aria-expanded")).toBe("false");
    expect(t2.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("note")).toHaveLength(1);
    expect(screen.getByRole("note").textContent).toContain("전입신고");
  });

  it("키보드로 다른 단어를 열어도 앞의 말풍선은 닫힌다", async () => {
    const user = userEvent.setup();
    setup();
    const t1 = screen.getByRole("button", { name: "근저당" });
    const t2 = screen.getByRole("button", { name: "전입신고" });
    t1.focus();
    await user.keyboard("{Enter}");
    t2.focus();
    await user.keyboard("{Enter}");
    expect(t1.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getAllByRole("note")).toHaveLength(1);
  });

  it("같은 단어 다시 누르기 · Esc · 바깥 누르기로 닫힌다, Esc 뒤에는 단어로 초점이 돌아온다", async () => {
    const user = userEvent.setup();
    setup();
    const t1 = screen.getByRole("button", { name: "근저당" });
    await user.click(t1);
    await user.click(t1);
    expect(screen.queryByRole("note")).toBeNull();

    await user.click(t1);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("note")).toBeNull();
    expect(document.activeElement).toBe(t1);

    await user.click(t1);
    await user.click(document.body);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("말풍선 안의 닫기 버튼, 근거 링크가 있다", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "근저당" }));
    // 근거 목록 전체로 보내지 않고, 이 단어의 근거 하나와 원문 링크를 말풍선 안에 보여 준다
    expect(screen.getByRole("note").textContent).toMatch(/근거: /);
    expect(screen.getByRole("link", { name: /원문/ }).getAttribute("href")).toMatch(/^https:\/\//);
    expect(screen.getByRole("link", { name: "더보기" }).getAttribute("href")).toMatch(/^\/sources#S\d+/);
    await user.click(screen.getByRole("button", { name: "뜻 닫기" }));
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("한 번 본 단어는 옅게 표시된다 (다시 들어와도)", async () => {
    const user = userEvent.setup();
    setup();
    const t1 = screen.getByRole("button", { name: "근저당" });
    expect(t1.className).not.toContain("term-seen");
    await user.click(t1);
    await user.click(t1);
    expect(t1.className).toContain("term-seen");
    cleanup();
    setup();
    expect(screen.getByRole("button", { name: "근저당" }).className).toContain("term-seen");
    expect(screen.getByRole("button", { name: "전입신고" }).className).not.toContain("term-seen");
  });
});

describe("처음 한 번 안내", () => {
  it("처음엔 보이고, 단어를 한 번 누르면 사라지고 다시 안 나온다", async () => {
    const user = userEvent.setup();
    const [segs] = splitAll(["근저당을 확인해요"]);
    render(
      <>
        <TermHint />
        <TermText segments={segs} />
      </>,
    );
    expect(await screen.findByText(/단어를 누르면 뜻이 나와요/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "근저당" }));
    expect(screen.queryByText(/단어를 누르면 뜻이 나와요/)).toBeNull();
    cleanup();
    render(<TermHint />);
    expect(screen.queryByText(/단어를 누르면 뜻이 나와요/)).toBeNull();
  });

  it("'알겠어요'로 닫을 수 있다", async () => {
    const user = userEvent.setup();
    render(<TermHint />);
    await user.click(await screen.findByRole("button", { name: "알겠어요" }));
    expect(screen.queryByText(/단어를 누르면 뜻이 나와요/)).toBeNull();
    // 닫은 뒤에도 짧은 한 줄은 남는다
    expect(screen.getByText(/단어는 눌러서 뜻을 볼 수 있어요/)).toBeTruthy();
  });
});

describe("용어 말풍선 세부 (11/16 합의)", () => {
  it("PC(마우스)에서는 올리면 열리고 벗어나면 닫힌다, 눌러서 연 것은 벗어나도 유지", async () => {
    const mm = vi.fn(() => ({ matches: true }));
    vi.stubGlobal("matchMedia", mm);
    const user = userEvent.setup();
    const [segs] = splitAll(["근저당을 확인해요"]);
    render(<p><TermText segments={segs} /> 다른 글</p>);
    const t = screen.getByRole("button", { name: "근저당" });
    await user.hover(t);
    await waitFor(() => expect(screen.getByRole("note")).toBeTruthy());
    await user.unhover(t);
    await waitFor(() => expect(screen.queryByRole("note")).toBeNull());
    await user.click(t);
    await user.unhover(t);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByRole("note")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("'다 알아요 · 끄기'를 누르면 밑줄 단어가 일반 글자로 바뀌고, 다시 켤 수 있다", async () => {
    const { setTermsOff } = await import("@/app/ui/termPrefs");
    const user = userEvent.setup();
    const [segs] = splitAll(["근저당을 확인해요"]);
    render(
      <>
        <TermHint />
        <p>
          <TermText segments={segs} />
        </p>
      </>,
    );
    await user.click(await screen.findByRole("button", { name: "다 알아요 · 끄기" }));
    expect(screen.queryByRole("button", { name: "근저당" })).toBeNull();
    expect(screen.getByText("근저당을 확인해요")).toBeTruthy();
    expect(screen.queryByText(/단어를 누르면 뜻이 나와요/)).toBeNull();
    act(() => setTermsOff(false));
    expect(screen.getByRole("button", { name: "근저당" })).toBeTruthy();
  });
});

describe("앞선 세입자 보증금 확인 방법 (A3)", () => {
  it("4단계에 안내가 붙고, 낼 서류 · 부탁 문장 복사 · 근거가 있다", async () => {
    const { steps, branches } = await import("@/lib/content");
    const { default: StepClient } = await import("@/app/steps/[no]/StepClient");
    const step4 = steps.find((s) => s.items.some((i) => i.id === "prior_deposits"))!;
    render(<StepClient step={step4} total={steps.length} branches={branches} />);
    const guide = screen.getByText("앞선 세입자 보증금, 어떻게 확인해요?").closest("details")!;
    for (const doc of ["임대차 정보제공 요청서", "집주인의 동의서", "인감증명서", "내 신분증"]) expect(guide.textContent).toContain(doc);
    expect(guide.textContent).toContain("보여 줄 의무");
    expect(screen.getByRole("button", { name: "부탁 문장 복사" })).toBeTruthy();
    expect(within(guide as HTMLElement).getByRole("link", { name: "S6" }).getAttribute("href")).toBe("/sources#S6");
  });

  it("다른 단계에는 붙지 않는다", async () => {
    const { steps, branches } = await import("@/lib/content");
    const { default: StepClient } = await import("@/app/steps/[no]/StepClient");
    render(<StepClient step={steps[0]} total={steps.length} branches={branches} />);
    expect(screen.queryByText("앞선 세입자 보증금, 어떻게 확인해요?")).toBeNull();
  });
});
