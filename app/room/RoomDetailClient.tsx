"use client";
// 방 상세: ① 이 방, 안전한가요? → ② 이 방은 이렇게 계약해요 → 계약 과정(끝: 계약 완료 · 보증금 지키기).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Branch as BranchContent, Step } from "@/lib/content";
import { removeRoom, withRoom } from "@/lib/store/rooms";
import type { Branch } from "@/lib/store/progress";
import { withBranch } from "@/lib/registry/actions";
import type { FlagCode } from "@/lib/registry/types";
import NextActions from "../check/NextActions";
import RentCard from "./RentCard";
import StepBar from "../ui/StepBar";
import rules from "@/data/judge.json";
import { goodPoints, headline } from "@/lib/registry/goodPoints";
import { splitAll } from "@/lib/content/terms";
import { flagViews, moneyLine, rememberLastRoom, roomSteps, toCheckCount } from "../ui/roomView";
import TrafficLight from "../ui/TrafficLight";
import TermText from "../ui/TermText";
import UnknownList from "../ui/UnknownList";
import HelpCard from "../ui/HelpCard";
import { docKey, visibleDocs } from "../docs/DocsClient";
import { unknownById, type Unknown } from "@/lib/registry/unknowns";
import { roomsStore, useProgress } from "../ui/useProgress";
import HomeLink from "../ui/HomeLink";

const flagCodes = (codes: string[]) => codes.filter((c): c is FlagCode => c in rules.flags);

const LEVEL_LABEL = { danger: "위험", caution: "주의", info: "참고" } as const;
const BRANCH_OPTIONS: { id: Branch; title: string }[] = [
  { id: "broker", title: "공인중개사를 통해서" },
  { id: "direct", title: "집주인과 직접 (직거래)" },
];

export default function RoomDetailClient({ steps, branches }: { steps: Step[]; branches: BranchContent[] }) {
  const router = useRouter();
  const { progress, update, loaded, room } = useProgress();
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (room) rememberLastRoom(room.id);
  }, [room]);

  if (!loaded) return <main className="container check" aria-busy="true" />;
  if (!room) {
    return (
      <main className="container check">
        <h1 className="title">이 방을 찾을 수 없어요</h1>
        <p className="muted">지운 방이거나, 다른 기기 · 브라우저에서 담은 방일 수 있어요.</p>
        <Link href="/" className="cta">
          내 후보 방으로
        </Link>
      </main>
    );
  }

  // 갈래 · 체크는 progress(이 화면에서 바꾼 최신 값)를 쓴다
  const live = { ...room, branch: progress.branch, checked: progress.checked };
  const { segs, current } = roomSteps(live, progress.mode, steps, branches);
  const check = room.check;
  const flags = check ? flagViews(check) : [];
  const n = check ? toCheckCount(check) : 0;
  const flagSegs = splitAll(flags.map((f) => f.title));
  const good = check ? goodPoints({ flags: flagCodes(check.flags), ratio: check.ratio }, { caution: rules.ratio.caution_from }) : [];
  const r = (href: string) => withRoom(href, room.id);
  const docsList = visibleDocs(progress.branch, room.check?.unknowns ?? null);
  const docsTotal = docsList.length;
  const docsDone = docsList.filter((d) => progress.checked[docKey(d.item.id)]).length;

  const del = () => {
    const s = roomsStore();
    s.save(removeRoom(s.load(), room.id));
    router.push("/");
  };

  return (
    <main className="container check room-detail">
      <nav className="topbar">
        <Link href="/" className="back" aria-label="내 후보 방으로">
          ←
        </Link>
        <span>내 후보 방</span>
        {room.link && (
          <a href={room.link} target="_blank" rel="noopener noreferrer nofollow" className="topbar-right">
            매물 링크 열기
          </a>
        )}
        <HomeLink />
      </nav>

      <h1 className="title">{room.label}</h1>
      <p className="muted small">
        {room.address} · {moneyLine(room)}
        {room.memo && room.memo !== room.label ? ` · ${room.memo}` : ""}
      </p>

      <section aria-labelledby="sec-safe" className="room-sec">
        <h2 id="sec-safe" className="sec-title">
          ① 이 방, 안전한가요?
        </h2>
        {check ? (
          <>
            <div className="result-top">
              <TrafficLight verdict={check.verdict} />
              <p className="result-head">{headline(check.verdict, n)}</p>
            </div>
            {flags.length > 0 && (
              <ul className="flags">
                {flags.map((f, i) => (
                  <li key={f.code} className={`flag flag-${f.level}`}>
                    <span className="flag-level">{LEVEL_LABEL[f.level]}</span>
                    <p className="flag-title">
                      <TermText segments={flagSegs[i]} />
                    </p>
                    <details className="flag-explain">
                      <summary>왜 문제인지</summary>
                      <dl>
                        <dt>무슨 뜻</dt>
                        <dd>{f.meaning}</dd>
                        <dt>왜 위험</dt>
                        <dd>{f.why}</dd>
                      </dl>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            {good.length > 0 && (
              <ul className="good">
                {good.map((g) => (
                  <li key={g}>
                    <span className="good-mark" aria-hidden="true">✓</span>
                    {g}
                  </li>
                ))}
              </ul>
            )}
            <UnknownList items={check.unknowns.map(unknownById).filter((u): u is Unknown => Boolean(u))} />
            <p className="small muted">
              {check.asOf} 점검{check.edited && check.edited.length > 0 ? ` · ✎ 내가 고친 값(${check.edited.join(" · ")})으로 계산` : ""} · <Link href={r("/check")}>다시 점검하기</Link>
            </p>
          </>
        ) : (
          <div className="card">
            <p>아직 점검 전이에요. 등기부등본을 올리면 진짜 집주인 · 빚 · 위험 기록을 바로 알려 드려요.</p>
            <Link href={r("/check")} className="cta">
              등기부등본 올려서 점검하기
            </Link>
            <p className="small muted">
              등기부등본은{" "}
              <a href="https://www.iros.go.kr" target="_blank" rel="noopener noreferrer">
                인터넷등기소 ↗
              </a>
              에서 누구나 뗄 수 있어요(열람 1,100원).
            </p>
          </div>
        )}
        <RentCard room={room} />
      </section>

      <section aria-labelledby="sec-how" className="room-sec">
        <h2 id="sec-how" className="sec-title">
          ② 이 방은 이렇게 계약해요
        </h2>
        <div className="card">
          <p className="small strong" id="branch-q">
            이 방은 어떻게 계약해요?
          </p>
          <div className="seg-choice" role="radiogroup" aria-labelledby="branch-q">
            {BRANCH_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={progress.branch === o.id}
                className={`chip${progress.branch === o.id ? " chip-on" : ""}`}
                onClick={() => update((p) => ({ ...p, branch: o.id }))}
              >
                {o.title}
              </button>
            ))}
          </div>
          {progress.branch === "direct" && <p className="small">직거래는 <strong>집주인 본인 확인</strong>을 내가 직접 해야 해요. 4단계에 직거래 체크리스트를 붙여 둘게요.</p>}
          {progress.branch === "broker" && <p className="small">중개사가 있어도 내가 직접 확인할 것이 있어요. 4단계에 중개사 체크리스트를 붙여 둘게요.</p>}
        </div>
        {check ? (
          <NextActions
            actions={withBranch(check.actions, progress.branch)}
            picked={progress.checked}
            onPick={(key, value) =>
              update((p) => {
                const checked = { ...p.checked };
                if (value) checked[key] = true;
                else delete checked[key];
                return { ...p, checked };
              })
            }
          />
        ) : (
          <p className="card small muted">점검하면 이 방에 맞춘 질문 · 할 일 · 특약을 알려 드려요.</p>
        )}
        <Link href={r("/docs")} className="card docs-link">
          <span>
            <strong>서류 · 준비물</strong>
            <span className="small muted">계약 전에 뗄 것 · 받을 것 · 계약하는 날 챙길 것 · 이사 뒤 할 것</span>
          </span>
          <span className="docs-count">{docsDone}/{docsTotal}</span>
        </Link>
        <HelpCard />
      </section>

      <section aria-labelledby="sec-steps" className="room-sec">
        <div className="sec-head">
          <h2 id="sec-steps" className="sec-title">
            계약 과정
          </h2>
          <span className="small muted">{current ? `지금 ${current.no}단계 · ${current.title}` : "모든 단계를 마쳤어요"}</span>
        </div>
        <StepBar segs={segs} finish />
        {!current && (
          <div className="done-card" role="status">
            <svg className="done-check" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle className="done-ring" pathLength={1} cx="12" cy="12" r="10" />
              <path className="done-tick" pathLength={1} d="M7.5 12.5l3 3 6-6.5" />
            </svg>
            <span>
              <strong>계약 완료까지 다 챙겼어요</strong>
              <span className="small">이사 뒤 전입신고 · 확정일자까지 했다면, 보증금을 지키는 준비가 끝났어요.</span>
            </span>
          </div>
        )}
        <p className="small muted finish">도착: 계약 완료 · 보증금 지키기 (전입신고 · 확정일자)</p>
        <Link href={r(current ? `/steps/${current.no}` : "/steps")} className="cta cta-soft">
          {current ? `${current.no}단계 할 일 보기` : "단계 다시 보기"}
        </Link>
        <Link href={r("/steps")} className="small">
          6단계 전체 보기 →
        </Link>
      </section>

      <section className="room-sec danger-zone">
        {confirmDelete ? (
          <div className="row-buttons" role="group" aria-label="이 방 지우기 확인">
            <span className="small">이 방과 체크 · 점검 기록을 지울까요?</span>
            <button type="button" className="ghost danger" onClick={del}>
              지우기
            </button>
            <button type="button" className="ghost" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
          </div>
        ) : (
          <button type="button" className="linklike small" onClick={() => setConfirmDelete(true)}>
            이 방 지우기
          </button>
        )}
      </section>

      <p className="disclaimer">참고용 안내예요. 최종 확인은 공인중개사 · 법률 전문가에게 받아 주세요.</p>
    </main>
  );
}
