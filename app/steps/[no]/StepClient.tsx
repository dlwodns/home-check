"use client";
// 단계 하나 = 한 길의 한 칸(11/28). 맨 위 ←는 방 안이면 언제나 방(길)으로, 맨 아래는 '← 이전 · 다음: ○○ →'.
// 그 단계에서 할 일은 이 화면 안에 다 있다: 3단계 동네 시세, 4단계 등기부 점검 · 계약 방법(갈래 질문) · 집주인에게 물을 것 · 받을 서류,
// 5단계 계약하는 날 챙길 것 · 상담. 다른 메뉴로 나가지 않아도 되게(NN/g: 단계마다 스스로 완결, 듀오링고: 따로 있던 기능을 길 안으로).
import Link from "next/link";
import type { Branch, Step } from "@/lib/content";
import { splitAll } from "@/lib/content/terms";
import { withBranch } from "@/lib/registry/actions";
import { headline } from "@/lib/registry/goodPoints";
import type { Branch as BranchId } from "@/lib/store/progress";
import { roomHref, updateRoom, withRoom } from "@/lib/store/rooms";
import { stepStats } from "@/lib/store/stats";
import { useEffect, useState } from "react";
import Checklist from "../../ui/Checklist";
import TermText from "../../ui/TermText";
import TermHint from "../../ui/TermHint";
import PriorDepositGuide from "../../ui/PriorDepositGuide";
import HelpCard from "../../ui/HelpCard";
import TrafficLight from "../../ui/TrafficLight";
import { roomsStore, useProgress } from "../../ui/useProgress";
import { toast } from "../../ui/Toast";
import { toCheckCount } from "../../ui/roomView";
import HomeLink from "../../ui/HomeLink";
import ActionBar from "../../ui/ActionBar";
import { STEP_ART } from "../../ui/FlowPreview";
import NextActions, { RequestCard } from "../../check/NextActions";
import RentCard from "../../room/RentCard";
import { DocGroup, docKey, visibleDocs } from "../../docs/DocsClient";
import BackButton from "../../ui/Back";

const BRANCH_TITLE = { broker: "중개사를 통해서라면 내가 직접 확인할 것", direct: "직거래라서 꼭 할 것" } as const;
const BRANCH_OPTIONS: { id: BranchId; title: string }[] = [
  { id: "broker", title: "공인중개사를 통해서" },
  { id: "direct", title: "집주인과 직접 (직거래)" },
];
/** 이 단계 안에 넣는 서류 묶음 (data/documents.json의 groups). 계약 전 '뗄 서류'는 4단계 할 일과 같아서 넣지 않는다 */
const DOC_GROUP: Record<string, string> = { documents: "receive", contract: "day" };
/** 체크 안내: 단계마다 그 일에 맞는 말로(11/28). 다 체크하면 길에서 다음 단계로 넘어간다 */
const CHECK_HINT: Record<string, string> = {
  prepare: "정한 것부터",
  search: "알아본 것부터",
  visit: "현장에서 확인한 것부터",
  documents: "확인한 것부터",
  contract: "챙긴 것부터",
  move_in: "마친 것부터",
};

export default function StepClient({ step, total, branches, steps }: { step: Step; total: number; branches: Branch[]; steps: Step[] }) {
  const { progress, update, room, roomId } = useProgress();
  const r = (href: string) => withRoom(href, roomId);
  const branch = step.key ? branches.find((b) => b.id === progress.branch) : undefined;

  // 알아낸 것(질문 · 할 일 메모): 방에 저장
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (room) setNotes(room.notes ?? {});
  }, [room]);
  const saveNote = (key: string, value: string) => {
    if (!room) return;
    const store = roomsStore();
    store.save(
      updateRoom(store.load(), room.id, (x) => {
        const n = { ...(x.notes ?? {}) };
        if (value) n[key] = value;
        else delete n[key];
        return { ...x, notes: n };
      }),
    );
    toast(value ? "알아낸 것을 저장했어요" : "지웠어요");
    setNotes((n) => {
      const m = { ...n };
      if (value) m[key] = value;
      else delete m[key];
      return m;
    });
  };

  // 이 화면의 문장들을 한 번에 나눠, 같은 용어는 처음 나올 때만 밑줄을 긋는다
  const texts = [step.summary, ...step.items.flatMap((i) => [i.text, i.why]), ...(branch?.items ?? []).flatMap((i) => [i.text, i.why])];
  const segs = splitAll(texts);
  const summarySegs = segs[0];
  const pair = (from: number, n: number) => Array.from({ length: n }, (_, k) => [segs[from + 2 * k], segs[from + 2 * k + 1]]);
  const stepSegs = pair(1, step.items.length);
  const branchSegs = pair(1 + 2 * step.items.length, branch?.items.length ?? 0);

  const setChecked = (key: string, value: boolean) =>
    update((p) => {
      const checked = { ...p.checked };
      if (value) checked[key] = true;
      else delete checked[key];
      return { ...p, checked };
    });

  // 이전 · 다음: 방 안에서는 건너뛴 단계(방을 찾았으니 1 · 2단계, 해 봤어요면 1–3단계)를 지나 이어지고, 길의 처음 · 끝은 방으로 돌아간다
  const stats = stepStats(steps, branches, progress, { inRoom: Boolean(room) });
  const prev = [...steps].reverse().find((s) => s.no < step.no && !stats.perStep[s.no - 1].skipped) ?? null;
  const next = steps.find((s) => s.no > step.no) ?? null;
  const backHref = room ? roomHref(room.id) : "/steps";

  const check = room?.check ?? null;
  const checkHref = r("/check");
  const checkSlot = check ? (
    <div className="step-check">
      <div className="result-top">
        <TrafficLight verdict={check.verdict} />
        <p className="small strong">{headline(check.verdict, toCheckCount(check))}</p>
      </div>
      <p className="small muted">{check.asOf} 점검 · 아래 &apos;결과에 맞춘 할 일&apos;로 이어져요</p>
      <Link href={checkHref} className="nav-btn nav-btn-sm">
        다시 점검하기
      </Link>
    </div>
  ) : (
    // 주 버튼은 아래 고정 줄 하나만: 목록 안에서는 같은 곳으로 가는 보조 버튼
    <Link href={checkHref} className="nav-btn nav-btn-accent small-cta">
      등기부등본 점검하러 가기 →
    </Link>
  );
  const docList = visibleDocs(progress.branch, check?.unknowns ?? null);
  const docGroup = DOC_GROUP[step.id];
  // 건축물대장: 누가 확인하는지가 계약 방법에 따라 다르다(중개사는 확인 · 설명서에 적어 보여 줘야 함, S17). 중개사가 있어도 이상하면 직접 뗀다
  const gov24 = (
    <a href="https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A04004&CappBizCD=15000000098" target="_blank" rel="noopener noreferrer">
      정부24에서 떼기 ↗
    </a>
  );
  const buildingHow =
    progress.branch === "broker" ? (
      <>중개사가 주는 확인 · 설명서의 &apos;위반건축물 · 용도&apos; 칸을 봐요. 이상하면 {gov24} (인터넷 무료)</>
    ) : progress.branch === "direct" ? (
      <>직거래는 직접 떼서 봐요 · {gov24} (인터넷 무료)</>
    ) : (
      <>{gov24} (인터넷 무료) · 중개사가 있으면 확인 · 설명서로 확인해도 돼요</>
    );
  const needCheck = Boolean(step.key) && Boolean(room) && !check && !progress.checked["documents.registry"];
  const mainKeys = step.items.filter((i) => !i.optional).map((i) => `${step.id}.${i.id}`);
  const allDone = mainKeys.length > 0 && mainKeys.every((k) => progress.checked[k]);
  const needBranch = Boolean(step.key) && (!progress.branch || (Boolean(room) && progress.branch === "none"));

  return (
    <main className="container check">
      <nav className="topbar">
        <BackButton fallback={backHref} />
        <HomeLink />
        <span>{room ? room.label : "계약 과정"}</span>
      </nav>
      {/* 단계 머리: 미리보기와 같은 그림 + 몇 번째 단계인지 + 한 줄 설명 */}
      <header className="step-head">
        <div className="step-art" aria-hidden="true">{STEP_ART[step.id]}</div>
        <div>
          <p className="step-count">{step.no} / {total} 단계</p>
          <h1 className="title">{step.title}</h1>
          <p className="muted step-summary">
            <TermText segments={summarySegs} />
          </p>
        </div>
      </header>
      {segs.some((g) => g.some((x) => x.term)) && <TermHint />}

      <p className="check-hint small muted">
        {CHECK_HINT[step.id] ?? "한 것부터"} 체크해 주세요 · {next ? "다 체크하면 다음 단계로 넘어가요" : "다 체크하면 계약 완료예요"}
      </p>
      <Checklist groupId={step.id} items={step.items} checked={progress.checked} onToggle={setChecked} segments={stepSegs} checkSlot={checkSlot} extra={{ building: buildingHow }} />

      {step.items.some((i) => i.id === "prior_deposits") && <PriorDepositGuide />}

      {step.no === 3 && room && <RentCard room={room} />}

      {/* 갈래길은 질문 한 번으로만(어디서 찾았는지에 따라 4단계 할 일이 달라짐). 다른 화면으로 보내지 않고 여기서 고른다 */}
      {needBranch && (
        <section className="card inline-q" aria-labelledby="branch-q">
          <h2 id="branch-q">{room ? "이 방, 어떻게 계약해요?" : "방, 어디서 찾았어요?"}</h2>
          <p className="small muted">고르면 그에 맞는 할 일이 아래에 붙어요</p>
          <div className="seg-choice" role="radiogroup" aria-labelledby="branch-q">
            {BRANCH_OPTIONS.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={false} className="chip" onClick={() => update((p) => ({ ...p, branch: o.id }))}>
                {o.title}
              </button>
            ))}
          </div>
        </section>
      )}
      {step.key && branch && (
        <section>
          <h2>{BRANCH_TITLE[branch.id]}</h2>
          <Checklist groupId={branch.id} items={branch.items} checked={progress.checked} onToggle={setChecked} segments={branchSegs} />
          <button type="button" className="ghost nav-btn-sm" onClick={() => update((p) => ({ ...p, branch: null }))}>
            계약 방법 바꾸기
          </button>
        </section>
      )}

      {step.key && check && room && (
        <NextActions
          actions={withBranch(check.actions, progress.branch)}
          notes={notes}
          onNote={saveNote}
          recheckHref={checkHref}
          picked={progress.checked}
          onPick={setChecked}
        />
      )}

      {/* 받을 서류 · 챙길 것은 접어 둔다(지금 할 일 목록보다 앞에 나서지 않게) */}
      {/* 5단계: 4단계에서 담은 요청 목록을 그대로 이어서 보며 계약서에 들어갔는지 확인 */}
      {step.id === "contract" && check && room && (
        <RequestCard
          actions={withBranch(check.actions, progress.branch)}
          picked={progress.checked}
          title="4단계에서 담은 요청 목록"
          hint="계약서 특약 · 설명에 들어갔는지 하나씩 확인해요."
          empty="4단계(계약 전 서류 확인)에서 '요청 목록에 담기'를 누른 것이 여기에 이어져요."
        />
      )}

      {docGroup && (
        <details className="card fold step-docs">
          <summary>
            <h2 className="h3">{docGroup === "receive" ? "집주인 · 중개사에게 받을 서류" : "계약하는 날 챙길 것"}</h2>
          </summary>
          <DocGroup groupId={docGroup} list={docList} checked={progress.checked} onToggle={(id, v) => setChecked(docKey(id), v)} roomId={roomId} />
        </details>
      )}

      {(step.id === "contract" || (step.key && check && check.verdict !== "safe")) && <HelpCard />}

      {/* 아래 고정 줄: 주 버튼 하나. 4단계에서 아직 등기부 점검 전이면 점검을 먼저 권한다(가장 중요한 단계를 모르고 넘어가지 않게) */}
      <ActionBar
        prev={prev ? { label: "← 이전", href: r(`/steps/${prev.no}`), aria: `이전: ${prev.title}` } : room ? { label: "← 이전", href: backHref, aria: "이전: 계약까지 가는 길" } : undefined}
        primary={
          needCheck
            ? { label: "다음: 등기부등본 점검 →", href: checkHref }
            : !room && step.no === 2
              ? { label: "다음: 방 담기 →", href: "/rooms/new" }
              : next
                ? { label: `다음: ${next.title} →`, href: r(`/steps/${next.no}`) }
                : { label: room ? "다음: 계약까지 가는 길 →" : "다음: 내 계약 진행 →", href: backHref }
        }
        note={
          needCheck ? (
            <><strong>아직 등기부등본 점검 전이에요.</strong> 진짜 집주인과 빚을 확인하는, 가장 중요한 단계예요.</>
          ) : allDone ? (
            <strong>✓ 이 단계를 다 했어요{next ? "" : " · 계약 완료까지 챙겼어요"}</strong>
          ) : undefined
        }
        extra={
          needCheck && next ? (
            <Link href={r(`/steps/${next.no}`)} className="action-skip">
              점검 없이 {next.title}(으)로 넘어가기
            </Link>
          ) : undefined
        }
      />
    </main>
  );
}
