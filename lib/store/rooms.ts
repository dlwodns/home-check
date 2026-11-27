// F4 내 후보 방. 방마다 주소 · 금액 · 메모와 그 방의 진행 상황(갈래 · 체크), 점검 결과 요약을 가진다.
// 지금은 이 브라우저(localStorage)에 저장하고, 로그인 후에는 같은 모양(RoomsStore)으로 계정 저장소를 갈아 끼운다.
// 등기부등본 원문 · 집주인 이름은 저장하지 않는다. 점검 요약에는 판정 · 이유 코드 · 비율 · 다음 행동 문장만 담는다.
import { isDate } from "@/lib/plan";
import { notifySaved } from "./events";
import type { NextActions } from "@/lib/registry/actions";
import { parseManwon } from "@/lib/registry/check";
import type { CheckResult } from "@/lib/registry/types";
import { UNKNOWN_IDS } from "@/lib/registry/unknowns";

const DEFAULT_UNKNOWNS = ["tax", "identity", "building", "later_changes"];
import type { Branch, Mode, Progress } from "./progress";

export type Verdict = CheckResult["verdict"];

export interface CheckSummary {
  verdict: Verdict;
  /** 판정 이유 코드 (data/judge.json의 flags) */
  flags: string[];
  ratio: number | null;
  /** 점검한 날 YYYY-MM-DD */
  asOf: string;
  actions: NextActions;
  /** 등기부로는 알 수 없는 것 (lib/registry/unknowns의 id) */
  unknowns: string[];
  /** 사용자가 직접 고친 칸 (예: "집주인", "근저당"). 없으면 빈 배열 */
  edited?: string[];
}

/** 법정동: 시군구 코드 5자리 + 동 이름. 동네 시세(F6)를 찾는 데만 쓴다 */
export interface RoomRegion {
  sgg: string;
  dong: string;
}

export interface Room {
  id: string;
  /** 카드 제목: 메모가 있으면 메모, 없으면 주소 */
  label: string;
  address: string;
  /** 만 원 단위 */
  deposit: number;
  /** 만 원 단위, 전세면 null */
  rent: number | null;
  /** 매물 링크 (http · https만). 다시 열어 보는 바로가기로만 쓴다 */
  link: string;
  memo: string;
  region: RoomRegion | null;
  branch: Branch | null;
  checked: Record<string, boolean>;
  /** 할 일 · 질문마다 알아낸 것(예: "앞선 보증금 합계 2억이라고 들음"). 키는 noteKey */
  notes: Record<string, string>;
  /** 단계마다 정한 '그날'(단계 id → YYYY-MM-DD). 예: visit → 집 보러 가는 날 */
  dates: Record<string, string>;
  check: CheckSummary | null;
  createdAt: string;
}

export interface RoomsState {
  v: 1;
  rooms: Room[];
}

export const EMPTY_ROOMS: RoomsState = { v: 1, rooms: [] };
export const MAX_ROOMS = 20;
const KEY = "homecheck.rooms.v1";

const LIMIT = { address: 100, memo: 60, link: 500, label: 30, text: 400, list: 20, note: 300 };
const VERDICTS: Verdict[] = ["safe", "caution", "danger"];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e9 ? v : null);
const strList = (v: unknown, max = LIMIT.text) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, LIMIT.list).map((x) => x.slice(0, max)) : [];

/** http · https 주소만 링크로 인정한다 (javascript: 같은 주소가 화면에서 실행되지 않게). */
export function safeLink(raw: string): string {
  const s = raw.trim();
  if (!s || s.length > LIMIT.link) return "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

/** 모양만 검사한다(표에 있는지는 서버가 다시 확인). 큰 지역 표를 모든 화면에 싣지 않으려고 */
export function parseRegion(v: unknown): RoomRegion | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  const sgg = typeof d.sgg === "string" ? d.sgg : "";
  const dong = typeof d.dong === "string" ? d.dong.trim() : "";
  return /^\d{5}$/.test(sgg) && /^[가-힣0-9.·]{1,20}$/.test(dong) ? { sgg, dong } : null;
}

function parseSummary(v: unknown): CheckSummary | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  if (!VERDICTS.includes(d.verdict as Verdict)) return null;
  const a = (d.actions ?? {}) as Record<string, unknown>;
  const clauses = Array.isArray(a.clauses)
    ? a.clauses.slice(0, LIMIT.list).flatMap((c) => {
        if (!c || typeof c !== "object") return [];
        const x = c as Record<string, unknown>;
        const sources = Array.isArray(x.sources)
          ? x.sources.flatMap((s) =>
              s && typeof s === "object" ? [{ id: str((s as { id?: unknown }).id, 10), title: str((s as { title?: unknown }).title, 100) }] : [],
            )
          : [];
        return [{ id: str(x.id, 40), title: str(x.title, 100), text: str(x.text, LIMIT.text), basis: str(x.basis, LIMIT.text), sources }];
      })
    : [];
  return {
    verdict: d.verdict as Verdict,
    flags: strList(d.flags, 60).filter((f) => /^[a-z_]+$/.test(f)),
    ratio: num(d.ratio),
    asOf: /^\d{4}-\d{2}-\d{2}$/.test(String(d.asOf)) ? String(d.asOf) : "",
    // 예전에 저장한 요약에는 없으므로, 그때는 언제나 해당하는 것만 넣는다
    edited: strList(d.edited, 10).filter((x) => x === "집주인" || x === "근저당"),
    unknowns: Array.isArray(d.unknowns) ? strList(d.unknowns, 30).filter((u) => UNKNOWN_IDS.includes(u)) : [...DEFAULT_UNKNOWNS],
    actions: {
      questions: strList(a.questions),
      todos: strList(a.todos),
      clauses,
      parentSummary: str(a.parentSummary, 1000),
    },
  };
}

function parseRoom(v: unknown): Room | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  const id = str(d.id, 40);
  const address = str(d.address, LIMIT.address);
  const deposit = num(d.deposit);
  if (!/^[\w-]{1,40}$/.test(id) || !address || deposit === null) return null;
  const memo = str(d.memo, LIMIT.memo);
  const branch = d.branch === "broker" || d.branch === "direct" || d.branch === "none" ? d.branch : null;
  const checked: Record<string, boolean> = {};
  if (d.checked && typeof d.checked === "object") {
    for (const [k, val] of Object.entries(d.checked)) if (val === true && /^[\w.-]{1,80}$/.test(k)) checked[k] = true;
  }
  const notes: Record<string, string> = {};
  if (d.notes && typeof d.notes === "object") {
    for (const [k, val] of Object.entries(d.notes).slice(0, 40)) {
      const t = str(val, LIMIT.note);
      if (t && /^[\w.-]{1,80}$/.test(k)) notes[k] = t;
    }
  }
  const dates: Record<string, string> = {};
  if (d.dates && typeof d.dates === "object") {
    for (const [k, val] of Object.entries(d.dates).slice(0, 10)) if (/^[a-z_]{1,20}$/.test(k) && isDate(val)) dates[k] = val;
  }
  return {
    id,
    label: str(d.label, LIMIT.label) || (memo || address).slice(0, LIMIT.label),
    address,
    deposit,
    rent: num(d.rent),
    link: safeLink(typeof d.link === "string" ? d.link : ""),
    memo,
    region: parseRegion(d.region),
    branch,
    checked,
    notes,
    dates,
    check: parseSummary(d.check),
    createdAt: str(d.createdAt, 30),
  };
}

/** 저장된 값이 깨져 있으면 그 방만 버린다. 모양이 아예 다르면 빈 목록으로 시작한다. */
export function parseRooms(raw: string | null): RoomsState {
  if (!raw) return EMPTY_ROOMS;
  try {
    const d = JSON.parse(raw) as Partial<RoomsState>;
    if (d?.v !== 1 || !Array.isArray(d.rooms)) return EMPTY_ROOMS;
    const seen = new Set<string>();
    const rooms = d.rooms
      .map(parseRoom)
      .filter((r): r is Room => r !== null && !seen.has(r.id) && Boolean(seen.add(r.id)))
      .slice(0, MAX_ROOMS);
    return { v: 1, rooms };
  } catch {
    return EMPTY_ROOMS;
  }
}

export interface RoomsStore {
  load(): RoomsState;
  save(s: RoomsState): void;
}

export function localRoomsStore(storage: Pick<Storage, "getItem" | "setItem"> | null): RoomsStore {
  return {
    load() {
      try {
        return parseRooms(storage?.getItem(KEY) ?? null);
      } catch {
        return EMPTY_ROOMS;
      }
    },
    save(s) {
      try {
        storage?.setItem(KEY, JSON.stringify(s));
        notifySaved();
      } catch {
        /* 저장이 막혀 있으면 이번 화면에서만 기억한다 */
      }
    },
  };
}

export interface RoomInput {
  address: string;
  deposit: string;
  rent: string;
  /** 매물 링크 · 메모를 한 칸에 받는다. 안의 http(s) 주소는 링크로, 나머지는 메모로 나눈다 */
  note: string;
  /** 주소에서 찾아 고른 법정동 (못 찾았으면 null — 시세만 빠지고 저장은 된다) */
  region?: RoomRegion | null;
}

export type RoomDraft = Pick<Room, "label" | "address" | "deposit" | "rent" | "link" | "memo" | "region">;

/** 후보 방 추가 칸을 검사해 저장할 값으로 바꾼다. 틀린 칸은 고칠 말을 돌려준다. */
export function validateRoomInput(input: RoomInput): { ok: true; draft: RoomDraft } | { ok: false; errors: Partial<Record<keyof RoomInput, string>> } {
  const errors: Partial<Record<keyof RoomInput, string>> = {};
  const address = input.address.trim().replace(/\s+/g, " ");
  if (address.length < 2) errors.address = "주소를 적어 주세요. 예: OO동 123-4";
  else if (address.length > LIMIT.address) errors.address = "주소가 너무 길어요.";

  const dep = parseManwon(input.deposit, "보증금");
  if (!dep.ok) errors.deposit = dep.message;
  else if (dep.won === null) errors.deposit = "보증금을 적어 주세요. 예: 10,000,000 (원)";

  const rent = parseManwon(input.rent, "월세");
  if (!rent.ok) errors.rent = rent.message;

  const urlMatch = /https?:\/\/\S+/i.exec(input.note);
  const link = urlMatch ? safeLink(urlMatch[0]) : "";
  if (urlMatch && !link) errors.note = "링크 주소를 확인해 주세요.";
  const memo = input.note.replace(urlMatch?.[0] ?? "", " ").trim().replace(/\s+/g, " ");
  if (memo.length > LIMIT.memo) errors.note = `메모는 ${LIMIT.memo}자까지 적을 수 있어요.`;

  if (Object.keys(errors).length || !dep.ok || dep.won === null || !rent.ok) return { ok: false, errors };
  return {
    ok: true,
    draft: {
      label: (memo || address).slice(0, LIMIT.label),
      address,
      deposit: dep.won / 10_000,
      rent: rent.won === null ? null : rent.won / 10_000,
      link,
      memo,
      region: parseRegion(input.region ?? null),
    },
  };
}

export function newRoomId(now = Date.now(), rand = Math.random): string {
  return `r${now.toString(36)}${Math.floor(rand() * 1e8).toString(36)}`;
}

export function addRoom(state: RoomsState, draft: RoomDraft, id: string, createdAt: string): RoomsState {
  if (state.rooms.length >= MAX_ROOMS) return state;
  const room: Room = { id, ...draft, branch: null, checked: {}, notes: {}, dates: {}, check: null, createdAt };
  return { v: 1, rooms: [room, ...state.rooms] };
}

export function updateRoom(state: RoomsState, id: string, change: (r: Room) => Room): RoomsState {
  return { v: 1, rooms: state.rooms.map((r) => (r.id === id ? change(r) : r)) };
}

export function removeRoom(state: RoomsState, id: string): RoomsState {
  return { v: 1, rooms: state.rooms.filter((r) => r.id !== id) };
}

/** 방 하나의 진행 상황을 단계 화면이 쓰는 모양으로. 처음이에요/해 봤어요(mode)는 사람 기준이라 전체 설정을 쓴다. */
export function roomProgress(room: Room, mode: Mode | null): Progress {
  return { v: 1, mode, branch: room.branch, checked: room.checked };
}

/** 점검 결과에서 방에 남길 요약만 뽑는다 (등기부 원문 · 집주인 이름은 넣지 않는다). */
export function summarize(result: CheckResult, actions: NextActions, asOf: string, unknowns: string[] = [...DEFAULT_UNKNOWNS]): CheckSummary {
  return { verdict: result.verdict, flags: [...result.flags], ratio: result.ratio, asOf, actions, unknowns };
}

/** 주소 쿼리 ?room=… 에서 방 id를 읽는다. 모양이 이상하면 null. */
export function roomIdFrom(search: string): string | null {
  const id = new URLSearchParams(search).get("room") ?? new URLSearchParams(search).get("id");
  return id && /^[\w-]{1,40}$/.test(id) ? id : null;
}

/** 방 안에서 이동할 때 ?room= 을 이어 붙인다. */
export function withRoom(href: string, roomId: string | null): string {
  return roomId ? `${href}${href.includes("?") ? "&" : "?"}room=${encodeURIComponent(roomId)}` : href;
}

export const roomHref = (id: string) => `/room?id=${encodeURIComponent(id)}`;
