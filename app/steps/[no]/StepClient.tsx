"use client";
// 단계 하나: 요약 · 할 일 체크리스트(용어 밑줄 · 왜 중요해요? · 근거) · 4단계엔 중개사/직거래 체크리스트.
import Link from "next/link";
import type { Branch, Step } from "@/lib/content";
import { splitAll } from "@/lib/content/terms";
import Checklist from "../../ui/Checklist";
import TermText from "../../ui/TermText";
import { useProgress } from "../../ui/useProgress";

const BRANCH_TITLE = { broker: "중개사를 통해서라면 내가 직접 확인할 것", direct: "직거래라서 꼭 할 것" } as const;

export default function StepClient({ step, total, branches }: { step: Step; total: number; branches: Branch[] }) {
  const { progress, update } = useProgress();
  const branch = step.key ? branches.find((b) => b.id === progress.branch) : undefined;

  // 이 화면의 문장들을 한 번에 나눠, 같은 용어는 처음 나올 때만 밑줄을 긋는다
  const texts = [step.summary, ...step.items.flatMap((i) => [i.text, i.why]), ...(branch?.items ?? []).flatMap((i) => [i.text, i.why])];
  const segs = splitAll(texts);
  const summarySegs = segs[0];
  const pair = (from: number, n: number) => Array.from({ length: n }, (_, k) => [segs[from + 2 * k], segs[from + 2 * k + 1]]);
  const stepSegs = pair(1, step.items.length);
  const branchSegs = pair(1 + 2 * step.items.length, branch?.items.length ?? 0);

  const toggle = (key: string, value: boolean) =>
    update((p) => {
      const checked = { ...p.checked };
      if (value) checked[key] = true;
      else delete checked[key];
      return { ...p, checked };
    });

  return (
    <main className="container check">
      <nav className="topbar">
        <Link href="/steps" className="back" aria-label="내 계약 진행으로">
          ←
        </Link>
        <span>
          {step.no}단계 / {total}
        </span>
      </nav>
      <h1 className="title">{step.title}</h1>
      <p className="muted">
        <TermText segments={summarySegs} />
      </p>

      <Checklist groupId={step.id} items={step.items} checked={progress.checked} onToggle={toggle} segments={stepSegs} />

      {step.key && branch && (
        <section>
          <h2>{BRANCH_TITLE[branch.id]}</h2>
          <Checklist groupId={branch.id} items={branch.items} checked={progress.checked} onToggle={toggle} segments={branchSegs} />
        </section>
      )}
      {step.key && !branch && (
        <p className="card small">
          {progress.branch === "none" ? "방을 찾으면" : "방을 어디서 찾았는지 고르면"} 중개사 · 직거래 맞춤 체크리스트가 여기에 붙어요.{" "}
          <Link href="/where">고르러 가기</Link>
        </p>
      )}

      <nav className="step-nav">
        {step.no > 1 ? <Link href={`/steps/${step.no - 1}`}>← 이전 단계</Link> : <span />}
        {step.no < total ? <Link href={`/steps/${step.no + 1}`}>다음 단계 →</Link> : <Link href="/steps">진행 보기</Link>}
      </nav>
    </main>
  );
}
