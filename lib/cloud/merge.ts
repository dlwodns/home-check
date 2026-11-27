// 로그인했을 때 이 기기 기록과 계정 기록을 합친다. 원칙: 어느 쪽에 있던 것도 잃지 않는다.
// - 후보 방: id로 합침. 같은 방이면 이 기기 쪽을 기본으로, 체크는 양쪽을 합치고, 점검 요약 · 동네 · 갈래는 비어 있는 쪽을 채운다
// - 진행 상황: 처음이에요/해 봤어요 · 갈래는 이 기기 쪽 우선(없으면 계정 쪽), 체크는 합친다
import { EMPTY_PROGRESS, parseProgress, type Progress } from "@/lib/store/progress";
import { EMPTY_ROOMS, MAX_ROOMS, parseRooms, type Room, type RoomsState } from "@/lib/store/rooms";

const union = (a: Record<string, boolean>, b: Record<string, boolean>) => ({ ...b, ...a });

function mergeRoom(local: Room, remote: Room): Room {
  return {
    ...local,
    checked: union(local.checked, remote.checked),
    notes: { ...remote.notes, ...local.notes },
    check: local.check ?? remote.check,
    region: local.region ?? remote.region,
    branch: local.branch ?? remote.branch,
    link: local.link || remote.link,
  };
}

export function mergeRooms(local: RoomsState, remote: RoomsState): RoomsState {
  const remoteById = new Map(remote.rooms.map((r) => [r.id, r]));
  const merged = local.rooms.map((r) => (remoteById.has(r.id) ? mergeRoom(r, remoteById.get(r.id)!) : r));
  const localIds = new Set(local.rooms.map((r) => r.id));
  for (const r of remote.rooms) if (!localIds.has(r.id)) merged.push(r);
  return { v: 1, rooms: merged.slice(0, MAX_ROOMS) };
}

export function mergeProgress(local: Progress, remote: Progress): Progress {
  return {
    v: 1,
    mode: local.mode ?? remote.mode,
    branch: local.branch ?? remote.branch,
    checked: union(local.checked, remote.checked),
  };
}

export interface CloudState {
  rooms: RoomsState;
  progress: Progress;
}

/** 계정에서 받은 값은 믿지 않고 이 기기 저장값과 똑같은 검사를 거친다 */
export function parseCloudRow(row: { rooms?: unknown; progress?: unknown } | null): CloudState {
  if (!row) return { rooms: EMPTY_ROOMS, progress: EMPTY_PROGRESS };
  return {
    rooms: parseRooms(JSON.stringify(row.rooms ?? null)),
    progress: parseProgress(JSON.stringify(row.progress ?? null)),
  };
}

export function mergeState(local: CloudState, remote: CloudState): CloudState {
  return { rooms: mergeRooms(local.rooms, remote.rooms), progress: mergeProgress(local.progress, remote.progress) };
}
