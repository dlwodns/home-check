// 블라인드 시험 서류 (samples/blind = 1차 10건, samples/blind2 = 2차 10건). 홈체크 코드를 보지 않은 에이전트가
// 실제 등기사항전부증명서 양식대로 만들고, 정답(answers.json)도 서류만 보고 먼저 적었다.
// 11/17 채점: 1차 48/60 → 고친 뒤 60/60, 2차(1차를 고친 뒤 새로 만든 것) 40/60 → 고친 뒤 60/60.
// 이제 두 묶음 모두 '고칠 때 본' 서류라 블라인드가 아니므로, 같은 실수가 다시 나오지 않게 막는 회귀 테스트로 쓴다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/lib/registry/pdf";
import { readRegistry } from "@/lib/registry/read";
import { judge } from "@/lib/registry/judge";
import type { RegistryRead } from "@/lib/registry/types";

interface Answer {
  file: string;
  current_owners: { name: string; share: string | null }[];
  previous_owners: string[];
  last_ownership_transfer: string | null;
  mortgage_total_won: number;
  active_risks: string[];
  erased_risks: string[];
  contract_inputs: { my_deposit_won: number; prior_deposits_won: number | null; market_price_won: number | null; contract_party: string };
}

const SETS = ["blind", "blind2"] as const;
const answers = SETS.flatMap((set) =>
  (JSON.parse(readFileSync(`samples/${set}/answers.json`, "utf8")) as Answer[]).map((a) => ({ ...a, set })),
);
const RISK: Record<string, string> = { 가처분: "provisional_disposition", 가등기: "provisional_registration", 경매개시결정: "auction", 신탁: "trust", 임차권등기: "lease_registration" };
const pdfjs = () => import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<Parameters<typeof extractPdfText>[1]>;

function facts(read: RegistryRead) {
  return {
    owners: read.current_owner.split(/,\s*/).filter(Boolean).sort(),
    previous: read.previous_owners,
    lastTransfer: read.last_ownership_transfer,
    mortgageTotal: read.active_mortgages.reduce((s, m) => s + m.max_claim, 0),
    risks: [...new Set([...(read.seizures.length ? ["seizure"] : []), ...(read.jeonses.length ? ["jeonse"] : []), ...read.risk_records.map((r) => RISK[r.type])])].sort(),
    erasedLease: read.erased_risk_records.some((r) => r.type === "임차권등기"),
  };
}

const want = (a: Answer) => ({
  owners: a.current_owners.map((o) => o.name).sort(),
  previous: a.previous_owners,
  lastTransfer: a.last_ownership_transfer,
  mortgageTotal: a.mortgage_total_won,
  risks: [...a.active_risks].sort(),
  erasedLease: a.erased_risks.includes("lease_registration"),
});

describe("블라인드 서류 20건: 글자로 붙여 넣기", () => {
  it.each(answers)("$set/$file: 집주인 · 이전 소유자 · 근저당 합계 · 위험 기록이 사람이 먼저 적은 정답과 같고, 경고가 없다", (a) => {
    const { read, warnings } = readRegistry(readFileSync(`samples/${a.set}/${a.file}`, "utf8"));
    expect(facts(read)).toEqual(want(a));
    expect(warnings).toEqual([]);
  });
});

describe("블라인드 서류 20건: PDF로 올리기", () => {
  it.each(answers)("$set/$file: PDF로 읽어도 같은 결과", async (a) => {
    const pdf = readFileSync(`samples/${a.set}/pdf/${a.file.replace(".txt", ".pdf")}`);
    const r = await extractPdfText(new Uint8Array(pdf), await pdfjs());
    const { read } = readRegistry(r.text);
    expect(facts(read)).toEqual(want(a));
  });
});

describe("블라인드 서류: 판정이 위험을 놓치지 않는다", () => {
  const verdictOf = (file: string) => {
    const a = answers.find((x) => x.file === file)!;
    const { read, warnings } = readRegistry(readFileSync(`samples/${a.set}/${file}`, "utf8"));
    const ci = a.contract_inputs;
    return judge(read, { market_price: ci.market_price_won, prior_deposits: ci.prior_deposits_won, my_deposit: ci.my_deposit_won, contract_party: ci.contract_party }, "2026-11-17", warnings);
  };

  it("공유 주택에 공유자 한 명만 오면 '안전'이 아니다 (1차 채점에서 놓쳤던 경우)", () => {
    const r = verdictOf("B04.txt");
    expect(r.verdict).not.toBe("safe");
    expect(r.flags).toContain("co_owned");
  });

  it("먼저 설정된 전세권은 주의로 알리고 빚 비율에 더한다", () => {
    expect(verdictOf("B08.txt").flags).toContain("jeonse");
  });

  it("신탁 주택에 위탁자(예전 소유자)가 오면 위험", () => {
    const r = verdictOf("B05.txt");
    expect(r.verdict).toBe("danger");
    expect(r.flags).toEqual(expect.arrayContaining(["trust", "owner_mismatch_previous_owner"]));
  });

  it("가등기가 남은 집을 예전 소유자가 계약하러 오면 위험", () => {
    expect(verdictOf("B09.txt").flags).toEqual(expect.arrayContaining(["provisional_registration", "owner_mismatch_previous_owner"]));
  });

  it("을구 머리글이 쪽 경계에서 다시 나와도 근저당을 놓치지 않는다 (2차에서 경고 없이 3억 1,200만 원을 놓쳤던 경우)", () => {
    const { read } = readRegistry(readFileSync("samples/blind2/C06.txt", "utf8"));
    expect(read.active_mortgages.reduce((s, m) => s + m.max_claim, 0)).toBe(312_000_000);
  });

  it("가처분의 '소유권이전등기청구권' 설명을 소유권 이전으로 착각하지 않는다", () => {
    const r = verdictOf("C05.txt");
    expect(r.flags).toContain("provisional_disposition");
    expect(r.flags).not.toContain("owner_mismatch_previous_owner");
  });

  it("가등기 후 본등기가 끝났으면 가등기권자가 집주인이고, 가등기는 남은 위험이 아니다", () => {
    expect(verdictOf("C09.txt").flags).not.toContain("provisional_registration");
  });

  it("개명한 집주인(등기명의인표시변경)이 오면 다른 사람으로 보지 않는다", () => {
    expect(verdictOf("C10.txt").flags).not.toContain("owner_mismatch");
  });

  it("소유자의 배우자가 계약하러 오면 집주인과 다르다고 알린다", () => {
    expect(verdictOf("C07.txt").flags).toContain("owner_mismatch");
  });
});
