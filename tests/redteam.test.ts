// '안전' 오판 방지 레드팀 시험: 안전 샘플을 일부러 망가뜨려도 '안전'이 나오면 안 된다.
// (a) 을구 삭제 (b) 소유자 줄 삭제 (c) 살아 있는 압류 · 가압류 · 경매개시결정 (d) 신탁등기 (e) 시세 빈칸 · 0
// 반대 방향(말소된 기록을 살아 있는 것으로 읽기)과 이상한 입력도 함께 본다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runCheck, type CheckForm } from "@/lib/registry/check";

const A = readFileSync("samples/A_safe.txt", "utf8");
const AS_OF = "2026-11-28";
const form = (p: Partial<CheckForm> = {}): CheckForm => ({ myDeposit: "500", priorDeposits: "0", marketPrice: "10억", contractParty: "이하늘", ...p });
const addToGap = (line: string) => A.replace("\n\n【 을 구 】", `\n${line}\n\n【 을 구 】`);
const verdictOf = (text: string, f = form()) => {
  const r = runCheck(text, f, AS_OF);
  if (!r.ok) throw new Error(r.errors.join());
  return r.result;
};

describe("레드팀: 안전 샘플을 망가뜨려도 '안전'이 나오지 않는다", () => {
  it("기준: 손대지 않은 안전 샘플은 안전", () => {
    expect(verdictOf(A).verdict).toBe("safe");
  });

  it.each([
    ["(a) 을구 통째 삭제", A.replace(/【 을 구 】[\s\S]*?(?=-- 이 하)/, "")],
    ["(b) 소유자 이름 줄 삭제", A.replace(/소유자 이하늘 850101-\*+ 가상시 한빛구 새내동 101-1/, "")],
    ["(b) 갑구 1번 줄 통째 삭제", A.replace(/^1 \| 소유권보존.*$/m, "")],
    ["(c) 압류", addToGap("2 | 압류 | 2026년9월1일 제5005호 | 2026년8월30일 압류(세무과-1234) | 권리자 국")],
    ["(c) 가압류", addToGap("2 | 가압류 | 2026년9월1일 제5005호 | 2026년8월30일 서울지방법원의 가압류결정(2026카단1) | 청구금액 금30,000,000원 채권자 김가상")],
    ["(c) 경매개시결정", addToGap("2 | 임의경매개시결정 | 2026년9월1일 제5005호 | 2026년8월30일 서울지방법원의 임의경매개시결정(2026타경1) | 채권자 가나은행")],
    ["(d) 신탁등기", addToGap("2 | 소유권이전 | 2025년1월1일 제4004호 | 2025년1월1일 신탁 | 수탁자 가나신탁주식회사\n  | 신탁 | | | 신탁원부 제2025-1호")],
  ])("%s → 안전 아님", (_, text) => {
    expect(verdictOf(text).verdict).not.toBe("safe");
  });

  it.each([
    ["(e) 시세 빈칸", ""],
    ["(e) 시세 0", "0"],
  ])("%s → 비율을 계산하지 않고 주의", (_, marketPrice) => {
    const r = verdictOf(A, form({ marketPrice }));
    expect(r.verdict).toBe("caution");
    expect(r.ratio).toBeNull();
    expect(r.flags).toContain("ratio_unknown");
  });

  it("압류 · 경매는 위험, 신탁은 위험 + 집주인 불일치까지 함께 알린다", () => {
    expect(verdictOf(addToGap("2 | 압류 | 2026년9월1일 제5005호 | 2026년8월30일 압류(세무과-1234) | 권리자 국")).flags).toContain("seizure");
    expect(verdictOf(addToGap("2 | 임의경매개시결정 | 2026년9월1일 제5005호 | 2026년8월30일 서울지방법원의 임의경매개시결정(2026타경1) | 채권자 가나은행")).flags).toContain("auction");
    const trust = verdictOf(addToGap("2 | 소유권이전 | 2025년1월1일 제4004호 | 2025년1월1일 신탁 | 수탁자 가나신탁주식회사\n  | 신탁 | | | 신탁원부 제2025-1호"));
    expect(trust.verdict).toBe("danger");
    expect(trust.flags).toContain("trust");
  });
});

describe("반대 방향: 말소된 기록은 살아 있는 것으로 보지 않는다", () => {
  it("말소된 압류는 위험으로 치지 않는다", () => {
    const text = addToGap(
      "2 | 압류 | 2024년9월1일 제5005호 | 2024년8월30일 압류(세무과-1234) | 권리자 국\n3 | 2번압류등기말소 | 2025년1월2일 제6006호 | 2025년1월2일 해제 | ",
    );
    expect(verdictOf(text).verdict).toBe("safe");
  });

  it("말소된 근저당(샘플 A의 2억 4천)은 빚 비율에 넣지 않는다", () => {
    expect(verdictOf(A).mortgage_total).toBe(0);
  });
});

describe("월세 · 전세 모두 같은 식으로 계산한다", () => {
  it.each([
    ["월세 보증금 500만", "500", "safe"],
    ["전세 3억", "30000", "safe"],
    ["전세 8억 5천", "85000", "danger"],
  ])("%s → %s", (_, myDeposit, verdict) => {
    expect(verdictOf(A, form({ myDeposit })).verdict).toBe(verdict);
  });
});

describe("이상한 입력은 판정하지 않고 고칠 말만 준다", () => {
  it.each([
    ["빈 서류", "", form()],
    ["등기부가 아닌 글", "서울시는 오늘 전세사기 예방 대책을 발표했다. 시장은 기자회견에서 임차인 보호를 강조했다.", form()],
    ["보증금 음수", A, form({ myDeposit: "-500" })],
    ["보증금 문자", A, form({ myDeposit: "오백" })],
    ["시세 음수", A, form({ marketPrice: "-3억" })],
  ])("%s", (_, text, f) => {
    const r = runCheck(text, f, AS_OF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });
});
