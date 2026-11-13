"use client";
// 내 계약 진행: 6단계와 단계별 진행, "지금 할 차례" 강조.
import Link from "next/link";
import type { Branch, Step } from "@/lib/content";
import { branchFor, stepStats } from "@/lib/store/stats";
import { useProgress } from "../ui/useProgress";

const BRANCH_LABEL = { broker: "중개사를 통해서", direct: "직거래", none: "아직 방을 못 찾음" } as const;

export default function StepsClient({ steps, branches }: { steps: Step[]; branches: Branch[] }) {
  const { progress, loaded } = useProgress();
  const stats = stepStats(steps, branches, progress);
  const branch = branchFor(progress, branches);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <main className="container check">
      <nav className="topbar">
        <Link href="/" className="back" aria-label="처음 화면으로">
          ←
        </Link>
        <span>내 계약 진행</span>
      </nav>

      <div className="card">
        <p className="small">
          {loaded && progress.branch ? `방: ${BRANCH_LABEL[progress.branch]}` : "방을 어디서 찾았는지 아직 안 골랐어요"} ·{" "}
          <Link href="/where">{progress.branch ? "바꾸기" : "고르기"}</Link>
        </p>
        <p className="small muted" aria-live="polite">
          6단계 중 {stats.finishedSteps}단계 완료 · 할 일 {stats.done}/{stats.total}
        </p>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="전체 진행">
          <div className="bar-fill bar-safe" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="steps">
        {steps.map((s, i) => {
          const st = stats.perStep[i];
          const isCurrent = stats.current === s.no;
          const done = st.done === st.total;
          return (
            <li key={s.id}>
              <Link
                href={`/steps/${s.no}`}
                className={`step${isCurrent ? " step-current" : ""}${done ? " step-done" : ""}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="step-no" aria-hidden="true">
                  {done ? "✓" : s.no}
                </span>
                <span className="step-body">
                  {isCurrent && <span className="step-tag">지금 할 차례</span>}
                  <strong>
                    {s.no}. {s.title}
                  </strong>
                  <span className="small muted">{s.summary}</span>
                </span>
                <span className="small">
                  {st.done}/{st.total}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {stats.current === null && (
        <p className="card small">모든 단계를 마쳤어요. 입주 후 전입신고 · 확정일자를 잊지 마세요!</p>
      )}
      {!branch && progress.branch !== "none" && (
        <p className="small muted">방을 어디서 찾았는지 고르면 4단계에 맞춤 체크리스트가 붙어요.</p>
      )}
    </main>
  );
}
