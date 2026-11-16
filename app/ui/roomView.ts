// 후보 방 카드 · 상세에서 같이 쓰는 표시용 계산 (화면 없이 테스트할 수 있게 분리).
import rules from "@/data/judge.json";
import type { Branch as BranchContent, Step } from "@/lib/content";
import { toFlagView, type FlagView } from "@/lib/registry/check";
import type { FlagCode } from "@/lib/registry/types";
import type { Mode } from "@/lib/store/progress";
import { roomProgress, type CheckSummary, type Room } from "@/lib/store/rooms";
import { stepStats } from "@/lib/store/stats";

export const VERDICT_TEXT = {
  safe: { label: "안전", line: "큰 위험 신호는 보이지 않아요" },
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
  return `계약 전에 확인할 것이 ${n}가지 있어요`;
}

export type Seg = "done" | "current" | "todo" | "skipped";

/** 방 카드의 6칸 진행 막대 + 지금 몇 단계인지 */
export function roomSteps(room: Room, mode: Mode | null, steps: Step[], branches: BranchContent[]) {
  const stats = stepStats(steps, branches, roomProgress(room, mode));
  const segs: Seg[] = stats.perStep.map((s) =>
    s.skipped ? "skipped" : s.no === stats.current ? "current" : s.done === s.total ? "done" : "todo",
  );
  const current = steps.find((s) => s.no === stats.current) ?? null;
  return { segs, current, stats };
}

export const manwon = (n: number) => n.toLocaleString("ko-KR");

export function moneyLine(room: Pick<Room, "deposit" | "rent">): string {
  return room.rent === null || room.rent === 0
    ? `보증금 ${manwon(room.deposit)}`
    : `보증금 ${manwon(room.deposit)} · 월세 ${manwon(room.rent)}`;
}
