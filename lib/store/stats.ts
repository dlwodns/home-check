// F1 진행 계산: 단계마다 몇 개 했는지, 지금 할 차례는 몇 단계인지.
// 4단계(핵심 단계)에는 고른 갈래(중개사 · 직거래)의 체크리스트도 함께 센다.
import type { Branch as BranchContent, Step } from "@/lib/content";
import { itemKey, type Progress } from "./progress";

export interface StepStat {
  no: number;
  done: number;
  total: number;
}

export function branchFor(progress: Progress, branches: BranchContent[]): BranchContent | null {
  return branches.find((b) => b.id === progress.branch) ?? null;
}

export function stepStats(steps: Step[], branches: BranchContent[], progress: Progress) {
  const branch = branchFor(progress, branches);
  const perStep: StepStat[] = steps.map((s) => {
    const keys = s.items.map((i) => itemKey(s.id, i.id));
    if (s.key && branch) keys.push(...branch.items.map((i) => itemKey(branch.id, i.id)));
    return { no: s.no, total: keys.length, done: keys.filter((k) => progress.checked[k]).length };
  });
  const total = perStep.reduce((n, s) => n + s.total, 0);
  const done = perStep.reduce((n, s) => n + s.done, 0);
  const current = perStep.find((s) => s.done < s.total)?.no ?? null; // null이면 모두 끝
  const finishedSteps = perStep.filter((s) => s.done === s.total).length;
  return { perStep, total, done, current, finishedSteps };
}
