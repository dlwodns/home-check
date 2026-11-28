// F2 위험 판정 테스트.
// 1) 샘플 3종: 읽기 → 판정 전체 흐름이 정답표 expected와 같은지
// 2) 규칙 하나하나: 이름 비교, 공동 소유, 신탁 · 가처분 · 가등기 · 경매 · 임차권등기, 시세 모름, 비율 경계, 최근 소유권 이전 경계
// 3) 규칙 파일(data/judge.json): 모든 이유에 등급 · 문구 · 근거가 있고, 근거 번호가 실제로 있는지
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import expected from "@/samples/expected.json";
import rules from "@/data/judge.json";
import { sources } from "@/lib/content";
import { judge, levelOf } from "@/lib/registry/judge";
import { readRegistry } from "@/lib/registry/read";
import type { CheckInputs, CheckResult, FlagCode, RegistryRead } from "@/lib/registry/types";

const AS_OF = expected.rules.as_of;
const samples = expected.samples as unknown as {
  file: string;
  read: RegistryRead;
  inputs: CheckInputs;
  expected: CheckResult;
}[];
const load = (file: string) => readFileSync(`samples/${file}`, "utf8");
const B = samples.find((s) => s.file === "B_caution.txt")!;

/** B(주의) 샘플을 바탕으로 일부만 바꾼 읽기 결과 */
const readB = (patch: Partial<RegistryRead> = {}): RegistryRead => ({ ...structuredClone(B.read), ...patch });
const inputsB = (patch: Partial<CheckInputs> = {}): CheckInputs => ({ ...B.inputs, ...patch });

describe("샘플 3종: 읽기 → 판정", () => {
  it.each(samples)("$file: 정답표 expected와 같다", (s) => {
    const { read, warnings } = readRegistry(load(s.file));
    expect(judge(read, s.inputs, AS_OF, warnings)).toEqual(s.expected);
  });
});

describe("집주인 확인", () => {
  it("띄어쓰기가 달라도 같은 이름으로 본다", () => {
    expect(judge(readB(), inputsB({ contract_party: "김 도윤" }), AS_OF).flags).not.toContain("owner_mismatch");
  });

  it("다른 사람이면 위험", () => {
    const r = judge(readB(), inputsB({ contract_party: "박대리" }), AS_OF);
    expect(r.flags).toContain("owner_mismatch");
    expect(r.verdict).toBe("danger");
  });

  it("이름을 아직 모르면 판정을 바꾸지 않고 참고 안내만", () => {
    const r = judge(readB(), inputsB({ contract_party: "" }), AS_OF);
    expect(r.flags).toContain("owner_unchecked");
    expect(r.verdict).toBe("caution"); // B는 비율 76%라 원래 주의
  });

  it("공동 소유인데 그중 한 명과만 계약하면 위험 (민법 제265조: 임대 같은 관리는 지분 과반수, S29)", () => {
    const r = judge(readB({ current_owner: "김도윤, 김하나" }), inputsB(), AS_OF);
    expect(r.flags).toContain("co_owned");
    expect(r.flags).not.toContain("owner_mismatch");
    expect(r.verdict).toBe("danger");
  });
});

describe("위험 기록", () => {
  it.each([
    ["신탁", "trust"],
    ["가처분", "provisional_disposition"],
    ["가등기", "provisional_registration"],
    ["경매개시결정", "auction"],
    ["임차권등기", "lease_registration"],
  ] as const)("%s이(가) 남아 있으면 위험 (%s)", (type, flag) => {
    const r = judge(readB({ risk_records: [{ type, date: "2026-10-01" }] }), inputsB(), AS_OF);
    expect(r.flags).toContain(flag);
    expect(r.verdict).toBe("danger");
  });

  it("말소된 임차권등기는 참고 안내만 (등급은 그대로)", () => {
    const r = judge(readB({ erased_risk_records: [{ type: "임차권등기", date: "2024-03-01" }] }), inputsB(), AS_OF);
    expect(r.flags).toContain("past_lease_registration");
    expect(r.verdict).toBe("caution");
  });
});

describe("못 읽은 칸이 있으면 '안전'을 내지 않는다 (4주차 원칙: 빈 값을 0으로 치지 않기)", () => {
  it("등기부등본이 아닌 글: 근저당 0건으로 보여도 안전이 아니라 주의 + 확인 필요", () => {
    const { read, warnings } = readRegistry("안녕하세요 원룸 계약 문의드립니다");
    const r = judge(read, { market_price: 800000000, prior_deposits: 0, my_deposit: 5000000, contract_party: "" }, AS_OF, warnings);
    expect(warnings.length).toBeGreaterThan(0);
    expect(r.flags).toContain("read_incomplete");
    expect(r.verdict).not.toBe("safe");
  });

  it("갑구가 빠진 A(원래 안전) → 안전이 아니다", () => {
    const A = samples.find((s) => s.file === "A_safe.txt")!;
    const text = load("A_safe.txt").replace(/【 갑 구 】[\s\S]*?(?=【 을 구 】)/, "");
    const { read, warnings } = readRegistry(text);
    const r = judge(read, A.inputs, AS_OF, warnings);
    expect(r.flags).toContain("read_incomplete");
    expect(r.verdict).not.toBe("safe");
  });

  it("근저당 금액을 못 읽은 경우 → 안전이 아니다", () => {
    const A = samples.find((s) => s.file === "A_safe.txt")!;
    const text = load("A_safe.txt").replace("채권최고액 금240,000,000원", "채권최고액 (흐림)");
    const { read, warnings } = readRegistry(text);
    expect(judge(read, A.inputs, AS_OF, warnings).verdict).not.toBe("safe");
  });

  it("다 읽은 A는 그대로 안전", () => {
    const A = samples.find((s) => s.file === "A_safe.txt")!;
    const { read, warnings } = readRegistry(load("A_safe.txt"));
    expect(judge(read, A.inputs, AS_OF, warnings).verdict).toBe("safe");
  });
});

describe("빚 비율", () => {
  it("시세를 모르면 비율 없이 주의 + 시세를 넣어 달라는 안내", () => {
    const r = judge(readRegistry(load("A_safe.txt")).read, { ...samples[0].inputs, market_price: null }, AS_OF);
    expect(r.ratio).toBeNull();
    expect(r.flags).toContain("ratio_unknown");
    expect(r.verdict).toBe("caution");
  });

  it.each([
    [69.9, "safe"],
    [70.0, "caution"],
    [79.9, "caution"],
    [80.0, "danger"],
  ] as const)("비율 %s%% → %s (경계값)", (pct, verdict) => {
    // 근저당 0, 앞선 보증금 0, 내 보증금 = 시세 × pct
    const read = readB({ active_mortgages: [] });
    const r = judge(read, { market_price: 1000, prior_deposits: 0, my_deposit: pct * 10, contract_party: "김도윤" }, AS_OF);
    expect(r.ratio).toBe(pct);
    expect(r.verdict).toBe(verdict);
  });
});

describe("앞선 세입자 보증금을 모를 때", () => {
  it("0으로 치고 끝내지 않고 주의 + '실제보다 낮게 보일 수 있음'", () => {
    const r = judge(readB({ active_mortgages: [] }), { market_price: 1000, prior_deposits: null, my_deposit: 100, contract_party: "김도윤" }, AS_OF);
    expect(r.ratio).toBe(10);
    expect(r.flags).toContain("prior_deposits_unknown");
    expect(r.verdict).toBe("caution");
  });
  it("아파트 · 다세대처럼 호수마다 따로 등기된 집이면 비워 둬도 '모름'으로 치지 않는다", () => {
    for (const building_type of ["아파트", "다세대주택", "오피스텔"]) {
      const r = judge(readB({ active_mortgages: [], building_type }), { market_price: 1000, prior_deposits: null, my_deposit: 100, contract_party: "김도윤" }, AS_OF);
      expect(r.flags).not.toContain("prior_deposits_unknown");
      expect(r.verdict).toBe("safe");
    }
  });

});

describe("최근 소유권 이전 (참고, 6개월)", () => {
  it.each([
    ["2026-05-13", true],
    ["2026-05-12", false],
  ])("이전일 %s, 기준일 2026-11-13 → 참고 안내 %s", (date, shown) => {
    const r = judge(readB({ last_ownership_transfer: date }), inputsB(), "2026-11-13");
    expect(r.flags.includes("recent_transfer")).toBe(shown);
    expect(r.verdict).toBe("caution"); // 참고 안내는 등급을 바꾸지 않는다
  });
});

describe("판정 규칙 파일 (data/judge.json)", () => {
  const ids = new Set(sources.map((s) => s.id));
  const codes = Object.keys(rules.flags) as FlagCode[];

  it("모든 이유에 등급 · 문구 · 실제로 있는 근거 번호가 있다", () => {
    for (const code of codes) {
      const f = rules.flags[code];
      expect(["danger", "caution", "info"], code).toContain(f.level);
      expect(f.title.trim(), code).not.toBe("");
      // 근거 번호가 없으면 홈체크 자체 원칙(basis)이라도 적혀 있어야 한다
      const basis = (f as { basis?: string }).basis ?? "";
      expect(f.sources.length > 0 || basis.trim() !== "", code).toBe(true);
      for (const id of f.sources) expect(ids.has(id), `${code} → ${id}`).toBe(true);
    }
  });

  it("이유 순서: 위험 → 주의 → 참고", () => {
    const r = judge(
      readB({ last_ownership_transfer: "2026-10-01", risk_records: [{ type: "가처분", date: "" }] }),
      inputsB(),
      AS_OF,
    );
    const ranks = r.flags.map((f) => ({ danger: 0, caution: 1, info: 2 })[levelOf(f)]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});
