// F0 계정 저장: 합치기(잃는 것 없이) · 입력 검사 · 오류 문장 · 로그인 직후 동기화.
import { describe, expect, it } from "vitest";
import { authErrorText, maskEmail, normalizeEmail, validateAuth } from "@/lib/cloud/auth";
import { mergeProgress, mergeRooms, parseCloudRow } from "@/lib/cloud/merge";
import { syncOnce, type SyncDb } from "@/lib/cloud/sync";
import { EMPTY_PROGRESS, type Progress, type ProgressStore } from "@/lib/store/progress";
import { EMPTY_ROOMS, MAX_ROOMS, type Room, type RoomsState, type RoomsStore } from "@/lib/store/rooms";

const room = (id: string, over: Partial<Room> = {}): Room => ({
  id,
  label: id,
  address: "서교동 1",
  deposit: 500,
  rent: 50,
  link: "",
  memo: "",
  region: null,
  branch: null,
  checked: {},
  notes: {},
  check: null,
  createdAt: "2026-11-17",
  ...over,
});
const rs = (...rooms: Room[]): RoomsState => ({ v: 1, rooms });

describe("이 기기 기록 + 계정 기록 합치기", () => {
  it("양쪽 방을 모두 남긴다 (이 기기 방이 앞)", () => {
    expect(mergeRooms(rs(room("a")), rs(room("b"))).rooms.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("같은 방이면 체크는 합치고, 비어 있는 점검 · 동네 · 갈래 · 링크는 다른 쪽으로 채운다", () => {
    const summary = { verdict: "caution" as const, flags: [], ratio: 76, asOf: "2026-11-17", actions: { questions: [], todos: [], clauses: [], parentSummary: "" }, unknowns: [] };
    const m = mergeRooms(
      rs(room("a", { checked: { "s1.a": true }, label: "이 기기 이름" })),
      rs(room("a", { checked: { "s4.b": true }, check: summary, region: { sgg: "11440", dong: "서교동" }, branch: "direct", link: "https://example.com/1", label: "계정 이름" })),
    ).rooms;
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ label: "이 기기 이름", checked: { "s1.a": true, "s4.b": true }, check: summary, region: { sgg: "11440", dong: "서교동" }, branch: "direct", link: "https://example.com/1" });
  });

  it("알아낸 것(메모)은 양쪽을 합치고, 같은 칸이면 이 기기 쪽을 남긴다", () => {
    const m = mergeRooms(rs(room("a", { notes: { "note.x": "이 기기", "note.y": "y" } })), rs(room("a", { notes: { "note.x": "계정", "note.z": "z" } }))).rooms[0];
    expect(m.notes).toEqual({ "note.x": "이 기기", "note.y": "y", "note.z": "z" });
  });

  it("합쳐도 최대 개수까지만", () => {
    const many = (p: string) => rs(...Array.from({ length: MAX_ROOMS }, (_, i) => room(`${p}${i}`)));
    expect(mergeRooms(many("a"), many("b")).rooms).toHaveLength(MAX_ROOMS);
  });

  it("진행 상황: 이 기기 선택 우선, 비어 있으면 계정 쪽, 체크는 합침", () => {
    const local: Progress = { v: 1, mode: null, branch: "broker", checked: { x: true } };
    const remote: Progress = { v: 1, mode: "experienced", branch: "direct", checked: { y: true } };
    expect(mergeProgress(local, remote)).toEqual({ v: 1, mode: "experienced", branch: "broker", checked: { x: true, y: true } });
  });

  it("계정에서 온 값도 이 기기 저장값과 같은 검사를 거친다 (위험한 링크 · 이상한 값 제거)", () => {
    const c = parseCloudRow({ rooms: { v: 1, rooms: [{ ...room("a"), link: "javascript:alert(1)" }, { id: "bad id" }] }, progress: { v: 1, mode: "hacker", checked: { "<x>": true } } });
    expect(c.rooms.rooms.map((r) => r.id)).toEqual(["a"]);
    expect(c.rooms.rooms[0].link).toBe("");
    expect(c.progress).toEqual({ v: 1, mode: null, branch: null, checked: {} });
    expect(parseCloudRow(null)).toEqual({ rooms: EMPTY_ROOMS, progress: EMPTY_PROGRESS });
  });
});

describe("로그인 직후 동기화", () => {
  const memStores = (rooms: RoomsState, progress: Progress) => {
    const s = { rooms, progress };
    const r: RoomsStore = { load: () => s.rooms, save: (v) => void (s.rooms = v) };
    const p: ProgressStore = { load: () => s.progress, save: (v) => void (s.progress = v) };
    return { s, stores: { rooms: r, progress: p } };
  };

  it("계정이 비어 있으면 이 기기 기록을 그대로 올린다", async () => {
    const pushed: unknown[] = [];
    const db: SyncDb = { pull: async () => null, push: async (x) => void pushed.push(x), clear: async () => {} };
    const { stores } = memStores(rs(room("a")), EMPTY_PROGRESS);
    await syncOnce(db, stores);
    expect(pushed).toEqual([{ rooms: rs(room("a")), progress: EMPTY_PROGRESS }]);
  });

  it("양쪽에 기록이 있으면 합쳐서 이 기기와 계정 모두에 저장한다", async () => {
    const pushed: { rooms: RoomsState }[] = [];
    const db: SyncDb = { pull: async () => ({ rooms: rs(room("b")), progress: EMPTY_PROGRESS }), push: async (x) => void pushed.push(x), clear: async () => {} };
    const { s, stores } = memStores(rs(room("a")), EMPTY_PROGRESS);
    await syncOnce(db, stores);
    expect(s.rooms.rooms.map((r) => r.id)).toEqual(["a", "b"]);
    expect(pushed[0].rooms.rooms.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("계정에서 못 받아 오면 이 기기 기록은 건드리지 않고 실패를 알린다", async () => {
    const db: SyncDb = { pull: async () => Promise.reject(new Error("pull_x")), push: async () => {}, clear: async () => {} };
    const { s, stores } = memStores(rs(room("a")), EMPTY_PROGRESS);
    await expect(syncOnce(db, stores)).rejects.toThrow("pull_x");
    expect(s.rooms.rooms.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("로그인 · 가입 입력 검사", () => {
  it("이메일 모양 · 비밀번호 길이 · 두 번 입력", () => {
    expect(validateAuth({ email: "", password: "" }, "login")).toEqual({ email: "이메일을 적어 주세요.", password: "비밀번호를 적어 주세요." });
    expect(validateAuth({ email: "abc", password: "x" }, "login").email).toMatch(/모양/);
    expect(validateAuth({ email: "a@b.co", password: "short" }, "login")).toEqual({});
    expect(validateAuth({ email: "a@b.co", password: "short", password2: "short" }, "signup").password).toMatch(/8자 이상/);
    expect(validateAuth({ email: "a@b.co", password: "longenough1", password2: "longenough2" }, "signup").password2).toMatch(/두 비밀번호가 달라요/);
    expect(validateAuth({ email: "a@b.co", password: "x".repeat(73), password2: "x".repeat(73) }, "signup").password).toMatch(/72자/);
    expect(validateAuth({ email: " A@B.co ", password: "longenough1", password2: "longenough1" }, "signup")).toEqual({});
  });

  it("이메일은 앞뒤 빈칸을 지우고 소문자로", () => {
    expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com");
  });

  it("오류는 쉬운 말로, 모르는 오류는 원문을 보여 주지 않는다", () => {
    expect(authErrorText({ message: "Invalid login credentials" })).toBe("이메일 또는 비밀번호가 맞지 않아요.");
    expect(authErrorText({ code: "user_already_exists", message: "User already registered" })).toMatch(/이미 가입한/);
    expect(authErrorText({ code: "weak_password", message: "" })).toMatch(/너무 쉬워요/);
    expect(authErrorText({ status: 429, message: "x" })).toMatch(/1분쯤 뒤/);
    expect(authErrorText({ message: "secret internal db error 42P01" })).toBe("잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.");
    expect(authErrorText(null)).toBe("");
  });

  it("화면에는 이메일 가운데를 가린다", () => {
    expect(maskEmail("dlwodns@gmail.com")).toBe("dl*****@gmail.com");
    expect(maskEmail("ab@x.io")).toBe("ab*@x.io");
    expect(maskEmail("nope")).toBe("");
  });
});
