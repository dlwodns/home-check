// 결과에 항상 붙는 '등기부등본으로는 알 수 없는 것' · 3줄 요약 (벤치마킹: 초록불 하나로 끝내지 않기)
import { describe, expect, it } from "vitest";
import { summaryLines } from "@/lib/registry/goodPoints";
import { UNKNOWN_IDS, unknownsFor } from "@/lib/registry/unknowns";
import { parseRooms } from "@/lib/store/rooms";
import { findSource } from "@/lib/content";
import type { FlagCode } from "@/lib/registry/types";

const ids = (building: string, flags: FlagCode[], ratio: number | null) => unknownsFor({ building_type: building }, { flags, ratio }).map((u) => u.id);

describe("등기부로는 알 수 없는 것", () => {
  it("'안전'이어도 늘 세금 체납 · 진짜 집주인 · 건축물대장 · 뗀 뒤 변화는 남는다", () => {
    expect(ids("아파트", [], null)).toEqual(["tax", "identity", "building", "later_changes"]);
  });

  it("다가구에서 앞선 보증금을 모르면 맨 앞에, 아파트는 해당 없음", () => {
    expect(ids("다가구주택", ["prior_deposits_unknown"], null)[0]).toBe("prior_deposits");
    expect(ids("아파트", ["prior_deposits_unknown"], null)).not.toContain("prior_deposits");
    expect(ids("다가구주택", [], null)).not.toContain("prior_deposits");
  });

  it("신탁이면 신탁원부, 시세를 적었으면 시세 확인이 붙는다", () => {
    expect(ids("다세대주택", ["trust"], 70)).toEqual(expect.arrayContaining(["trust_deed", "market"]));
  });

  it("붙인 근거 번호는 모두 근거 목록에 있다", () => {
    for (const u of unknownsFor({ building_type: "" }, { flags: ["prior_deposits_unknown", "trust"], ratio: 1 })) {
      for (const s of u.sources) expect(findSource(s), `${u.id}: ${s}`).toBeTruthy();
    }
  });

  it("예전에 저장한 점검 요약(목록 없음)은 늘 해당하는 것으로 채우고, 모르는 id는 버린다", () => {
    const base = { id: "r1", label: "a", address: "서교동 1", deposit: 1, rent: null, link: "", memo: "", branch: null, checked: {}, createdAt: "" };
    const check = { verdict: "safe", flags: [], ratio: null, asOf: "2026-11-17", actions: {} };
    const old = parseRooms(JSON.stringify({ v: 1, rooms: [{ ...base, check }] })).rooms[0].check!;
    expect(old.unknowns).toEqual(["tax", "identity", "building", "later_changes"]);
    const odd = parseRooms(JSON.stringify({ v: 1, rooms: [{ ...base, check: { ...check, unknowns: ["tax", "<x>"] } }] })).rooms[0].check!;
    expect(odd.unknowns).toEqual(["tax"]);
    expect(UNKNOWN_IDS).toContain("tax");
  });
});

describe("3줄 요약", () => {
  it("가장 먼저 볼 것 · 지금 할 일 · 개수", () => {
    expect(summaryLines("근저당이 커요", "집주인에게 물어보기", 2, 5)).toEqual([
      "가장 먼저: 근저당이 커요",
      "지금 할 일: 집주인에게 물어보기",
      "괜찮은 점 2가지 · 등기부로는 알 수 없는 것 5가지",
    ]);
    expect(summaryLines(null, null, 4, 4)[0]).toBe("등기부등본에서 위험 기록은 찾지 못했어요");
  });
});
