// F2 화면 흐름 테스트: 20살이 입력칸에 칠 법한 값과 이상한 입력(7주차 점검표 ⑤)을 다룬다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatWon, parseManwon, readWon, runCheck, todayKST, type CheckForm } from "@/lib/registry/check";

const load = (f: string) => readFileSync(`samples/${f}`, "utf8");
const AS_OF = "2026-11-13";
const form = (p: Partial<CheckForm> = {}): CheckForm => ({
  myDeposit: "500",
  priorDeposits: "",
  marketPrice: "",
  contractParty: "",
  ...p,
});

describe("만 원 입력칸 읽기", () => {
  it.each([
    ["500", 5_000_000],
    ["1,000", 10_000_000],
    [" 500 ", 5_000_000],
    ["500만", 5_000_000],
    ["500만원", 5_000_000],
    ["1억", 100_000_000],
    ["1억 2,000", 120_000_000],
    ["1억2000만원", 120_000_000],
    ["0", 0],
  ])("%s → %d원", (raw, won) => {
    expect(parseManwon(raw, "x")).toEqual({ ok: true, won });
  });

  it("빈칸은 0이 아니라 모름(null)", () => {
    expect(parseManwon("   ", "x")).toEqual({ ok: true, won: null });
  });

  it.each(["abc", "오백", "-500", "500원만", "1억억", "12ab"])("%s → 숫자로 적어 달라는 안내", (raw) => {
    const r = parseManwon(raw, "내 보증금");
    expect(r.ok).toBe(false);
  });

  it("터무니없이 큰 값(만 원 단위를 원 단위로 적은 경우 등)은 막는다", () => {
    expect(parseManwon("50000000000", "x").ok).toBe(false);
  });
});

describe("점검 흐름", () => {
  it("샘플 B: 정답표와 같은 판정(주의)이 화면용 이유와 함께 나온다", () => {
    const r = runCheck(load("B_caution.txt"), form({ marketPrice: "10억", priorDeposits: "27000", contractParty: "김도윤" }), AS_OF);
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.result.verdict).toBe("caution");
    expect(r.result.ratio).toBe(76);
    expect(r.flags[0]).toMatchObject({ code: "ratio_caution", level: "caution" });
    expect(r.flags[0].sources[0].id).toBe("S8");
  });

  it("샘플 C: 위험, 이유 첫 줄은 '예전 집주인'", () => {
    const r = runCheck(load("C_danger.txt"), form({ myDeposit: "1000", marketPrice: "9억", priorDeposits: "30000", contractParty: "최민서" }), AS_OF);
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.result.verdict).toBe("danger");
    expect(r.flags[0].code).toBe("owner_mismatch_previous_owner");
  });

  it("빈 서류 · 빈 보증금 · 글자 섞인 시세는 점검하지 않고 안내만 모아서 보여 준다", () => {
    const r = runCheck("   ", form({ myDeposit: "", marketPrice: "십억" }), AS_OF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });

  it("아주 긴 이름은 막는다", () => {
    expect(runCheck(load("A_safe.txt"), form({ contractParty: "가".repeat(200) }), AS_OF).ok).toBe(false);
  });

  it("못 읽은 칸이 있으면 주의, 사용자가 직접 확인했다고 표시하면 경고를 판정에서 뺀다", () => {
    const text = load("A_safe.txt").replace("채권최고액 금240,000,000원", "채권최고액 (흐림)");
    const before = runCheck(text, form({ marketPrice: "8억", priorDeposits: "10000", contractParty: "이하늘" }), AS_OF);
    if (!before.ok) throw new Error();
    expect(before.result.flags).toContain("read_incomplete");
    expect(before.result.verdict).not.toBe("safe");

    const after = runCheck(text, form({ marketPrice: "8억", priorDeposits: "10000", contractParty: "이하늘" }), AS_OF, {
      edited: before.read,
      confirmed: true,
    });
    if (!after.ok) throw new Error();
    expect(after.result.flags).not.toContain("read_incomplete");
  });

  it("을구가 없으면(빚 기록이 없는 집인지 쪽이 빠진 건지 모름) 확인 전에는 '안전'을 내지 않는다", () => {
    const f = form({ marketPrice: "10억", priorDeposits: "0", contractParty: "이하늘" });
    const noEul = load("A_safe.txt").replace(/【 을 구 】[\s\S]*?(?=-- 이 하)/, "");
    const before = runCheck(noEul, f, AS_OF);
    if (!before.ok) throw new Error();
    expect(before.result.verdict).not.toBe("safe");
    expect(before.warnings.some((w) => w.includes("을구"))).toBe(true);

    const after = runCheck(noEul, f, AS_OF, { edited: before.read, confirmed: true });
    if (!after.ok) throw new Error();
    expect(after.result.verdict).toBe("safe");

    // 요약 쪽에 '을구 기록사항 없음'이 찍혀 있으면 원래 빚 기록이 없는 집이라 경고하지 않는다
    const marked = noEul.replace("-- 이 하", "4. (근)저당권 및 전세권 등 ( 을구 )\n기록사항 없음\n\n-- 이 하");
    const ok = runCheck(marked, f, AS_OF);
    if (!ok.ok) throw new Error();
    expect(ok.result.verdict).toBe("safe");
  });

  it("사용자가 고친 값(근저당 금액)으로 다시 판정한다", () => {
    const base = runCheck(load("B_caution.txt"), form({ marketPrice: "10억", priorDeposits: "27000", contractParty: "김도윤" }), AS_OF);
    if (!base.ok) throw new Error();
    const edited = { ...base.read, active_mortgages: [{ max_claim: 600_000_000, creditor: "가나은행" }] };
    const r = runCheck("", form({ marketPrice: "10억", priorDeposits: "27000", contractParty: "김도윤" }), AS_OF, { edited, confirmed: true });
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.result.verdict).toBe("danger"); // 600 + 270 + 5 = 87.5%
  });
});

describe("오늘 날짜", () => {
  it("한국 시간 기준 (UTC 15시 = 다음 날 0시)", () => {
    expect(todayKST(new Date("2026-11-13T15:00:00Z"))).toBe("2026-11-14");
    expect(todayKST(new Date("2026-11-13T14:59:59Z"))).toBe("2026-11-13");
  });
});

describe("금액 보여 주기", () => {
  it.each([
    [485_000_000, "4억 8,500만 원"],
    [100_000_000, "1억 원"],
    [5_000_000, "500만 원"],
    [0, "0만 원"],
  ])("%d → %s", (won, text) => {
    expect(formatWon(won)).toBe(text);
  });
});

describe("이상한 입력 (7주차 점검표 ⑤)", () => {
  it("등기부등본이 아닌 글이면 판정(신호등)을 내지 않고 고칠 말만 준다", async () => {
    const { runCheck } = await import("@/lib/registry/check");
    const out = runCheck("가나다 ABCDEFG".repeat(2000), { myDeposit: "500", priorDeposits: "", marketPrice: "", contractParty: "" }, "2026-11-17");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.join(" ")).toMatch(/등기부등본 형식을 찾지 못했어요/);
  });

  it("오류 문장의 조사가 받침에 맞는다 (보증금은 · 월세는 · 시세가)", async () => {
    const { josa, parseManwon } = await import("@/lib/registry/check");
    expect(josa("보증금", "은", "는")).toBe("보증금은");
    expect(josa("월세", "은", "는")).toBe("월세는");
    expect(josa("건물 시세", "이", "가")).toBe("건물 시세가");
    const r = parseManwon("abc", "월세");
    expect(!r.ok && r.message).toBe("월세는 숫자로 적어 주세요. 예: 5,000,000 (원)");
  });
});

describe("원 금액 읽어 주기(입력 칸 옆 힌트)", () => {
  it.each([
    [5, "5원"],
    [50_000, "5만 원"],
    [1_234, "1,234원"],
    [50_000_000, "5,000만 원"],
    [800_000_000, "8억 원"],
    [812_345_678, "8억 1,234만 5,678원"],
    [0, "0원"],
  ])("%d → %s", (won, text) => expect(readWon(won)).toBe(text));
});
