// F1 진행 상황 저장. 지금은 이 브라우저(localStorage)에만 저장하고, 11/18 로그인 후에는
// 같은 모양(ProgressStore)으로 Supabase 저장소를 갈아 끼운다. 화면 코드는 바뀌지 않는다.

export type Mode = "first" | "experienced";
export type Branch = "broker" | "direct" | "none";

export interface Progress {
  v: 1;
  mode: Mode | null;
  branch: Branch | null;
  /** "단계id.항목id" 또는 "갈래id.항목id" → 체크 여부 */
  checked: Record<string, boolean>;
}

export const EMPTY_PROGRESS: Progress = { v: 1, mode: null, branch: null, checked: {} };

export interface ProgressStore {
  load(): Progress;
  save(p: Progress): void;
}

const KEY = "homecheck.progress.v1";

/** 저장된 값이 깨져 있거나 모양이 다르면 버리고 빈 진행 상황으로 시작한다. */
export function parseProgress(raw: string | null): Progress {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const d = JSON.parse(raw) as Partial<Progress>;
    if (d?.v !== 1) return EMPTY_PROGRESS;
    const mode = d.mode === "first" || d.mode === "experienced" ? d.mode : null;
    const branch = d.branch === "broker" || d.branch === "direct" || d.branch === "none" ? d.branch : null;
    const checked: Record<string, boolean> = {};
    if (d.checked && typeof d.checked === "object") {
      for (const [k, v] of Object.entries(d.checked)) if (v === true && /^[\w.-]{1,80}$/.test(k)) checked[k] = true;
    }
    return { v: 1, mode, branch, checked };
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** 브라우저 저장소. 사생활 보호 모드 등에서 저장이 막혀도 앱이 멈추지 않게 오류를 삼킨다. */
export function localProgressStore(storage: Pick<Storage, "getItem" | "setItem"> | null): ProgressStore {
  return {
    load() {
      try {
        return parseProgress(storage?.getItem(KEY) ?? null);
      } catch {
        return EMPTY_PROGRESS;
      }
    },
    save(p) {
      try {
        storage?.setItem(KEY, JSON.stringify(p));
      } catch {
        /* 저장 공간이 없거나 막혀 있으면 이번 화면에서만 기억한다 */
      }
    },
  };
}

export const itemKey = (groupId: string, itemId: string) => `${groupId}.${itemId}`;
