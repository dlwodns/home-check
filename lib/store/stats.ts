// F1 진행 계산: 단계마다 몇 개 했는지, 지금 할 차례는 몇 단계인지.
// 4단계(핵심 단계)에는 고른 갈래(중개사 · 직거래)의 체크리스트도 함께 센다.
import type { Branch as BranchContent, Step } from "@/lib/content";
import { itemKey, type Progress } from "./progress";

export interface StepStat {
  no: number;
  done: number;
  total: number;
  /** '해 봤어요'로 들어와 건너뛰어도 되는 단계(진행률 · 지금 할 차례에서 뺀다) */
  skipped: boolean;
}

export function branchFor(progress: Progress, branches: BranchContent[]): BranchContent | null {
  return branches.find((b) => b.id === progress.branch) ?? null;
}

export function stepStats(steps: Step[], branches: BranchContent[], progress: Progress) {
  const branch = branchFor(progress, branches);
  const perStep: StepStat[] = steps.map((s) => {
    const items = [
      ...s.items.map((i) => ({ key: itemKey(s.id, i.id), optional: Boolean(i.optional) })),
      ...(s.key && branch ? branch.items.map((i) => ({ key: itemKey(branch.id, i.id), optional: Boolean(i.optional) })) : []),
    ];
    // 해당 없을 수 있는 항목은 체크했을 때만 센다(안 해도 불리하지 않게)
    const counted = items.filter((i) => !i.optional || progress.checked[i.key]);
    const skipped = progress.mode === "experienced" && Boolean(s.experienced_skip);
    return { no: s.no, total: counted.length, done: counted.filter((i) => progress.checked[i.key]).length, skipped };
  });
  const active = perStep.filter((s) => !s.skipped);
  const total = active.reduce((n, s) => n + s.total, 0);
  const done = active.reduce((n, s) => n + s.done, 0);
  const current = active.find((s) => s.done < s.total)?.no ?? null; // null이면 모두 끝
  const finishedSteps = active.filter((s) => s.done === s.total).length;
  return { perStep, total, done, current, finishedSteps, activeSteps: active.length };
}
