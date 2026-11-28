"use client";
// 방 화면 = 한 길(11/28 사용자: "one way로 단순하게, 필요할 때만 갈래길"). 6단계를 위에서 아래로 한 줄로 보여 주고,
// 지금 단계만 크게 펼쳐 버튼 하나(N단계 시작하기)를 둔다. 끝낸 단계는 다시 볼 수 있고, 아직 안 온 단계는 잠가 둔다(앞 단계부터).
// 점검 결과 · 계약 방법 · 질문 · 서류 · 상담은 따로 메뉴로 두지 않고 그 일을 하는 단계 안에 넣었다(4단계 · 5단계).
// 참고: NN/g 「Wizards」(차례대로 · 다음 단계 이름 · 멈췄다 이어 하기), GOV.UK(순서가 정해진 일은 한 길), 듀오링고 패스(나무 → 한 줄 길).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Branch as BranchContent, Step } from "@/lib/content";
import { removeRoom, updateRoom, withRoom } from "@/lib/store/rooms";
import PlanCard from "../ui/PlanCard";
import { headline } from "@/lib/registry/goodPoints";
import { focusTask, moneyLine, rememberLastRoom, roomSteps, toCheckCount, VERDICT_TEXT } from "../ui/roomView";
import { roomsStore, useProgress } from "../ui/useProgress";
import HomeLink from "../ui/HomeLink";
import BackButton from "../ui/Back";

export default function RoomDetailClient({ steps, branches }: { steps: Step[]; branches: BranchContent[] }) {
  const router = useRouter();
  const { progress, loaded, room } = useProgress();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 그날 정하기: 단계마다 날짜(방에 저장)
  const [dates, setDates] = useState<Record<string, string>>({});
  useEffect(() => {
    if (room) setDates(room.dates ?? {});
  }, [room]);
  const saveDate = (stepId: string, date: string) => {
    if (!room) return;
    const store = roomsStore();
    store.save(updateRoom(store.load(), room.id, (r) => ({ ...r, dates: { ...(r.dates ?? {}), [stepId]: date } })));
    setDates((d) => ({ ...d, [stepId]: date }));
  };
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

  const live = { ...room, branch: progress.branch, checked: progress.checked };
  const { current, stats } = roomSteps(live, progress.mode, steps, branches);
  const task = focusTask(live, progress.mode, steps, branches);
  const check = room.check;
  const r = (href: string) => withRoom(href, room.id);
  const active = steps.filter((s) => !stats.perStep[s.no - 1].skipped);
  const skipped = steps.filter((s) => stats.perStep[s.no - 1].skipped);

  const del = () => {
    const s = roomsStore();
    s.save(removeRoom(s.load(), room.id));
    router.push("/");
  };

  return (
    <main className="container check room-detail">
      <nav className="topbar">
        <BackButton fallback={"/"} />
        <span>내 후보 방</span>
        <HomeLink />
      </nav>
      <h1 className="title">{room.label}</h1>
      <p className="muted small">
        {room.address} · {moneyLine(room)}
      </p>

      {/* 진행 막대는 아래 길(동그라미)과 같은 말이라 뺐다(11/28 단순하게) */}
      <ol className="path" aria-label="계약까지 가는 길">
        {skipped.length > 0 && (
          <li className="path-step path-skipped">
            <span className="path-dot" aria-hidden="true">✓</span>
            <span className="path-body">
              <span className="small muted">
                {skipped.map((s) => s.title).join(" · ")} · 방을 찾았으니 끝났어요
              </span>
            </span>
          </li>
        )}
        {active.map((s) => {
          const st = stats.perStep[s.no - 1];
          const isCurrent = current?.no === s.no;
          const done = st.done === st.total && !isCurrent;
          const locked = !isCurrent && !done;
          const verdict = s.key && check ? (
            <span className={`small verdict-${check.verdict}`}>
              등기부 {VERDICT_TEXT[check.verdict].label} · {headline(check.verdict, toCheckCount(check))}
            </span>
          ) : null;
          if (isCurrent && task.kind === "step")
            return (
              <li key={s.id} className="path-step path-current" aria-current="step">
                <span className="path-dot" aria-hidden="true">{s.no}</span>
                <div className="path-body card focus-card">
                  <p className="focus-kicker">지금 할 일</p>
                  <h2>{task.title}</h2>
                  <p className="focus-why">{task.why}</p>
                  {verdict}
                  <Link href={task.href} className="primary-link">
                    {task.cta}
                  </Link>
                  <PlanCard key={s.id} step={s} date={dates[s.id]} roomLabel={room.label} roomId={room.id} onSave={(d) => saveDate(s.id, d)} />
                </div>
              </li>
            );
          return (
            <li key={s.id} className={`path-step ${done ? "path-done" : "path-locked"}`}>
              <span className="path-dot" aria-hidden="true">{done ? "✓" : s.no}</span>
              <span className="path-body">
                {locked ? (
                  <span className="path-title muted">
                    {s.no}. {s.title}
                  </span>
                ) : (
                  <Link href={r(`/steps/${s.no}`)} className="path-title">
                    {s.no}. {s.title} <span className="small muted">· 다시 보기</span>
                  </Link>
                )}
                {verdict}
              </span>
            </li>
          );
        })}
      </ol>

      {task.kind === "done" && (
        <div className="done-card" role="status">
          <svg className="done-check" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle className="done-ring" pathLength={1} cx="12" cy="12" r="10" />
            <path className="done-tick" pathLength={1} d="M7.5 12.5l3 3 6-6.5" />
          </svg>
          <span>
            <strong>계약 완료까지 다 챙겼어요</strong>
            <span className="small">보증금을 지키는 준비가 끝났어요.</span>
          </span>
        </div>
      )}

      <section className="room-sec danger-zone">
        {room.link && (
          <a href={room.link} target="_blank" rel="noopener noreferrer nofollow" className="nav-btn nav-btn-sm">
            매물 링크 열기 ↗
          </a>
        )}
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
          <button type="button" className="ghost" onClick={() => setConfirmDelete(true)}>
            이 방 지우기
          </button>
        )}
      </section>

      <p className="disclaimer">참고용 안내예요. 최종 확인은 공인중개사 · 법률 전문가에게 받아 주세요.</p>
    </main>
  );
}
