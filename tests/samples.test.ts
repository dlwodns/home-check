// 가짜 샘플 등기부등본 3종과 정답표(samples/expected.json)가 서로 맞는지 검사한다.
// 읽기 테스트는 tests/read.test.ts, 판정 테스트는 tests/judge.test.ts.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import expected from "@/samples/expected.json";
import judgeRules from "@/data/judge.json";
import type { CheckInputs, CheckResult, RegistryRead } from "@/lib/registry/types";

interface Sample {
  file: string;
  read: RegistryRead;
  inputs: CheckInputs;
  expected: CheckResult;
}

const samples = expected.samples as Sample[];
const { ratio_levels } = expected.rules;

describe("샘플 정답표", () => {
  it("안전 · 주의 · 위험 3종이 하나씩 있다", () => {
    expect(samples.map((s) => s.expected.verdict).sort()).toEqual(["caution", "danger", "safe"]);
  });

  describe.each(samples)("$file", (s) => {
    it("샘플 파일이 있다", () => {
      expect(existsSync(`samples/${s.file}`)).toBe(true);
    });

    it("근저당 합계는 말소되지 않은 근저당만 더한 값이다", () => {
      const total = s.read.active_mortgages.reduce((sum, m) => sum + m.max_claim, 0);
      expect(total).toBe(s.expected.mortgage_total);
    });

    it("비율은 (근저당 + 앞선 보증금 + 내 보증금) ÷ 시세를 소수 한 자리로 반올림한 값이다", () => {
      const { market_price, prior_deposits, my_deposit } = s.inputs;
      const ratio = ((s.expected.mortgage_total + prior_deposits! + my_deposit) / market_price!) * 100;
      expect(Math.round(ratio * 10) / 10).toBe(s.expected.ratio);
    });

    it("비율 구간이 판정과 어긋나지 않는다", () => {
      const r = s.expected.ratio!;
      const byRatio = r >= ratio_levels.danger_from ? "danger" : r >= ratio_levels.caution_from ? "caution" : "safe";
      // 비율 말고 다른 이유(소유자 불일치 · 가압류)로 더 나쁜 판정이 될 수는 있지만, 더 좋아지지는 않는다
      const order = { safe: 0, caution: 1, danger: 2 } as const;
      expect(order[s.expected.verdict]).toBeGreaterThanOrEqual(order[byRatio]);
    });
  });
});

describe("정답표와 판정 규칙 파일이 같은 기준을 쓴다", () => {
  it("비율 기준(70 · 80)이 data/judge.json과 같다", () => {
    expect(ratio_levels.caution_from).toBe(judgeRules.ratio.caution_from);
    expect(ratio_levels.danger_from).toBe(judgeRules.ratio.danger_from);
  });
  // 읽기 테스트는 tests/read.test.ts, 판정 테스트는 tests/judge.test.ts
});
