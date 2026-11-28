// @vitest-environment jsdom
// 벤치마킹 중간 크기 4가지: 요청 목록 · 이유 풀이 · '내가 고침' 표시 · 시세 범위
import { readFileSync } from "node:fs";
import type { AnchorHTMLAttributes } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rules from "@/data/judge.json";
import expected from "@/samples/expected.json";
import NextActions, { reqKey, requestText } from "@/app/check/NextActions";
import CheckClient, { editedFieldsOf, ratioRangeText, type Sample } from "@/app/check/CheckClient";
import type { RegistryRead } from "@/lib/registry/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/check/readPdf", () => ({ MAX_PDF_BYTES: 1, readPdfFile: vi.fn() }));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const actions = {
  questions: ["근저당을 언제 갚으실 건가요?", "앞선 세입자 보증금을 알려 주실 수 있나요?"],
  todos: ["주민센터에서 확인해요"],
  clauses: [{ id: "clear_by_balance_day", title: "잔금일까지 근저당 말소", text: "임대인은 잔금일까지 근저당을 말소한다.", basis: "", sources: [] }],
  parentSummary: "요약",
};

describe("A. 요청 목록", () => {
  it("담은 질문 · 특약만 한 덩어리 글로 모은다", () => {
    expect(requestText([actions.questions[0]], [actions.clauses[0]])).toBe(
      "[계약 전에 확인하고 싶은 것]\n1. 근저당을 언제 갚으실 건가요?\n\n[계약서 특약으로 넣고 싶은 것]\n1. 잔금일까지 근저당 말소: 임대인은 잔금일까지 근저당을 말소한다.",
    );
    expect(requestText([], [])).toBe("");
  });

  it("키는 저장값 검사를 통과하는 모양이고, 같은 문장이면 같은 키", () => {
    const k = reqKey("q", actions.questions[0]);
    expect(k).toMatch(/^[\w.-]{1,80}$/);
    expect(reqKey("q", actions.questions[0])).toBe(k);
    expect(reqKey("q", actions.questions[1])).not.toBe(k);
  });

  it("'요청 목록에 담기'를 누르면 아래 목록에 모이고, 다시 누르면 빠진다", async () => {
    const user = userEvent.setup();
    render(<NextActions actions={actions} />);
    const box = screen.getByText(/^내 요청 목록/).closest(".request") as HTMLElement;
    expect(within(box).getByText(/담기'를 누르면 여기에 모여요/)).toBeTruthy();
    const [pickQ] = screen.getAllByRole("button", { name: "+ 요청 목록에 담기" });
    await user.click(pickQ);
    expect(box.querySelector("pre")!.textContent).toContain("1. 근저당을 언제 갚으실 건가요?");
    await user.click(screen.getByRole("button", { name: "✓ 요청 목록에 담았어요" }));
    expect(box.querySelector("pre")).toBeNull();
  });

  it("방 화면처럼 저장 함수를 넘기면 그쪽에 저장한다", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<NextActions actions={actions} picked={{}} onPick={onPick} />);
    await user.click(screen.getAllByRole("button", { name: "+ 요청 목록에 담기" })[2]);
    expect(onPick).toHaveBeenCalledWith("req.c.clear_by_balance_day", true);
  });
});

describe("B. 이유 풀이", () => {
  it("판정 이유마다 '무슨 뜻' · '왜 위험' 문장이 있다", () => {
    for (const [code, f] of Object.entries(rules.flags) as [string, { meaning?: string; why?: string }][]) {
      expect(f.meaning, code).toBeTruthy();
      expect(f.why, code).toBeTruthy();
    }
  });
});

const caution = expected.samples.find((s) => s.expected.verdict === "caution")!;
const sample: Sample = {
  label: "예시 서류 2",
  text: readFileSync(`samples/${caution.file}`, "utf8"),
  form: {
    myDeposit: String(caution.inputs.my_deposit / 10_000),
    priorDeposits: String(caution.inputs.prior_deposits! / 10_000),
    marketPrice: String(caution.inputs.market_price! / 10_000),
    contractParty: caution.inputs.contract_party,
  },
};

describe("B · C · D 결과 화면", () => {
  it("이유를 펼치면 무슨 뜻 · 왜 위험 · 할 일이 보이고, 시세 범위 문장이 있다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={[sample]} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    const explain = document.querySelector(".flags .flag-explain") as HTMLElement;
    expect(explain.textContent).toMatch(/무슨 뜻.*왜 위험.*할 일/);
    expect(screen.getByText(/시세가 10% 낮으면 .*%, 10% 높으면 .*%예요/)).toBeTruthy();
    expect(screen.queryByText(/내가 고친 값/)).toBeNull();
  });

  it("C. 읽은 내용에서 집주인을 고치면 '내가 고친 값(집주인)'으로 계산했다고 알린다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={[sample]} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    const owner = screen.getByLabelText(/지금 집주인/);
    await user.clear(owner);
    await user.type(owner, "다른사람");
    await user.click(screen.getByRole("button", { name: "다시 점검" }));
    expect(screen.getByText(/내가 고친 값\(집주인\)으로 다시 계산한 결과예요/)).toBeTruthy();
  });

  it("C. 고친 칸 찾기: 집주인 · 근저당", () => {
    const base = { current_owner: "가", active_mortgages: [{ max_claim: 1, creditor: "은행" }] } as RegistryRead;
    expect(editedFieldsOf(base, null)).toEqual([]);
    expect(editedFieldsOf(base, { ...base })).toEqual([]);
    expect(editedFieldsOf(base, { ...base, current_owner: "나", active_mortgages: [] })).toEqual(["집주인", "근저당"]);
  });

  it("D. 시세 범위: 조금만 낮아도 참고선을 넘으면 알려 준다", () => {
    const lines = { caution: 70, danger: 80 };
    expect(ratioRangeText(76, lines)).toBe("시세가 10% 낮으면 84.4%, 10% 높으면 69.1%예요. 시세가 조금만 낮아도 80%를 넘어요.");
    expect(ratioRangeText(65, lines)).toContain("시세가 조금만 낮아도 70%를 넘어요");
    expect(ratioRangeText(40, lines)).toBe("시세가 10% 낮으면 44.4%, 10% 높으면 36.4%예요.");
  });
});
