// 내용 데이터(data/*.json)가 서로, 그리고 docs/SOURCES.md와 어긋나지 않는지 검사한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { branches, findTerm, sources, steps, terms } from "@/lib/content";

const sourceIds = new Set(sources.map((s) => s.id));
const allItems = [...steps.flatMap((s) => s.items), ...branches.flatMap((b) => b.items)];

describe("근거 목록", () => {
  it("SOURCES.md의 번호 · 상태와 data/sources.json이 같다", () => {
    const md = readFileSync("docs/SOURCES.md", "utf-8");
    const fromMd = [...md.matchAll(/^## (S\d+)\. .+\n\n- \*\*상태\*\*: (\S+)/gm)].map(([, id, mark]) => ({
      id,
      status: ({ "✅": "confirmed", "🟡": "check", "⚪": "not_legal" } as const)[mark as "✅" | "🟡" | "⚪"],
    }));
    expect(fromMd.length).toBeGreaterThan(0);
    expect(sources.map(({ id, status }) => ({ id, status }))).toEqual(fromMd);
  });

  it("모든 근거는 사용자가 눌러서 확인할 곳(공식 링크 · 참고 자료)이 있거나, 법정 기준이 아님을 밝힌다", () => {
    for (const s of sources) {
      expect(Boolean(s.official_url) || s.refs.length > 0 || s.status === "not_legal", s.id).toBe(true);
      expect(s.summary.trim(), s.id).not.toBe("");
    }
  });

  it("SOURCES.md의 참고 자료 링크와 data/sources.json의 refs가 같다", () => {
    const md = readFileSync("docs/SOURCES.md", "utf-8");
    for (const s of sources) {
      const block = md.split(/\n(?=## S\d+\. )/).find((b) => b.startsWith(`## ${s.id}. `)) ?? "";
      const line = block.split("\n").find((l) => l.startsWith("- **참고 자료**")) ?? "";
      const urls = [...line.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
      expect(s.refs.map((r) => r.url), s.id).toEqual(urls);
    }
  });

  it("체크리스트 · 용어가 다는 근거 번호는 모두 근거 목록에 있다", () => {
    const used = [...allItems.flatMap((i) => i.sources), ...terms.flatMap((t) => t.sources)];
    const missing = used.filter((id) => !sourceIds.has(id));
    expect(missing).toEqual([]);
  });
});

describe("6단계 · 체크리스트", () => {
  it("단계는 1~6 순서이고, 4단계가 핵심 단계다", () => {
    expect(steps.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(steps.find((s) => s.key)?.no).toBe(4);
  });

  it("중개사 · 직거래 두 갈래가 있다", () => {
    expect(branches.map((b) => b.id).sort()).toEqual(["broker", "direct"]);
  });

  it("모든 항목에 할 일과 '왜 중요해요?' 한 줄이 있다", () => {
    for (const item of allItems) {
      expect(item.text.trim(), item.id).not.toBe("");
      expect(item.why.trim(), item.id).not.toBe("");
    }
  });

  it("두 갈래 모두 등기부등본 점검(F2)으로 이어진다", () => {
    for (const b of branches) expect(b.items.some((i) => i.opens === "F2"), b.id).toBe(true);
  });

  it("단계 안 · 갈래 안의 항목 id가 겹치지 않는다", () => {
    for (const group of [...steps, ...branches]) {
      const ids = group.items.map((i) => i.id);
      expect(new Set(ids).size, group.id).toBe(ids.length);
    }
  });
});

describe("용어 사전", () => {
  it("'확인됨(verified)' 용어는 법령 원문으로 확인된(✅) 근거를 하나 이상 단다", () => {
    const confirmed = new Set(sources.filter((s) => s.status === "confirmed").map((s) => s.id));
    for (const t of terms.filter((t) => t.verified)) {
      expect(t.sources.some((id) => confirmed.has(id)), t.term).toBe(true);
    }
  });

  it("용어와 다른 이름이 서로 겹치지 않는다", () => {
    const words = terms.flatMap((t) => [t.term, ...t.aliases]);
    expect(new Set(words).size).toBe(words.length);
  });

  it("한 줄 설명은 비어 있지 않고 짧다(90자 이하)", () => {
    for (const t of terms) {
      expect(t.short.trim(), t.term).not.toBe("");
      expect(t.short.length, t.term).toBeLessThanOrEqual(90);
    }
  });

  it("다른 이름으로도 찾을 수 있다", () => {
    expect(findTerm("선순위 보증금")?.id).toBe("prior_deposits");
    expect(findTerm("근저당권")?.id).toBe("mortgage");
  });
});
