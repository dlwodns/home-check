// @vitest-environment jsdom
// F2 점검 화면을 사용자처럼 눌러 보는 테스트 (샘플 → 점검하기 → 결과 · 못 읽은 칸 확인).
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import expected from "@/samples/expected.json";
import CheckClient, { type Sample } from "@/app/check/CheckClient";
import { readRegistry } from "@/lib/registry/read";

const readPdfFile = vi.fn();
vi.mock("@/app/check/readPdf", () => ({ MAX_PDF_BYTES: 10 * 1024 * 1024, readPdfFile: (f: File) => readPdfFile(f) }));
const ocrPdfFile = vi.fn();
vi.mock("@/app/check/ocrPdf", () => ({ MAX_OCR_PAGES: 10, ocrPdfFile: (f: File, p: (m: string) => void) => ocrPdfFile(f, p) }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LABEL: Record<string, string> = { safe: "예시 서류 1", caution: "예시 서류 2", danger: "예시 서류 3" };
const m = (won: number | null) => (won === null ? "" : String(won / 10_000));
const samples: Sample[] = expected.samples.map((s) => ({
  label: ("label" in s ? s.label : undefined) ?? LABEL[s.expected.verdict],
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
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(verdictLabel()).toBe("주의");
    expect(screen.getByText("76%")).toBeTruthy();
    expect(screen.getByText(/법으로 정한 기준이 아니라 많이 쓰는 참고선/)).toBeTruthy();
  });

  it("'다음에 할 일'의 질문 속 어려운 말(근저당)도 눌러 뜻을 보고, 그 위에 '단어를 눌러 볼 수 있어요' 안내가 있다 (#9)", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    const next = screen.getByRole("region", { name: "결과에 맞춘 할 일" });
    expect(next.querySelector(".term-hint")).toBeTruthy();
    expect([...next.querySelectorAll(".bubble button")].map((b) => b.textContent).join(" ")).toMatch(/근저당/);
  });

  it("점검하면 입력 칸은 한 줄로 접히고, '고쳐서 다시 점검'으로 같은 값이 다시 펼쳐진다 (R7)", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.queryByRole("button", { name: "점검하기" })).toBeNull();
    expect(screen.getByLabelText("넣은 서류 · 내 계약 정보").textContent).toMatch(/예시 서류 2 · 내 보증금 500만 원 · 시세 \d+억/);
    await user.click(screen.getByRole("button", { name: "← 이전: 내 계약 정보" }));
    expect((screen.getByLabelText("내 보증금 (원)") as HTMLInputElement).value).toBe("5,000,000");
    expect(verdictLabel()).toBe("주의"); // 펼쳐도 결과는 그대로
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.queryByRole("button", { name: "점검하기" })).toBeNull();
  });

  it("금액 칸은 원 단위로 쉼표를 넣고, 옆에 읽기 쉬운 금액을 바로바로 보여 준다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 2" })); // 서류를 넣어야 '내 계약 정보' 카드로 간다
    const dep = screen.getByLabelText("내 보증금 (원)") as HTMLInputElement;
    await user.clear(dep);
    await user.type(dep, "5");
    expect(screen.getByText("= 5원")).toBeTruthy();
    await user.type(dep, "0000000");
    expect(dep.value).toBe("50,000,000");
    expect(screen.getByText("= 5,000만 원")).toBeTruthy();
    await user.clear(dep);
    await user.type(dep, "8억");
    expect(screen.getByText("= 8억 원")).toBeTruthy();
  });

  it("첫 사용자용: 등기부 떼는 법이 있고, 결과 화면에 '원문 확인 중' 같은 내부 표시는 없다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    // 접힌 안내를 펼치지 않아도 어디서 떼는지 보여야 한다(접힌 <details> 안에 있으면 안 보임)
    const iros = screen.getByRole("link", { name: /인터넷등기소에서 떼기/ });
    expect(iros.getAttribute("href")).toBe("https://www.iros.go.kr");
    expect(iros.closest("details")).toBeNull();
    expect(screen.getByText("떼는 순서 보기")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "예시 서류 3" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.getByRole("heading", { name: /^이대로 계약하면 위험해요 · 확인할 것 \d+가지$/ })).toBeTruthy();
    expect(screen.queryByText(/원문 확인 중/)).toBeNull();
  });

  it("용어 안내는 누를 단어가 보이는 곳에: 펼친 첫 이유에 단어가 없으면 '자세히 보기' 안에 둔다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 3" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    const hint = document.querySelector(".term-hint");
    expect(hint).toBeTruthy();
    expect(hint!.closest("details.result-more")).toBeTruthy();
  });

  it("확인할 것이 있으면 요약 줄 없이 '가장 먼저 확인할 것' 카드 하나만 (같은 말 두 번 안 하기)", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(document.querySelector(".summary-lines")).toBeNull();
    expect(screen.getByText("가장 먼저 확인할 것")).toBeTruthy();
    expect(screen.queryByText(/가장 먼저:/)).toBeNull();
  });

  it("위험 샘플 → 위험, 첫 이유는 '예전 집주인', 근거 링크가 있다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 3" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(verdictLabel()).toBe("위험");
    const first = document.querySelector(".flags li")!;
    expect(first.textContent).toContain("예전 집주인");
    expect(within(first as HTMLElement).getByRole("link", { name: "S11" })).toBeTruthy();
  });

  it("한 화면에 카드 하나: 서류가 없으면 '다음'이 없고, 보증금을 비우고 점검하면 안내만 보이고 결과는 없다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    expect(screen.queryByRole("button", { name: /다음: 내 계약 정보/ })).toBeNull();
    expect(screen.queryByLabelText("내 보증금 (원)")).toBeNull(); // 서류 카드만 보인다
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    await user.clear(screen.getByLabelText("내 보증금 (원)"));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.getByRole("alert").textContent).toContain("내 보증금을 적어 주세요");
    expect(verdictLabel()).toBeUndefined();
    // 위쪽 단계 표시에서 '서류 넣기'를 누르면 서류 카드로 돌아간다
    await user.click(screen.getByRole("button", { name: /서류 넣기\(으\)로 돌아가기/ }));
    expect(screen.getByRole("button", { name: /다음: 내 계약 정보/ })).toBeTruthy();
  });

  it("못 읽은 칸이 있으면 '안전'이 아니고, 직접 확인했다고 체크하면 경고가 사라진다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 1" }));
    await user.click(screen.getByRole("button", { name: /이전: 서류 넣기/ }));
    const box = screen.getByLabelText(/등기부등본\(등기사항전부증명서\) 내용/);
    const broken = samples[0].text.replace("채권최고액 금240,000,000원", "채권최고액 (흐림)");
    await user.clear(box);
    await user.click(box);
    await user.paste(broken);
    await user.click(screen.getByRole("button", { name: /다음: 내 계약 정보/ }));
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
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    const first = screen.getByLabelText("근저당 1 금액 (원)");
    await user.clear(first);
    await user.type(first, "600000000");
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
    await user.click(screen.getByRole("button", { name: "예시 서류 3" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));

    expect(screen.getByRole("heading", { name: "결과에 맞춘 할 일" })).toBeTruthy();
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
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
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
    // 글자를 읽으면 바로 '내 계약 정보' 카드로 넘어간다. 읽은 글자는 '서류 바꾸기'에서 본다
    expect(screen.getByLabelText("내 보증금 (원)")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /이전: 서류 넣기/ }));
    // 읽은 글자 칸은 접혀 있다(펼치면 고칠 수 있음)
    const raw = screen.getByLabelText(/읽은 글자\(서류와 다르면 고쳐도 돼요\)/) as HTMLTextAreaElement;
    expect(raw.closest("details")?.open).toBe(false);
    expect(raw.value).toContain("【 을 구 】");
    expect(screen.getByText("다른 PDF 올리기")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /다음: 내 계약 정보/ }));
    await user.type(screen.getByLabelText("내 보증금 (원)"), "5000000");
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(document.querySelector(".verdict-label")?.textContent).not.toBe("안전"); // 시세 · 앞선 보증금을 몰라 주의
  });

  it("등기부등본이 아닌 PDF를 올리면 점검 전에 바로 알려 주고 글자를 채우지 않는다", async () => {
    const user = userEvent.setup();
    readPdfFile.mockResolvedValueOnce({ text: "홈체크 포스터 이 방, 계약해도 될까? 전세사기 피해자 통계와 화면 소개", pages: 1, hasText: true });
    render(<CheckClient samples={samples} />);
    await user.upload(screen.getByLabelText(/PDF 올리기/), pdf());
    expect(await screen.findByText(/등기부등본이 아닌 것 같아요/)).toBeTruthy();
    expect(screen.queryByText(/PDF 1쪽에서 글자를 읽었어요/)).toBeNull();
    expect(screen.queryByLabelText(/읽은 글자\(서류와 다르면 고쳐도 돼요\)/)).toBeNull();
  });

  const safe = () => samples.find((s) => s.label === "예시 서류 1")!;
  const uploadOcr = async (user: ReturnType<typeof userEvent.setup>) => {
    const s = safe();
    const r = readRegistry(s.text).read;
    readPdfFile.mockResolvedValueOnce({ text: "", pages: 1, hasText: false });
    ocrPdfFile.mockResolvedValueOnce({
      text: s.text,
      raw: s.text,
      lines: [{ page: 0, words: [{ text: r.current_owner, conf: 95, bbox: { x0: 10, y0: 10, x1: 60, y1: 30 } }] }],
      pages: [{ url: "blob:page0", width: 200, height: 300 }],
    });
    render(<CheckClient samples={samples} />);
    await user.upload(screen.getByLabelText(/PDF 올리기/), pdf());
    await screen.findByText(/그림 PDF 1쪽을 읽었어요/);
    return r;
  };
  // '내 계약 정보' 카드로 가서 샘플 값으로 채운다 (맞춰 보기를 마치면 자동으로 넘어가 있다)
  const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
    const s = safe();
    const next = screen.queryByRole("button", { name: /다음: 내 계약 정보/ });
    if (next) await user.click(next);
    for (const [label, k] of [["내 보증금 (원)", "myDeposit"], [/앞선 세입자 보증금 합계/, "priorDeposits"], ["이 건물 시세 (원)", "marketPrice"], [/집주인 이름 \(계약서에 서명할 사람\)/, "contractParty"]] as const) {
      const v = s.form[k];
      // 샘플 폼 값은 만 원 단위 → 화면 칸에는 원으로 적는다
      if (v) await user.type(screen.getByLabelText(label), k === "contractParty" || !/^\d+$/.test(v) ? v : String(Number(v) * 10_000));
    }
  };

  it("그림(스캔) PDF는 올리자마자 점검 전에 원본 조각과 맞춰 보게 하고, 맞춰 보기 전에는 '안전'을 내지 않는다", async () => {
    const user = userEvent.setup();
    const r = await uploadOcr(user);
    const card = screen.getByRole("region", { name: "원본과 맞춰 보기" });
    expect(within(card).getByRole("img", { name: "지금 집주인 원본 조각" })).toBeTruthy();
    expect((within(card).getByLabelText(/지금 집주인 \(갑구/) as HTMLInputElement).value).toBe(r.current_owner);

    // 맞춰 보지 않고 점검 → '안전' 막힘, 결과의 '직접 확인했어요'로는 풀리지 않음
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(verdictLabel()).not.toBe("안전");
    expect(screen.getByText(/위 '원본과 맞춰 보기'를 마치면 최종 결과가 나와요/)).toBeTruthy();

    // 맞춰 보기 '같아요' → 카드가 한 줄로 접히고 결과가 바로 다시 계산됨
    await user.click(screen.getByRole("button", { name: /원본과 같아요/ }));
    // 결과가 이미 있으면 맞춰 보기는 위 요약 한 줄로 합쳐진다
    expect(screen.getByLabelText("넣은 서류 · 내 계약 정보").textContent).toContain("원본과 맞춰 봄");
    expect(verdictLabel()).toBe("안전");
  });

  it("맞춰 보기에서 고친 근저당은 점검에 쓰이고, '원본과 달라요'면 '안전'이 나오지 않는다", async () => {
    const user = userEvent.setup();
    await uploadOcr(user);
    await user.click(screen.getByRole("button", { name: /빠진 근저당 추가/ }));
    const amounts = screen.getAllByLabelText(/근저당 \d+ 금액/);
    await user.type(amounts[amounts.length - 1], "1000000000"); // 10억: 빚 비율이 크게 올라감
    await user.click(screen.getByRole("button", { name: /원본과 같아요/ }));
    expect(screen.getByText(/원본과 맞춰 봤어요 \(고친 값: 근저당\)/)).toBeTruthy();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(verdictLabel()).toBe("위험");

    await user.click(screen.getByRole("button", { name: "← 이전: 내 계약 정보" }));
    await user.click(screen.getByRole("button", { name: "다시 보기" }));
    await user.click(screen.getByRole("button", { name: /원본과 달라요/ }));
    expect(screen.getAllByText(/다른 값이 있다고 표시했어요/).length).toBeGreaterThan(0);
    expect(verdictLabel()).not.toBe("안전");
  });

  it("갑구를 못 읽으면 맞춰 보기에 알리고, 못 읽은 이전일도 줄로 보이며, 집주인을 적기 전에는 '같아요'가 안 된다", async () => {
    const user = userEvent.setup();
    const eul = safe().text.slice(safe().text.search(/【\s*을\s*구\s*】/));
    readPdfFile.mockResolvedValueOnce({ text: "", pages: 1, hasText: false });
    ocrPdfFile.mockResolvedValueOnce({ text: "【 표 제 부 】\n" + eul, raw: eul, lines: [], pages: [] });
    render(<CheckClient samples={samples} />);
    await user.upload(screen.getByLabelText(/PDF 올리기/), pdf());
    const card = await screen.findByRole("region", { name: "원본과 맞춰 보기" });
    expect(within(card).getByText(/갑구\(소유자 기록\)를 찾지 못했어요/)).toBeTruthy();
    expect(within(card).getByText("⚠ 못 읽었어요")).toBeTruthy();
    await user.click(within(card).getByRole("button", { name: /원본과 같아요/ }));
    expect(within(card).getByRole("alert").textContent).toContain("집주인 이름을 적어 주세요");
    await user.type(within(card).getByLabelText(/지금 집주인 \(갑구/), "홍길동");
    await user.click(within(card).getByRole("button", { name: /원본과 같아요/ }));
    expect(screen.getByText("✓ 원본과 맞춰 봤어요 (고친 값: 집주인)")).toBeTruthy();
  });

  it("위 단계 표시가 지금 단계를 따라가고(겹치던 '지금 할 일' 줄은 뺌), 결과 뒤에는 다음 버튼 하나", async () => {
    const user = userEvent.setup();
    await uploadOcr(user);
    const steps = screen.getByRole("navigation", { name: "점검 단계" });
    expect(within(steps).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["✓서류 넣기", "2원본 확인", "3내 정보", "4결과"]);
    expect(within(steps).getByText("원본 확인").closest("li")!.getAttribute("aria-current")).toBe("step");
    expect(screen.queryByRole("button", { name: "예시 서류 2" })).toBeNull(); // 진짜 서류를 넣으면 샘플은 숨김
    await user.click(screen.getByRole("button", { name: /원본과 같아요/ }));
    expect(within(steps).getByText("내 정보").closest("li")!.getAttribute("aria-current")).toBe("step");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(within(steps).getByText("결과").closest("li")!.getAttribute("aria-current")).toBe("step");
    expect(screen.queryByText("읽은 내용 확인 · 고치기")).toBeNull(); // 위에서 맞춰 봤으니 겹치는 칸은 뺌
    // 결과 뒤에는 무엇을 이어서 할지 버튼 하나 + 이전 단계로 돌아가기
    const next = screen.getByRole("navigation", { name: "다음 단계" });
    expect(within(next).getByRole("link", { name: "다음: 방 담기 →" }).getAttribute("href")).toBe("/rooms/new");
    await user.click(screen.getByRole("button", { name: "← 이전: 내 계약 정보" }));
    expect(screen.getByRole("button", { name: "점검하기" })).toBeTruthy();
  });

  it("OCR로도 글자를 거의 못 읽으면 안내하고 내용을 바꾸지 않는다", async () => {
    const user = userEvent.setup();
    readPdfFile.mockResolvedValueOnce({ text: "", pages: 1, hasText: false });
    ocrPdfFile.mockResolvedValueOnce({ text: "", raw: "", lines: [], pages: [] });
    render(<CheckClient samples={samples} />);
    await user.upload(screen.getByLabelText(/PDF 올리기/), pdf());
    expect((await screen.findByRole("alert")).textContent).toContain("글자를 거의 읽지 못했어요");
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
    await user.click(screen.getByRole("button", { name: "예시 서류 1" }));
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.getByText("확인한 범위 안에서는 큰 위험 신호가 없어요")).toBeTruthy();
    expect(screen.getByText(/등기부등본으로는 알 수 없는 것 \d가지/)).toBeTruthy();
    expect(screen.getByText(/집주인의 국세 · 지방세 체납/)).toBeTruthy();
    expect(document.querySelector(".summary-lines")!.textContent).toContain("등기부로는 알 수 없는 것");
    expect(document.querySelector(".signal-glyph")!.textContent).toBe("✓");
  });
});

describe("입력칸 [필수] · [선택] 표시 (11/28)", () => {
  it("꼭 적을 칸(내 보증금)만 '필수', 나머지는 '선택'이고, 필수 칸은 화면 읽기 프로그램에도 필수로 알린다", async () => {
    const user = userEvent.setup();
    render(<CheckClient samples={samples} />);
    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    const mark = (label: string) => document.querySelector(`label[for="${screen.getByLabelText(label).id}"]`)!.getAttribute("data-mark");
    expect(mark("내 보증금 (원)")).toBe("필수");
    expect(screen.getByLabelText("내 보증금 (원)").getAttribute("aria-required")).toBe("true");
    expect(mark("이 건물 시세 (원)")).toBe("선택");
    expect(mark("집주인 이름 (계약서에 서명할 사람)")).toBe("선택");
  });
});
