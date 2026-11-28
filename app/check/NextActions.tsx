"use client";
// F3 다음 행동 카드: 이렇게 물어보세요 · 이렇게 하세요 · 계약서 특약 · 가족 · 지인에게 보내기(복사 · 공유).
import Link from "next/link";
import { useState } from "react";
import type { NextActions as Actions } from "@/lib/registry/actions";
import { splitAll } from "@/lib/content/terms";
import TermHint from "../ui/TermHint";
import TermText from "../ui/TermText";

/** 클립보드에 복사. 막힌 환경에서는 숨긴 입력칸을 써서 한 번 더 시도한다. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={async () => {
          setState((await copyText(text)) ? "done" : "fail");
          setTimeout(() => setState("idle"), 2000);
        }}
      >
        {state === "done" ? "복사했어요" : label}
      </button>
      <span className="sr-status" role="status">
        {state === "done" ? "복사했어요" : state === "fail" ? "복사하지 못했어요. 글자를 길게 눌러 직접 복사해 주세요." : ""}
      </span>
    </>
  );
}

/** 문장 → 짧고 바뀌지 않는 키 (요청 목록 체크를 저장할 때 씀) */
export function reqKey(kind: "q" | "c", textOrId: string): string {
  if (kind === "c") return `req.c.${textOrId}`.slice(0, 80);
  let h = 5381;
  for (const ch of textOrId) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return `req.q.${h.toString(36)}`;
}

/** 질문 · 할 일 문장 → 알아낸 것(메모)을 저장할 키 */
export function noteKey(text: string): string {
  return `note.${reqKey("q", text).slice(6)}`;
}

/**
 * 알아낸 것 적기(10번): 질문 · 할 일마다 들은 답 · 알아낸 값을 적어 두고, 적었으면 그 옆에서 바로 다시 점검하러 간다.
 * 방 화면에서만 보인다(방에 저장).
 */
function NoteBox({ value, onSave, recheckHref }: { value: string; onSave: (v: string) => void; recheckHref?: string }) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <div className="note-row">
        {value ? <p className="note-saved">✎ 알아낸 것: {value}</p> : null}
        <button type="button" className="ghost" onClick={() => { setDraft(value); setOpen(true); }}>
          {value ? "고치기" : "✎ 알아낸 것 적기"}
        </button>
        {value && recheckHref ? (
          <Link href={recheckHref} className="nav-btn nav-btn-accent">
            다시 점검하기
          </Link>
        ) : null}
      </div>
    );
  return (
    <div className="note-edit">
      <label className="small">
        알아낸 것 (예: 앞선 보증금 합계 2억이라고 들음 · 신분증 확인함)
        <textarea rows={2} maxLength={300} value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <div className="row-buttons">
        <button type="button" className="chip" onClick={() => { onSave(draft.trim()); setOpen(false); }}>
          저장
        </button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>
          취소
        </button>
      </div>
    </div>
  );
}

/** 담은 질문 · 특약을 집주인 · 중개사에게 보낼 한 덩어리 글로 */
export function requestText(questions: string[], clauses: { title: string; text: string }[]): string {
  const out: string[] = [];
  if (questions.length) out.push("[계약 전에 확인하고 싶은 것]", ...questions.map((q, i) => `${i + 1}. ${q}`));
  if (clauses.length) {
    if (out.length) out.push("");
    out.push("[계약서 특약으로 넣고 싶은 것]", ...clauses.map((c, i) => `${i + 1}. ${c.title}: ${c.text}`));
  }
  return out.join("\n");
}

function PickButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`ghost pick${on ? " pick-on" : ""}`} aria-pressed={on} onClick={onClick}>
      {on ? "✓ 요청 목록에 담았어요" : "+ 요청 목록에 담기"}
    </button>
  );
}

/**
 * @param picked · onPick 방 화면에서는 방에 저장되게 넘기고, 없으면 이 화면 안에서만 기억한다.
 */
export default function NextActions({
  actions,
  picked: pickedProp,
  onPick,
  notes,
  onNote,
  recheckHref,
  termHint = true,
}: {
  actions: Actions;
  /** 위쪽에 이미 '모르는 단어' 안내가 있으면 false */
  termHint?: boolean;
  picked?: Record<string, boolean>;
  onPick?: (key: string, value: boolean) => void;
  /** 방 화면: 알아낸 것(메모)과 저장 · 다시 점검 주소. 없으면 메모 칸을 숨긴다 */
  notes?: Record<string, string>;
  onNote?: (key: string, value: string) => void;
  recheckHref?: string;
}) {
  const note = (text: string) =>
    onNote ? <NoteBox value={notes?.[noteKey(text)] ?? ""} onSave={(v) => onNote(noteKey(text), v)} recheckHref={recheckHref} /> : null;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const [localPicked, setLocalPicked] = useState<Record<string, boolean>>({});
  const picked = pickedProp ?? localPicked;
  const toggle = (key: string) => {
    const value = !picked[key];
    if (onPick) onPick(key, value);
    else setLocalPicked((p) => ({ ...p, [key]: value }));
  };
  // 질문 · 할 일 문장의 어려운 말(근저당 · 말소 …)도 눌러서 뜻을 볼 수 있게. 같은 말은 처음 나올 때만
  const segs = splitAll([...actions.questions, ...actions.todos]);
  const qSeg = (i: number) => segs[i];
  const tSeg = (i: number) => segs[actions.questions.length + i];
  const hasTerm = segs.some((g) => g.some((x) => x.term));

  return (
    <section className="next" aria-labelledby="next-title">
      <h2 id="next-title">결과에 맞춘 할 일</h2>
      {termHint && hasTerm && <TermHint />}

      {actions.questions.length > 0 && (
        <div className="card">
          <h3>집주인 · 중개사에게 이렇게 물어보세요</h3>
          <ul className="bubbles">
            {actions.questions.map((q, i) => (
              <li key={q}>
                <p className="bubble">
                  <TermText segments={qSeg(i)} />
                </p>
                <div className="row-buttons">
                  <CopyButton text={q} />
                  <PickButton on={Boolean(picked[reqKey("q", q)])} onClick={() => toggle(reqKey("q", q))} />
                </div>
                {note(q)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>이렇게 하세요</h3>
        <ol className="plain">
          {actions.todos.map((t, i) => (
            <li key={t}>
              <TermText segments={tSeg(i)} />
              {note(t)}
            </li>
          ))}
        </ol>
      </div>

      {/* 결과가 길어서 특약 · 가족에게 보내기는 접어 둔다(필요할 때 펼침) */}
      <details className="card fold">
        <summary>
          <h3>계약서 특약에 이렇게 적어요</h3>
          <span className="small muted">{actions.clauses.length}개 · 눌러서 보기</span>
        </summary>
        <ul className="bubbles">
          {actions.clauses.map((c) => (
            <li key={c.id}>
              <p className="small strong">{c.title}</p>
              <p className="bubble">{c.text}</p>
              <p className="small muted">
                {c.basis}
                {c.sources.map((s) => (
                  <span key={s.id}>
                    {" "}
                    · 근거 <Link href={`/sources#${s.id}`}>{s.id}</Link>
                  </span>
                ))}
              </p>
              <div className="row-buttons">
                <CopyButton text={c.text} />
                <PickButton on={Boolean(picked[reqKey("c", c.id)])} onClick={() => toggle(reqKey("c", c.id))} />
              </div>
            </li>
          ))}
        </ul>
      </details>

      <RequestCard actions={actions} picked={picked} />

      <details className="card parent fold">
        <summary>
          <h3>가족 · 지인에게 보내기</h3>
          <span className="small muted">눌러서 보기</span>
        </summary>
        <p className="small muted">보증금을 함께 마련한 가족이나 믿을 만한 사람에게 보여 주세요. 집주인 이름 · 주소는 넣지 않았어요.</p>
        <pre className="summary">{actions.parentSummary}</pre>
        <div className="row-buttons">
          <CopyButton text={actions.parentSummary} label="요약 복사" />
          {canShare && (
            <button
              type="button"
              className="ghost"
              onClick={() => navigator.share({ title: "홈체크 점검 결과", text: actions.parentSummary }).catch(() => {})}
            >
              카카오톡 등으로 보내기
            </button>
          )}
        </div>
      </details>
    </section>
  );
}

/**
 * 요청 목록(질문 · 특약에서 '요청 목록에 담기'한 것). 4단계(결과에 맞춘 할 일)에서 담고,
 * 5단계(계약하는 날)에서는 같은 목록을 보며 계약서에 들어갔는지 확인한다.
 */
export function RequestCard({
  actions,
  picked,
  title = "내 요청 목록",
  hint = "집주인 · 중개사에게 한 번에 보내거나, 계약하는 날 보면서 하나씩 확인해요.",
  empty = "위의 질문 · 특약에서 '요청 목록에 담기'를 누르면 여기에 모여요.",
}: {
  actions: Actions;
  picked: Record<string, boolean>;
  title?: string;
  hint?: string;
  empty?: string;
}) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const pickedQuestions = actions.questions.filter((q) => picked[reqKey("q", q)]);
  const pickedClauses = actions.clauses.filter((c) => picked[reqKey("c", c.id)]);
  const request = requestText(pickedQuestions, pickedClauses);
  return (
    <div className="card request" aria-live="polite">
      <h3>
        {title} <span className="accent">{pickedQuestions.length + pickedClauses.length}</span>
      </h3>
      {request ? (
        <>
          <p className="small muted">{hint}</p>
          <pre className="summary">{request}</pre>
          <div className="row-buttons">
            <CopyButton text={request} label="목록 복사" />
            {canShare && (
              <button type="button" className="ghost" onClick={() => navigator.share({ title: "계약 전 요청 목록", text: request }).catch(() => {})}>
                보내기
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="small muted">{empty}</p>
      )}
    </div>
  );
}
