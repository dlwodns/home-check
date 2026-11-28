// F1 길잡이의 로직: 용어 밑줄 나누기, 진행 상황 저장.
import { describe, expect, it } from "vitest";
import { splitAll, splitByTerms } from "@/lib/content/terms";
import { EMPTY_PROGRESS, localProgressStore, parseProgress } from "@/lib/store/progress";

const words = (text: string) => splitByTerms(text).map((s) => (s.term ? `[${s.text}]` : s.text)).join("");

describe("용어 밑줄", () => {
  it("문장 속 용어를 찾는다", () => {
    expect(words("전입신고하기 (이사 후 14일 이내)")).toBe("[전입신고]하기 (이사 후 14일 이내)");
  });

  it("긴 말부터: 가압류를 압류로, 근저당권을 근저당으로 자르지 않는다", () => {
    expect(words("가압류와 근저당권")).toBe("[가압류]와 [근저당권]");
  });

  it("다른 이름(별칭)도 찾고, 원래 용어의 설명을 붙인다", () => {
    const seg = splitByTerms("선순위 보증금 확인").find((s) => s.term);
    expect(seg?.term?.term).toBe("앞선 세입자 보증금");
  });

  it("같은 화면에서 이미 설명한 용어는 다시 밑줄을 긋지 않는다 (짧은 용어로 쪼개지도 않음)", () => {
    const seen = new Set<string>();
    splitByTerms("근저당 확인", seen);
    expect(splitByTerms("근저당권과 압류", seen).map((s) => (s.term ? `[${s.text}]` : s.text)).join("")).toBe("근저당권과 [압류]");
  });

  it("splitAll은 몇 번을 불러도 같은 결과 (React가 두 번 그려도 밑줄이 사라지지 않음)", () => {
    const texts = ["근저당 확인", "근저당 다시"];
    expect(splitAll(texts)).toEqual(splitAll(texts));
    expect(splitAll(texts)[0][0].term?.term).toBe("근저당");
    expect(splitAll(texts)[1].some((s) => s.term)).toBe(false);
  });

  it("용어가 없으면 그대로", () => {
    expect(splitByTerms("수압 · 온수 확인하기")).toEqual([{ text: "수압 · 온수 확인하기" }]);
  });
});

describe("진행 상황 저장", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it("저장하고 다시 불러온다", () => {
    const s = localProgressStore(memory());
    s.save({ v: 1, mode: "first", branch: "direct", checked: { "prepare.budget": true } });
    expect(s.load()).toEqual({ v: 1, mode: "first", branch: "direct", checked: { "prepare.budget": true } });
  });

  it.each(["{깨진", "null", '{"v":2}', '"글자"', "[]"])("깨진 값(%s)은 버리고 빈 상태로", (raw) => {
    expect(parseProgress(raw)).toEqual(EMPTY_PROGRESS);
  });

  it("모르는 값 · 이상한 키는 걸러 낸다", () => {
    const p = parseProgress(JSON.stringify({ v: 1, mode: "hacker", branch: "x", checked: { "a.b": true, "c.d": "yes", "<script>": true } }));
    expect(p).toEqual({ v: 1, mode: null, branch: null, checked: { "a.b": true } });
  });

  it("저장이 막힌 브라우저(사생활 보호 모드)에서도 멈추지 않는다", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const s = localProgressStore(broken);
    expect(() => s.save({ ...EMPTY_PROGRESS, mode: "first" })).not.toThrow();
    expect(s.load()).toEqual(EMPTY_PROGRESS);
    expect(localProgressStore(null).load()).toEqual(EMPTY_PROGRESS);
  });
});

describe("진행 계산", async () => {
  const { steps, branches } = await import("@/lib/content");
  const { stepStats } = await import("@/lib/store/stats");
  const all = (ids: [string, string[]][]) =>
    Object.fromEntries(ids.flatMap(([g, items]) => items.map((i) => [`${g}.${i}`, true])));

  it("아무것도 안 했으면 1단계가 지금 할 차례", () => {
    const s = stepStats(steps, branches, EMPTY_PROGRESS);
    expect(s.current).toBe(1);
    expect(s.done).toBe(0);
    expect(s.total).toBe(steps.reduce((n, x) => n + x.items.filter((i) => !i.optional).length, 0));
  });

  it("직거래를 고르면 4단계에 직거래 체크리스트가 더해진다", () => {
    const base = stepStats(steps, branches, EMPTY_PROGRESS).perStep[3].total;
    const direct = stepStats(steps, branches, { ...EMPTY_PROGRESS, branch: "direct" }).perStep[3].total;
    expect(direct - base).toBe(branches.find((b) => b.id === "direct")!.items.length);
  });

  it("1 · 2단계를 다 하면 3단계가 지금 할 차례", () => {
    const checked = all([
      ["prepare", steps[0].items.map((i) => i.id)],
      ["search", steps[1].items.map((i) => i.id)],
    ]);
    const s = stepStats(steps, branches, { ...EMPTY_PROGRESS, checked });
    expect(s.current).toBe(3);
    expect(s.finishedSteps).toBe(2);
  });

  it("해당 없을 수 있는 항목(기숙사 · 사택, 가족과 상의)은 안 해도 진행에서 불리하지 않고, 하면 센다", () => {
    const prepare = steps[0];
    const required = prepare.items.filter((i) => !i.optional).map((i) => i.id);
    expect(required.length).toBeLessThan(prepare.items.length);
    const onlyRequired = stepStats(steps, branches, { ...EMPTY_PROGRESS, checked: all([["prepare", required]]) });
    expect(onlyRequired.perStep[0].done).toBe(onlyRequired.perStep[0].total);
    expect(onlyRequired.current).toBe(2);
    const withOptional = stepStats(steps, branches, { ...EMPTY_PROGRESS, checked: all([["prepare", prepare.items.map((i) => i.id)]]) });
    expect(withOptional.perStep[0].total).toBe(prepare.items.length);
  });

  it("'해 봤어요'여도 단계를 빼지 않는다(아는 것과 그 방에서 할 일은 다르다): 6단계 모두, 1단계부터", () => {
    const s = stepStats(steps, branches, { ...EMPTY_PROGRESS, mode: "experienced" });
    expect(s.perStep.filter((x) => x.skipped)).toEqual([]);
    expect(s.activeSteps).toBe(6);
    expect(s.current).toBe(1);
  });

  it("전부 하면 지금 할 차례가 없다(null)", () => {
    const checked = all([
      ...steps.map((st) => [st.id, st.items.map((i) => i.id)] as [string, string[]]),
      ["direct", branches.find((b) => b.id === "direct")!.items.map((i) => i.id)],
    ]);
    const s = stepStats(steps, branches, { v: 1, mode: "first", branch: "direct", checked });
    expect(s.current).toBeNull();
    expect(s.done).toBe(s.total);
  });
});
