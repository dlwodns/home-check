// F3 다음 행동 카드 테스트: 모든 판정 이유에 행동이 있는지, 문장 틀이 다 채워지는지, 개인정보가 새지 않는지.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import data from "@/data/actions.json";
import rules from "@/data/judge.json";
import { sources } from "@/lib/content";
import { buildActions, fill } from "@/lib/registry/actions";
import { runCheck, type CheckForm } from "@/lib/registry/check";

const load = (f: string) => readFileSync(`samples/${f}`, "utf8");
const AS_OF = "2026-11-13";
const run = (file: string, form: CheckForm) => {
  const r = runCheck(load(file), form, AS_OF);
  if (!r.ok) throw new Error(r.errors.join());
  return { r, a: buildActions(r.read, r.result) };
};

describe("문장 틀 데이터 (data/actions.json)", () => {
  const codes = Object.keys(rules.flags);
  const ids = new Set(sources.map((s) => s.id));

  it("판정 이유마다 빠짐없이 행동이 정해져 있다 (질문 또는 할 일)", () => {
    for (const code of codes) {
      const a = (data.flags as Record<string, { ask?: string[]; todo?: string[] }>)[code];
      expect(a, code).toBeTruthy();
      expect((a.ask?.length ?? 0) + (a.todo?.length ?? 0), code).toBeGreaterThan(0);
    }
    for (const code of Object.keys(data.flags)) expect(codes, `${code}은 judge.json에 없는 이유`).toContain(code);
  });

  it("특약은 모두 출처(근거 번호 또는 basis)가 있고, 가리키는 특약 · 근거가 실제로 있다", () => {
    const clauseIds = Object.keys(data.clauses);
    for (const [id, c] of Object.entries(data.clauses)) {
      expect(c.basis.trim(), id).not.toBe("");
      for (const s of c.sources) expect(ids.has(s), `${id} → ${s}`).toBe(true);
    }
    const used = [...data.always.clauses, ...Object.values(data.flags).flatMap((f) => (f as { clauses?: string[] }).clauses ?? [])];
    for (const u of used) expect(clauseIds, u).toContain(u);
  });

  it("문장 틀의 자리 이름은 정해진 것만 쓴다", () => {
    const allowed = new Set(["transferDate", "mortgageTotal", "ratio"]);
    const texts = Object.values(data.flags).flatMap((f) => [...((f as { ask?: string[] }).ask ?? []), ...((f as { todo?: string[] }).todo ?? [])]);
    for (const t of texts) for (const [, k] of t.matchAll(/\{(\w+)\}/g)) expect(allowed.has(k), `${k} in ${t}`).toBe(true);
  });

  it("모르는 자리는 빈칸 대신 '확인 필요'로", () => {
    expect(fill("{a}와 {b}", { a: "근저당" })).toBe("근저당와 확인 필요");
  });
});

describe("샘플로 만든 다음 행동", () => {
  it("C(위험): 예전 집주인 · 가압류 질문이 나오고, 날짜가 채워지며, 말소 특약이 붙는다", () => {
    const { a } = run("C_danger.txt", { myDeposit: "1000", priorDeposits: "30000", marketPrice: "9억", contractParty: "최민서" });
    expect(a.questions[0]).toContain("2026년 9월 1일에 집주인이 바뀌었더라고요");
    expect(a.questions.some((q) => q.includes("압류 · 가압류"))).toBe(true);
    expect(a.clauses.map((c) => c.id)).toEqual(["clear_by_balance_day", "undisclosed_info"]);
    expect(a.questions.join("").includes("{")).toBe(false);
  });

  it("B(주의): 근저당 합계가 문장에 들어간다", () => {
    const { a } = run("B_caution.txt", { myDeposit: "500", priorDeposits: "27000", marketPrice: "10억", contractParty: "김도윤" });
    expect(a.questions[0]).toContain("4억 8,500만 원");
  });

  it("A(안전): 질문은 없어도 '계약 당일 다시 떼기' 할 일과 법무부 권고 특약은 늘 나온다", () => {
    const { a, r } = run("A_safe.txt", { myDeposit: "500", priorDeposits: "10000", marketPrice: "8억", contractParty: "이하늘" });
    expect(r.result.verdict).toBe("safe");
    expect(a.questions).toEqual([]);
    expect(a.todos.at(-1)).toContain("계약하는 날 등기부등본을 다시 떼서");
    expect(a.clauses.map((c) => c.id)).toEqual(["undisclosed_info"]);
    expect(a.parentSummary).toContain("큰 위험 신호는 보이지 않았어요");
  });

  it("부모님 요약에는 집주인 이름 · 주소 같은 다른 사람 개인정보가 없다", () => {
    for (const [file, form] of [
      ["C_danger.txt", { myDeposit: "1000", priorDeposits: "30000", marketPrice: "9억", contractParty: "최민서" }],
      ["B_caution.txt", { myDeposit: "500", priorDeposits: "27000", marketPrice: "10억", contractParty: "김도윤" }],
    ] as const) {
      const { a, r } = run(file, form);
      for (const secret of [r.read.current_owner, ...r.read.previous_owners, r.read.address, form.contractParty]) {
        expect(a.parentSummary.includes(secret), `${file}: ${secret}`).toBe(false);
      }
      expect(a.parentSummary.startsWith("[홈체크] 등기부등본 점검 결과:")).toBe(true);
      expect(a.parentSummary).toContain("참고용 안내");
    }
  });

  it("같은 질문 · 할 일은 한 번만 나온다", () => {
    const { a } = run("C_danger.txt", { myDeposit: "1000", priorDeposits: "", marketPrice: "", contractParty: "최민서" });
    expect(new Set(a.questions).size).toBe(a.questions.length);
    expect(new Set(a.todos).size).toBe(a.todos.length);
  });
});
