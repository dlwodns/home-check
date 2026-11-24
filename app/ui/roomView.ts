// 후보 방 카드 · 상세에서 같이 쓰는 표시용 계산 (화면 없이 테스트할 수 있게 분리).
import rules from "@/data/judge.json";
import type { Branch as BranchContent, Step } from "@/lib/content";
import { formatWon, toFlagView, type FlagView } from "@/lib/registry/check";
import { headline } from "@/lib/registry/goodPoints";
import type { FlagCode } from "@/lib/registry/types";
import type { Mode } from "@/lib/store/progress";
import { roomProgress, type CheckSummary, type Room } from "@/lib/store/rooms";
import { stepStats } from "@/lib/store/stats";

export const VERDICT_TEXT = {
  safe: { label: "안전", line: "확인한 범위 안에서는 큰 위험 신호가 없어요" },
  caution: { label: "주의", line: "계약 전에 확인할 것이 있어요" },
  danger: { label: "위험", line: "이대로 계약하면 위험할 수 있어요" },
} as const;

/** 저장된 이유 코드 중 지금 규칙에 있는 것만 화면용으로 바꾼다 (규칙이 바뀌어 없어진 코드는 건너뜀) */
export function flagViews(summary: CheckSummary): FlagView[] {
  return summary.flags.filter((c): c is FlagCode => c in rules.flags).map(toFlagView);
}

/** 위험 · 주의 이유 개수 (참고는 세지 않음) */
export function toCheckCount(summary: CheckSummary): number {
  return flagViews(summary).filter((f) => f.level !== "info").length;
}

export function checkLine(summary: CheckSummary | null): string {
  if (!summary) return "등기부등본을 올리면 바로 알려 드려요";
  const n = toCheckCount(summary);
  if (n === 0) return VERDICT_TEXT[summary.verdict].line;
  return headline(summary.verdict, n);
}

export type Seg = "done" | "current" | "todo" | "skipped";

/** 방 카드의 6칸 진행 막대 + 지금 몇 단계인지 */
export function roomSteps(room: Room, mode: Mode | null, steps: Step[], branches: BranchContent[]) {
  const stats = stepStats(steps, branches, roomProgress(room, mode), { inRoom: true });
  const segs: Seg[] = stats.perStep.map((s) =>
    s.skipped ? "skipped" : s.no === stats.current ? "current" : s.done === s.total ? "done" : "todo",
  );
  const current = steps.find((s) => s.no === stats.current) ?? null;
  return { segs, current, stats };
}

export const manwon = (n: number) => n.toLocaleString("ko-KR");

/** 방 금액 한 줄. 저장은 만 원 단위지만 단위를 붙여 보여 준다(입력 칸이 원 단위라 숫자만 보이면 헷갈림) */
export function moneyLine(room: Pick<Room, "deposit" | "rent">): string {
  const won = (manwonValue: number) => formatWon(manwonValue * 10_000);
  return room.rent === null || room.rent === 0 ? `보증금 ${won(room.deposit)}` : `보증금 ${won(room.deposit)} · 월세 ${won(room.rent)}`;
}

/** 이 방에서 지금 할 일 하나 (방 카드 · '이어하기' 카드에 씀) */
export function nextAction(room: Room, mode: Mode | null, steps: Step[], branches: BranchContent[]): { text: string; href: string } {
  const q = `room=${encodeURIComponent(room.id)}`;
  if (!room.check) return { text: "등기부등본 올려서 점검하기", href: `/check?${q}` };
  const { current } = roomSteps(room, mode, steps, branches);
  if (current) return { text: `${current.no}단계 · ${current.title}`, href: `/steps/${current.no}?${q}` };
  return { text: "계약 완료 · 보증금 지키기까지 마쳤어요", href: `/room?id=${encodeURIComponent(room.id)}` };
}

const LAST_KEY = "homecheck.lastRoom.v1";
/** 마지막으로 본 방 (홈의 '이어하기'에 씀) */
export function rememberLastRoom(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* 막혀 있으면 첫 번째 방으로 대신 */
  }
}
export function lastRoomId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

const SESSION_KEY = "homecheck.session.v1";
/** 이번에 새로 들어온 것인지 (탭 · 앱을 새로 열 때만 true, 한 번 물어보면 기억) */
export function freshVisit(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
