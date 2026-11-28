"use client";
// 4단계 '계약 전 서류 확인'을 서류 하나씩(11/28 UX: 한 화면에 서류 3종 · 갈래 · 받을 서류가 다 있어 어려웠음).
// 순서: ① 어떤 집 · 어떻게 계약 → ② 등기부등본(앱에서 점검) → ③ 건축물대장(아파트는 건너뜀) → ④ 앞선 세입자 보증금(원룸 건물만) → ⑤ 결과에 맞춘 할 일.
// 서류 화면은 모두 같은 틀: 왜 · 어디서 · 얼마 · 몇 분 / 무엇을 보면 돼요(✓ ▲) / 중개사가 있으면 / 확인했어요.
// 지금 서류는 주소의 ?doc= 로 정해서 ←(뒤로) · 새로고침에도 같은 화면에 머문다.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Branch, Step } from "@/lib/content";
import { splitAll } from "@/lib/content/terms";
import { withBranch } from "@/lib/registry/actions";
import { headline } from "@/lib/registry/goodPoints";
import type { Branch as BranchId } from "@/lib/store/progress";
import { roomHref, updateRoom, withRoom } from "@/lib/store/rooms";
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
import NextActions, { CopyButton } from "../../check/NextActions";
import { DocGroup, docKey, visibleDocs } from "../../docs/DocsClient";
import BackButton from "../../ui/Back";

export type House = "multi" | "villa" | "officetel" | "apt";
export const HOUSES: { id: House; title: string; hint: string }[] = [
  { id: "multi", title: "원룸 건물 (다가구)", hint: "한 건물에 집주인 한 명, 방이 여러 개" },
  { id: "villa", title: "빌라 (다세대 · 연립)", hint: "호수마다 주인이 따로" },
  { id: "officetel", title: "오피스텔", hint: "" },
  { id: "apt", title: "아파트", hint: "" },
];
const BRANCHES: { id: BranchId; title: string }[] = [
  { id: "broker", title: "공인중개사를 통해서" },
  { id: "direct", title: "집주인과 직접 (직거래)" },
];
/** 집 종류는 진행 체크와 같은 곳(checked)에 'house.○○' 키로 둔다 → 방마다 저장 · 계정 동기화가 그대로 된다 */
export const houseOf = (checked: Record<string, boolean>): House | null => HOUSES.find((h) => checked[`house.${h.id}`])?.id ?? null;

type Stage = "about" | "registry" | "building" | "prior" | "todo";
const STAGE_NAME: Record<Stage, string> = { about: "어떤 집", registry: "등기부등본", building: "건축물대장", prior: "앞선 보증금", todo: "할 일 정리" };

const IROS = "https://www.iros.go.kr";
const GOV24 = "https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A04004&CappBizCD=15000000098";
/** 중개사에게 한 번에 부탁하는 문장(C). 중개사는 확인 · 설명서에 근거 자료를 보여 줘야 한다(S17) */
export const BROKER_ASK =
  "안녕하세요, 계약 전에 등기부등본 · 건축물대장과 중개대상물 확인 · 설명서를 먼저 볼 수 있을까요? 다가구라면 다른 세입자 보증금(확정일자 부여현황)도 확인 부탁드려요.";

export default function DocsWizard({ step, total, branches, steps }: { step: Step; total: number; branches: Branch[]; steps: Step[] }) {
  const { progress, update, room, roomId, loaded } = useProgress();
  const params = useSearchParams();
  const r = (href: string) => withRoom(href, roomId);
  const house = houseOf(progress.checked);
  const branch = progress.branch === "broker" || progress.branch === "direct" ? progress.branch : null;
  const check = room?.check ?? null;
  const done = (id: string) => Boolean(progress.checked[`documents.${id}`]);

  const stages: Stage[] = ["about", "registry", ...(house === "apt" ? [] : (["building"] as Stage[])), ...(house === "multi" || !house ? (["prior"] as Stage[]) : []), "todo"];
  // 주소에 doc이 없으면 아직 안 한 첫 서류부터
  const firstOpen: Stage = !house || !branch ? "about" : !done("registry") ? "registry" : stages.includes("building") && !done("building") ? "building" : stages.includes("prior") && !done("prior_deposits") ? "prior" : "todo";
  // 주소에 doc이 없을 때 시작 화면은 처음 열 때 한 번만 정한다(고르는 중에 화면이 저절로 넘어가지 않게)
  const [start, setStart] = useState<Stage | null>(null);
  useEffect(() => {
    if (loaded && start === null) setStart(firstOpen);
  }, [loaded, start, firstOpen]);
  const asked = params?.get("doc") as Stage | null;
  const stage: Stage = asked && stages.includes(asked) ? asked : (start ?? firstOpen);
  const idx = stages.indexOf(stage);
  const at = (s: Stage) => r(`/steps/4?doc=${s}`);

  const setChecked = (key: string, value: boolean) =>
    update((p) => {
      const c = { ...p.checked };
      if (value) c[key] = true;
      else delete c[key];
      return { ...p, checked: c };
    });
  const chooseHouse = (h: House) =>
    update((p) => {
      const c = { ...p.checked };
      for (const x of HOUSES) delete c[`house.${x.id}`];
      c[`house.${h}`] = true;
      // 해당 없는 서류는 '해당 없음'으로 끝낸 것으로 친다(그래야 4단계가 끝난다). 다시 원룸 건물로 바꾸면 되돌린다
      const auto = (key: string, on: boolean) => {
        if (on) {
          if (!c[key]) c[`auto.${key}`] = true;
          c[key] = true;
        } else if (c[`auto.${key}`]) {
          delete c[key];
          delete c[`auto.${key}`];
        }
      };
      auto("documents.prior_deposits", h !== "multi");
      auto("documents.building", h === "apt");
      return { ...p, checked: c };
    });

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

  const branchContent = branch ? branches.find((b) => b.id === branch) : undefined;
  const branchSegs = splitAll((branchContent?.items ?? []).flatMap((i) => [i.text, i.why]));
  const pair = (n: number) => Array.from({ length: n }, (_, k) => [branchSegs[2 * k], branchSegs[2 * k + 1]]);
  const item = (id: string) => step.items.find((i) => i.id === id)!;
  const itemSegs = splitAll([item("building").why, item("prior_deposits").why]);

  const next = steps.find((s) => s.no === step.no + 1)!;
  const prevStep = steps.find((s) => s.no === step.no - 1)!;
  const checkHref = r("/check");

  /** 서류 하나를 같은 틀로 */
  const DocCard = ({ id, why, where, look, broker, children, sources }: { id: string; why: ReactNode; where: ReactNode; look?: { good?: string; bad?: string }; broker: string; children?: ReactNode; sources?: string[] }) => (
    <section className="card doc-card" aria-labelledby={`doc-${id}`}>
      <dl className="doc-lines">
        <dt>왜 봐요?</dt>
        <dd>{why}</dd>
        <dt>어디서 · 얼마</dt>
        <dd>{where}</dd>
        {look && (
          <>
            <dt>무엇을 보면 돼요?</dt>
            <dd>
              <dl className="criteria">
                {look.good && (
                  <>
                    <dt className="criteria-good"><span aria-hidden="true">✓</span><span className="visually-hidden">이러면 괜찮아요</span></dt>
                    <dd>{look.good}</dd>
                  </>
                )}
                {look.bad && (
                  <>
                    <dt className="criteria-bad"><span aria-hidden="true">▲</span><span className="visually-hidden">이러면 다시 보세요</span></dt>
                    <dd>{look.bad}</dd>
                  </>
                )}
              </dl>
            </dd>
          </>
        )}
        {branch !== "direct" && (
          <>
            <dt>중개사가 있으면</dt>
            <dd>{broker}</dd>
          </>
        )}
      </dl>
      {children}
      {sources && sources.length > 0 && (
        <p className="small muted">
          근거{" "}
          {sources.map((s, i) => (
            <span key={s}>
              {i > 0 && " · "}
              <Link href={`/sources#${s}`}>{s}</Link>
            </span>
          ))}
        </p>
      )}
      {id !== "registry" && (
        <label className="doc-done-check">
          <input type="checkbox" checked={done(id)} onChange={(e) => setChecked(`documents.${id}`, e.target.checked)} />
          <span>확인했어요</span>
        </label>
      )}
    </section>
  );

  let body: ReactNode = null;
  let primary: { label: string; href?: string; onClick?: () => void } = { label: `다음: ${STAGE_NAME[stages[idx + 1]] ?? next.title} →`, href: stages[idx + 1] ? at(stages[idx + 1]) : r(`/steps/${next.no}`) };
  let note: ReactNode = undefined;
  let extra: ReactNode = undefined;

  if (stage === "about") {
    const ready = Boolean(house && branch);
    body = (
      <>
        <section className="card inline-q" aria-labelledby="house-q">
          <h2 id="house-q">어떤 집이에요?</h2>
          <p className="small muted">집마다 봐야 할 서류가 달라요. 모르면 &apos;원룸 건물&apos;을 골라요</p>
          <div className="seg-choice seg-col" role="radiogroup" aria-labelledby="house-q">
            {HOUSES.map((h) => (
              <button key={h.id} type="button" role="radio" aria-checked={house === h.id} className={`chip${house === h.id ? " chip-on" : ""}`} onClick={() => chooseHouse(h.id)}>
                {h.title}
                {h.hint && <span className="chip-hint">{h.hint}</span>}
              </button>
            ))}
          </div>
        </section>
        <section className="card inline-q" aria-labelledby="branch-q">
          <h2 id="branch-q">{room ? "이 방, 어떻게 계약해요?" : "어떻게 계약해요?"}</h2>
          <div className="seg-choice seg-col" role="radiogroup" aria-labelledby="branch-q">
            {BRANCHES.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={branch === o.id} className={`chip${branch === o.id ? " chip-on" : ""}`} onClick={() => update((p) => ({ ...p, branch: o.id }))}>
                {o.title}
              </button>
            ))}
          </div>
        </section>
        {branch === "broker" && (
          <section className="card ask-broker">
            <h2 className="h3">중개사에게 한 번에 부탁하기</h2>
            <p className="bubble">{BROKER_ASK}</p>
            <CopyButton text={BROKER_ASK} label="문장 복사" />
            <p className="small muted">그래도 등기부등본은 계약 직전에 내가 직접 떼서 점검해요</p>
          </section>
        )}
      </>
    );
    if (!ready) primary = { label: "위 두 가지를 먼저 골라 주세요", onClick: () => toast("어떤 집인지와 계약 방법을 골라 주세요") };
  } else if (stage === "registry") {
    body = (
      <DocCard
        id="registry"
        why="진짜 집주인이 누구인지, 집에 빚(근저당) · 압류가 있는지 봐요. 가장 중요한 서류예요"
        where={
          <>
            <a href={IROS} target="_blank" rel="noopener noreferrer">인터넷등기소 ↗</a> · 열람 1,100원 · 5분
          </>
        }
        broker="중개사도 확인 · 설명서에 붙여 줘야 해요. 그래도 계약 직전에 내가 직접 떼서 점검해요"
        sources={["S19", "S26"]}
      >
        {check ? (
          <div className="step-check">
            <div className="result-top">
              <TrafficLight verdict={check.verdict} />
              <p className="small strong">{headline(check.verdict, toCheckCount(check))}</p>
            </div>
            <p className="small muted">{check.asOf} 점검 · 자세한 할 일은 마지막 &apos;할 일 정리&apos;에 모여요</p>
            <Link href={checkHref} className="nav-btn nav-btn-sm">
              다시 점검하기
            </Link>
          </div>
        ) : done("registry") ? (
          <p className="small">✓ 직접 확인했다고 체크했어요</p>
        ) : null}
      </DocCard>
    );
    if (!check && !done("registry")) {
      primary = { label: "등기부등본 PDF 올려서 점검하기 →", href: checkHref };
      note = <><strong>떼서 올리면 앱이 바로 읽어 신호등으로 알려 줘요.</strong> 아직 없으면 위 인터넷등기소에서 떼요</>;
      extra = (
        <Link href={at(stages[idx + 1])} className="action-skip">
          점검 없이 다음 서류로
        </Link>
      );
    }
  } else if (stage === "building") {
    const it = item("building");
    body = (
      <DocCard
        id="building"
        why={<TermText segments={itemSegs[0]} />}
        where={
          <>
            <a href={GOV24} target="_blank" rel="noopener noreferrer">정부24 ↗</a> · 인터넷 발급 무료 · 5분
          </>
        }
        look={{ good: it.good, bad: it.bad }}
        broker="확인 · 설명서의 '위반건축물 · 용도' 칸을 보여 달라고 하세요. 이상하면 직접 떼요"
        sources={it.sources}
      />
    );
  } else if (stage === "prior") {
    body = (
      <DocCard
        id="prior_deposits"
        why={<TermText segments={itemSegs[1]} />}
        where="주민센터 · 정보제공 600원 · 집주인 동의서 필요"
        look={{ good: "앞선 보증금 + 빚 + 내 보증금이 시세의 70% 아래", bad: "70%를 넘거나, 집주인이 동의를 거절해요" }}
        broker="확정일자 부여현황(다른 세입자 보증금)을 확인해 달라고 하세요"
        sources={["S6", "S27"]}
      >
        <PriorDepositGuide />
      </DocCard>
    );
  } else {
    // 할 일 정리: 점검 결과에 맞춘 질문 · 특약, 계약 방법별 할 일, 받을 서류, 상담
    const docList = visibleDocs(progress.branch, check?.unknowns ?? null);
    body = (
      <>
        {check && room ? (
          <>
            <section className="card step-result" aria-label="등기부 점검 결과">
              <div className="result-top">
                <TrafficLight verdict={check.verdict} />
                <p className="small strong">{headline(check.verdict, toCheckCount(check))}</p>
              </div>
              <Link href={checkHref} className="nav-btn nav-btn-sm">
                다시 점검하기
              </Link>
            </section>
            <NextActions actions={withBranch(check.actions, progress.branch)} notes={notes} onNote={saveNote} recheckHref={checkHref} picked={progress.checked} onPick={(k, v) => setChecked(k, v)} termHint={false} />
          </>
        ) : (
          <p className="card small">
            등기부등본을 점검하면 결과에 맞춘 질문 · 특약이 여기에 모여요.{" "}
            <Link href={checkHref} className="nav-btn nav-btn-sm">
              등기부등본 점검하기
            </Link>
          </p>
        )}
        {branchContent && (
          <section>
            <h2>{branchContent.id === "broker" ? "중개사를 통해서라면 내가 직접 확인할 것" : "직거래라서 꼭 할 것"}</h2>
            <Checklist groupId={branchContent.id} items={branchContent.items} checked={progress.checked} onToggle={setChecked} segments={pair(branchContent.items.length)} />
          </section>
        )}
        <details className="card fold step-docs">
          <summary>
            <h2 className="h3">집주인 · 중개사에게 받을 서류</h2>
          </summary>
          <DocGroup groupId="receive" list={docList} checked={progress.checked} onToggle={(id, v) => setChecked(docKey(id), v)} roomId={roomId} />
        </details>
        {check && check.verdict !== "safe" && <HelpCard />}
      </>
    );
    primary = { label: `다음: ${next.title} →`, href: r(`/steps/${next.no}`) };
  }

  const prev = idx > 0 ? { label: "← 이전", href: at(stages[idx - 1]), aria: `이전: ${STAGE_NAME[stages[idx - 1]]}` } : { label: "← 이전", href: r(`/steps/${prevStep.no}`), aria: `이전: ${prevStep.title}` };

  return (
    <main className="container check">
      <nav className="topbar">
        <BackButton fallback={room ? roomHref(room.id) : "/steps"} />
        <HomeLink />
        <span>{room ? room.label : "계약 과정"}</span>
      </nav>
      <header className="step-head">
        <div className="step-art" aria-hidden="true">{STEP_ART[step.id]}</div>
        <div>
          <p className="step-count">
            {step.no} / {total} 단계 · 서류 확인 {idx + 1}/{stages.length}
          </p>
          <h1 className="title">{stage === "about" ? step.title : STAGE_NAME[stage]}</h1>
          <p className="muted step-summary">{stage === "about" ? "봐야 할 서류를 집에 맞게 골라 드릴게요" : stage === "todo" ? "결과에 맞춘 질문 · 특약과 계약 방법별 할 일" : `계약 전 서류 확인 · ${idx}번째 서류`}</p>
        </div>
      </header>
      <ol className="doc-steps" aria-label="서류 확인 순서">
        {stages.map((s, i) => (
          <li key={s} aria-current={s === stage ? "step" : undefined} className={i < idx ? "done" : undefined}>
            {s === stage ? <span>{STAGE_NAME[s]}</span> : <Link href={at(s)}>{i < idx ? "✓ " : ""}{STAGE_NAME[s]}</Link>}
          </li>
        ))}
      </ol>
      <TermHint />
      {body}
      <ActionBar prev={prev} primary={primary} note={note} extra={extra} />
    </main>
  );
}
