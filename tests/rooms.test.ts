// F4 내 후보 방: 입력 검사 · 저장값 검사(깨진 값 · 위험한 링크) · 점검 요약에 개인정보가 없는지 · 진행 막대 계산.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import expected from "@/samples/expected.json";
import { branches, steps } from "@/lib/content";
import { buildActions } from "@/lib/registry/actions";
import { runCheck } from "@/lib/registry/check";
import {
  addRoom,
  EMPTY_ROOMS,
  MAX_ROOMS,
  newRoomId,
  parseRooms,
  removeRoom,
  roomIdFrom,
  roomProgress,
  safeLink,
  summarize,
  updateRoom,
  validateRoomInput,
  withRoom,
  type CheckSummary,
  type Room,
  type RoomDraft,
} from "@/lib/store/rooms";
import { checkLine, flagViews, moneyLine, roomSteps, toCheckCount } from "@/app/ui/roomView";

const draft: RoomDraft = { label: "정문 원룸", address: "OO동 123-4", deposit: 1000, rent: 50, link: "", memo: "정문 원룸" };
const room = (over: Partial<Room> = {}): Room => ({ id: "r1", ...draft, branch: null, checked: {}, check: null, createdAt: "2026-11-17", ...over });

describe("후보 방 추가 칸 검사", () => {
  it("주소 · 보증금 · 월세 · 메모를 저장할 값으로 바꾼다 (쉼표 · 억 단위 허용)", () => {
    const v = validateRoomInput({ address: "  OO동   123-4 ", deposit: "1,000", rent: "50", note: "정문 원룸" });
    expect(v).toEqual({ ok: true, draft });
    const big = validateRoomInput({ address: "OO동 1", deposit: "1억 2,000", rent: "", note: "" });
    expect(big.ok && big.draft).toMatchObject({ deposit: 12000, rent: null, label: "OO동 1" });
  });

  it("메모 칸의 http(s) 주소는 링크로, 나머지는 메모로 나눈다", () => {
    const v = validateRoomInput({ address: "OO동 1", deposit: "500", rent: "40", note: "후문 B https://example.com/room/1?x=2 5분" });
    expect(v.ok && v.draft).toMatchObject({ link: "https://example.com/room/1?x=2", memo: "후문 B 5분", label: "후문 B 5분" });
  });

  it("빈 주소 · 숫자가 아닌 보증금은 고칠 말을 돌려준다", () => {
    const v = validateRoomInput({ address: " ", deposit: "천만원", rent: "abc", note: "" });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors.address).toMatch(/주소를 적어/);
      expect(v.errors.deposit).toMatch(/숫자로/);
      expect(v.errors.rent).toMatch(/숫자로/);
    }
    const noDeposit = validateRoomInput({ address: "OO동 1", deposit: "", rent: "", note: "" });
    expect(!noDeposit.ok && noDeposit.errors.deposit).toMatch(/보증금을 적어/);
  });

  it("메모가 너무 길면 막는다", () => {
    const v = validateRoomInput({ address: "OO동 1", deposit: "500", rent: "", note: "가".repeat(61) });
    expect(!v.ok && v.errors.note).toMatch(/60자/);
  });
});

describe("링크 안전 검사", () => {
  it("http · https만 링크로 인정한다", () => {
    expect(safeLink("https://zigbang.com/home/1")).toBe("https://zigbang.com/home/1");
    expect(safeLink("javascript:alert(1)")).toBe("");
    expect(safeLink("data:text/html,<b>x</b>")).toBe("");
    expect(safeLink("not a url")).toBe("");
  });

  it("저장소에 위험한 링크가 들어 있어도 불러올 때 지운다", () => {
    const raw = JSON.stringify({ v: 1, rooms: [{ ...room(), link: "javascript:alert(document.cookie)" }] });
    expect(parseRooms(raw).rooms[0].link).toBe("");
  });
});

describe("저장값 불러오기", () => {
  it("깨진 값 · 다른 모양은 빈 목록", () => {
    expect(parseRooms(null)).toEqual(EMPTY_ROOMS);
    expect(parseRooms("{oops")).toEqual(EMPTY_ROOMS);
    expect(parseRooms(JSON.stringify({ v: 2, rooms: [] }))).toEqual(EMPTY_ROOMS);
  });

  it("이상한 방만 버리고, 같은 id는 하나만, 최대 개수까지만", () => {
    const rooms = [room(), room(), { ...room({ id: "bad id!" }) }, { id: "r2", address: "", deposit: 1 }, room({ id: "r3", deposit: -5 })];
    expect(parseRooms(JSON.stringify({ v: 1, rooms })).rooms.map((r) => r.id)).toEqual(["r1"]);
    const many = Array.from({ length: MAX_ROOMS + 5 }, (_, i) => room({ id: `r${i}` }));
    expect(parseRooms(JSON.stringify({ v: 1, rooms: many })).rooms).toHaveLength(MAX_ROOMS);
  });

  it("점검 요약의 판정이 이상하면 요약을 버리고, 이유 코드는 모양을 검사한다", () => {
    const bad = room({ check: { verdict: "great", flags: [], ratio: 1, asOf: "x", actions: {} } as unknown as CheckSummary });
    expect(parseRooms(JSON.stringify({ v: 1, rooms: [bad] })).rooms[0].check).toBeNull();
    const odd = room({ check: { verdict: "caution", flags: ["ratio_caution", "<img>"], ratio: 76, asOf: "2026-11-17", actions: {} } as unknown as CheckSummary });
    const c = parseRooms(JSON.stringify({ v: 1, rooms: [odd] })).rooms[0].check!;
    expect(c.flags).toEqual(["ratio_caution"]);
    expect(c.actions).toEqual({ questions: [], todos: [], clauses: [], parentSummary: "" });
  });

  it("저장 → 불러오기를 해도 값이 그대로다", () => {
    const s = addRoom(EMPTY_ROOMS, draft, "r9", "2026-11-17");
    expect(parseRooms(JSON.stringify(s))).toEqual(s);
  });
});

describe("방 추가 · 고치기 · 지우기", () => {
  it("새 방은 맨 위에, 갈래 · 체크 · 점검은 비어서 시작", () => {
    const s = addRoom(addRoom(EMPTY_ROOMS, draft, "a", "d"), { ...draft, label: "B" }, "b", "d");
    expect(s.rooms.map((r) => r.id)).toEqual(["b", "a"]);
    expect(s.rooms[0]).toMatchObject({ branch: null, checked: {}, check: null });
  });

  it("최대 개수면 더 담지 않는다", () => {
    let s = EMPTY_ROOMS;
    for (let i = 0; i < MAX_ROOMS + 1; i++) s = addRoom(s, draft, `r${i}`, "d");
    expect(s.rooms).toHaveLength(MAX_ROOMS);
  });

  it("고치기 · 지우기는 그 방만 바꾼다", () => {
    const s = addRoom(addRoom(EMPTY_ROOMS, draft, "a", "d"), draft, "b", "d");
    const u = updateRoom(s, "a", (r) => ({ ...r, branch: "direct" }));
    expect(u.rooms.find((r) => r.id === "a")!.branch).toBe("direct");
    expect(u.rooms.find((r) => r.id === "b")!.branch).toBeNull();
    expect(removeRoom(u, "a").rooms.map((r) => r.id)).toEqual(["b"]);
  });

  it("방 id는 저장값 검사를 통과하는 모양", () => {
    const id = newRoomId(1_700_000_000_000, () => 0.5);
    expect(id).toMatch(/^[\w-]{1,40}$/);
    expect(roomIdFrom(`?room=${id}`)).toBe(id);
  });
});

describe("방 주소 이어 붙이기", () => {
  it("?room= 을 읽고 붙인다, 이상한 값은 무시", () => {
    expect(roomIdFrom("?room=r1")).toBe("r1");
    expect(roomIdFrom("?id=r1")).toBe("r1");
    expect(roomIdFrom("?room=<script>")).toBeNull();
    expect(roomIdFrom("")).toBeNull();
    expect(withRoom("/steps/4", "r1")).toBe("/steps/4?room=r1");
    expect(withRoom("/check?x=1", "r1")).toBe("/check?x=1&room=r1");
    expect(withRoom("/steps", null)).toBe("/steps");
  });
});

describe("점검 요약에는 개인정보가 없다", () => {
  it("주의 샘플: 판정 · 이유 · 비율 · 다음 행동만 남고, 집주인 이름 · 등기부 주소는 없다", () => {
    const s = expected.samples.find((x) => x.expected.verdict === "caution")!;
    const out = runCheck(readFileSync(`samples/${s.file}`, "utf8"), {
      myDeposit: String(s.inputs.my_deposit / 10_000),
      priorDeposits: String(s.inputs.prior_deposits! / 10_000),
      marketPrice: String(s.inputs.market_price! / 10_000),
      contractParty: s.inputs.contract_party,
    }, "2026-11-13");
    if (!out.ok) throw new Error("샘플 점검 실패");
    const summary = summarize(out.result, buildActions(out.read, out.result), "2026-11-13");
    expect(summary).toMatchObject({ verdict: "caution", flags: s.expected.flags, ratio: s.expected.ratio, asOf: "2026-11-13" });
    const json = JSON.stringify(summary);
    expect(json).not.toContain(out.read.current_owner);
    expect(json).not.toContain(out.read.address);
    expect(json).not.toContain(s.inputs.contract_party);
    expect(summary.actions.todos.length + summary.actions.questions.length).toBeGreaterThan(0);
  });
});

describe("카드 · 상세 표시 계산", () => {
  const summary: CheckSummary = {
    verdict: "caution",
    flags: ["ratio_caution", "recent_transfer", "no_such_flag"],
    ratio: 76,
    asOf: "2026-11-17",
    actions: { questions: [], todos: [], clauses: [], parentSummary: "" },
  };

  it("없어진 이유 코드는 건너뛰고, 참고(info)는 '확인할 것'에 세지 않는다", () => {
    expect(flagViews(summary).map((f) => f.code)).toEqual(["ratio_caution", "recent_transfer"]);
    expect(toCheckCount(summary)).toBe(1);
    expect(checkLine(summary)).toBe("계약 전에 확인할 것이 1가지 있어요");
    expect(checkLine(null)).toMatch(/등기부등본을 올리면/);
    expect(checkLine({ ...summary, verdict: "safe", flags: [] })).toBe("큰 위험 신호는 보이지 않아요");
  });

  it("금액 줄: 전세면 월세를 빼고 쉼표를 붙인다", () => {
    expect(moneyLine({ deposit: 1000, rent: 50 })).toBe("보증금 1,000 · 월세 50");
    expect(moneyLine({ deposit: 20000, rent: null })).toBe("보증금 20,000");
  });

  it("진행 막대: 체크가 없으면 1단계가 지금, 해 봤어요면 1–3단계는 건너뜀", () => {
    const first = roomSteps(room(), "first", steps, branches);
    expect(first.segs[0]).toBe("current");
    expect(first.segs.slice(1).every((s) => s === "todo")).toBe(true);
    const exp = roomSteps(room(), "experienced", steps, branches);
    expect(exp.segs.slice(0, 3)).toEqual(["skipped", "skipped", "skipped"]);
    expect(exp.current?.no).toBe(4);
  });

  it("방의 진행 상황은 방의 갈래 · 체크와 사람의 모드를 합친 것", () => {
    const r = room({ branch: "direct", checked: { "s1.a": true } });
    expect(roomProgress(r, "first")).toEqual({ v: 1, mode: "first", branch: "direct", checked: { "s1.a": true } });
  });
});
