// @vitest-environment jsdom
// F2 점검 화면을 사용자처럼 눌러 보는 테스트 (샘플 → 점검하기 → 결과 · 못 읽은 칸 확인).
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import expected from "@/samples/expected.json";
import CheckClient, { type Sample } from "@/app/check/CheckClient";

const readPdfFile = vi.fn();
vi.mock("@/app/check/readPdf", () => ({ MAX_PDF_BYTES: 10 * 1024 * 1024, readPdfFile: (f: File) => readPdfFile(f) }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LABEL: Record<string, string> = { safe: "안전 샘플", caution: "주의 샘플", danger: "위험 샘플" };
const m = (won: number | null) => (won === null ? "" : String(won / 10_000));
const samples: Sample[] = expected.samples.map((s) => ({
  label: LABEL[s.expected.verdict],
  text: readFileSync(`samples/${s.file}`, "utf8"),
  form: {
    myDeposit: m(s.inputs.my_deposit),
    priorDeposits: m(s.inputs.prior_deposits),
    marketPrice: m(s.inputs.market_price),
    contractParty: s.inputs.contract_party,
  },
}));

afterEach(cleanup);

const verdictLabel = () => document.querySelector(".verdict-label")?.textContent;

describe("등기부등본 점검 화면", () => {
  it("주의 샘플 → 점검하기 → 주의 · 76% · 참고선 안내", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "주의 샘플" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(verdictLabel()).toBe("주의");
    expect(screen.getByText("76%")).toBeTruthy();
    expect(screen.getByText(/법으로 정한 기준이 아니라 많이 쓰는 참고선/)).toBeTruthy();
  });

  it("3줄 요약은 짧은 제목을 쓴다 (R8: 줄마다 두 줄로 넘치지 않게)", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "주의 샘플" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.getByText(/가장 먼저: 빚과 보증금이 시세의 70%를 넘어요/)).toBeTruthy();
  });

  it("위험 샘플 → 위험, 첫 이유는 '예전 집주인', 근거 링크가 있다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "위험 샘플" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(verdictLabel()).toBe("위험");
    const first = document.querySelector(".flags li")!;
    expect(first.textContent).toContain("예전 집주인");
    expect(within(first as HTMLElement).getByRole("link", { name: "S11" })).toBeTruthy();
  });

  it("아무것도 안 넣고 점검하기 → 고칠 것 안내만 보이고 결과는 없다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("등기부등본 내용을 붙여 넣어 주세요");
    expect(alert.textContent).toContain("내 보증금을 적어 주세요");
    expect(verdictLabel()).toBeUndefined();
  });

  it("못 읽은 칸이 있으면 '안전'이 아니고, 직접 확인했다고 체크하면 경고가 사라진다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "안전 샘플" }));
    const box = screen.getByLabelText(/등기부등본\(등기사항전부증명서\) 내용/);
    const broken = samples[0].text.replace("채권최고액 금240,000,000원", "채권최고액 (흐림)");
    await user.clear(box);
    await user.click(box);
    await user.paste(broken);
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(verdictLabel()).not.toBe("안전");
    expect(screen.getByText("못 읽은 칸이 있어요")).toBeTruthy();

    await user.click(screen.getByLabelText("못 읽은 칸을 서류에서 직접 확인했어요"));
    expect(screen.queryByText("못 읽은 칸이 있어요")).toBeNull();
    expect(verdictLabel()).toBe("안전");
  });

  it("읽은 근저당 금액을 고치고 다시 점검하면 판정이 바뀐다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "주의 샘플" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    const first = screen.getByLabelText("근저당 1 금액 (만 원)");
    await user.clear(first);
    await user.type(first, "60000");
    await user.click(screen.getByRole("button", { name: "다시 점검" }));
    expect(verdictLabel()).toBe("위험");
  });
});

describe("다음 행동 카드", () => {
  it("위험 샘플: 질문 · 할 일 · 특약 · 부모님 요약이 보이고, 질문을 복사할 수 있다", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "위험 샘플" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));

    expect(screen.getByRole("heading", { name: "다음에 할 일" })).toBeTruthy();
    expect(screen.getByText(/2026년 9월 1일에 집주인이 바뀌었더라고요/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "계약서 특약에 이렇게 적어요" })).toBeTruthy();
    const summary = document.querySelector(".summary")!.textContent!;
    expect(summary).toContain("[홈체크] 등기부등본 점검 결과: 위험");
    expect(summary).not.toContain("박서윤");

    await user.click(screen.getAllByRole("button", { name: "복사" })[0]);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("지금 집주인분과 직접 계약하고 싶은데"));
    expect(await screen.findAllByText("복사했어요")).toBeTruthy();
  });

  it("복사가 막힌 환경에서는 직접 복사하라는 안내", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("no")) }, configurable: true });
    const exec = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "주의 샘플" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    await user.click(screen.getByRole("button", { name: "요약 복사" }));
    expect(await screen.findByText(/복사하지 못했어요/)).toBeTruthy();
  });
});

describe("PDF 올리기", () => {
  const pdf = (name = "등기부.pdf", size = 1000, type = "application/pdf") => {
    const f = new File(["%PDF"], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
  };

  it("PDF를 올리면 글자가 채워지고, 바로 점검할 수 있다", async () => {
    const user = userEvent.setup();
    readPdfFile.mockResolvedValueOnce({ text: samples[1].text, pages: 1, hasText: true });
    render(<CheckClient samples={samples} />);
    await user.upload(screen.getByLabelText(/PDF 올리기/), pdf());
    expect(await screen.findByText(/PDF 1쪽에서 글자를 읽었어요/)).toBeTruthy();
    expect((screen.getByLabelText(/내용을 그대로 붙여 넣어 주세요/) as HTMLTextAreaElement).value).toContain("【 을 구 】");
    await user.type(screen.getByLabelText("내 보증금 (만 원)"), "500");
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(document.querySelector(".verdict-label")?.textContent).not.toBe("안전"); // 시세 · 앞선 보증금을 몰라 주의
  });

  it("글자가 없는 스캔 PDF는 안내하고 내용을 바꾸지 않는다", async () => {
    const user = userEvent.setup();
    readPdfFile.mockResolvedValueOnce({ text: "", pages: 2, hasText: false });
    render(<CheckClient samples={samples} />);
    await user.upload(screen.getByLabelText(/PDF 올리기/), pdf());
    expect((await screen.findByRole("alert")).textContent).toContain("사진 · 스캔 파일");
    expect((screen.getByLabelText(/내용을 그대로 붙여 넣어 주세요/) as HTMLTextAreaElement).value).toBe("");
  });

  it("너무 큰 파일 · 읽기 실패(비밀번호 등)도 안내만 하고 멈추지 않는다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    readPdfFile.mockClear();
    await user.upload(screen.getByLabelText(/PDF 올리기/), pdf("큰파일.pdf", 11 * 1024 * 1024));
    expect((await screen.findByRole("alert")).textContent).toContain("10MB");
    expect(readPdfFile).not.toHaveBeenCalled();

    readPdfFile.mockRejectedValueOnce(new Error("PasswordException"));
    await user.upload(screen.getByLabelText(/PDF 올리기/), pdf());
    expect((await screen.findByRole("alert")).textContent).toContain("비밀번호");
  });
});


describe("결과: 3줄 요약 · 알 수 없는 것 · 판정 모양 (벤치마킹 반영)", () => {
  it("안전 샘플도 '확인한 범위 안에서'라고 말하고, 등기부로 알 수 없는 것을 함께 보여 준다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "안전 샘플" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.getByText("확인한 범위 안에서는 큰 위험 신호가 없어요")).toBeTruthy();
    expect(screen.getByText(/등기부등본으로는 알 수 없는 것 \d가지/)).toBeTruthy();
    expect(screen.getByText(/집주인의 국세 · 지방세 체납/)).toBeTruthy();
    expect(document.querySelector(".summary-lines")!.textContent).toContain("등기부로는 알 수 없는 것");
    expect(document.querySelector(".signal-glyph")!.textContent).toBe("✓");
  });
});
