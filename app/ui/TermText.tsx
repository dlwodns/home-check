"use client";
// 문장 속 어려운 용어를 누르면 단어 옆에 작은 말풍선으로 뜻을 보여 준다(용어 사전 data/glossary.json).
// - 누를 수 있는 단어: 연한 초록 배경 + 점선 밑줄. 한 번 본 단어는 옅게
// - 말풍선: 꼬리가 단어를 가리킴, 화면 밖으로 나가면 안쪽으로 밀고 아래 공간이 없으면 위로
// - 한 번에 하나만, 바깥을 누르거나 Esc · 같은 단어를 다시 누르면 닫힘
// - PC(마우스)에서는 단어 위에 잠깐 올려도 보이고, 벗어나면 닫힘. 눌러서 연 것은 고정
// - '해 봤어요'인 사람은 밑줄 · 말풍선을 끌 수 있음(termPrefs)
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Segment } from "@/lib/content/terms";
import type { Term } from "@/lib/content";
import { useTermsOff } from "./termPrefs";

const SEEN_KEY = "homecheck.terms.seen.v1";
export const TERM_OPEN_EVENT = "homecheck:term-open";

let closeCurrent: (() => void) | null = null; // 열린 말풍선은 화면 전체에서 하나만

function loadSeen(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 100) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const s = loadSeen();
    s.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    /* 저장이 막혀 있으면 옅게 표시만 못 함 */
  }
}

/** segments는 lib/content/terms의 splitAll로 화면 단위에서 미리 나눈 것 */
export default function TermText({ segments }: { segments: Segment[] }) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => setSeen(loadSeen()), []);
  const off = useTermsOff();
  if (off) return <>{segments.map((s) => s.text).join("")}</>;

  return (
    <>
      {segments.map((s, i) =>
        s.term ? (
          <TermButton key={i} term={s.term} label={s.text} seen={seen.has(s.term.id)} onSeen={() => setSeen(loadSeen())} />
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function TermButton({ term, label, seen, onSeen }: { term: Term; label: string; seen: boolean; onSeen: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  const [pinned, setPinned] = useState(false); // 눌러서 연 것(마우스가 벗어나도 유지)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  const show = (pin: boolean) => {
    if (!open) {
      closeCurrent?.();
      closeCurrent = close;
      markSeen(term.id);
      window.dispatchEvent(new CustomEvent(TERM_OPEN_EVENT));
    }
    setOpen(true);
    setPinned(pin);
  };

  const toggle = () => {
    if (open && pinned) close();
    else show(true); // 마우스로 잠깐 열려 있던 것을 누르면 고정
  };

  const canHover = (e: React.PointerEvent) =>
    e.pointerType === "mouse" && typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches;
  const clearHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  const onEnter = (e: React.PointerEvent) => {
    if (!canHover(e)) return;
    clearHover();
    if (!open) hoverTimer.current = setTimeout(() => show(false), 250);
  };
  const onLeave = (e: React.PointerEvent) => {
    if (!canHover(e)) return;
    clearHover();
    if (open && !pinned) hoverTimer.current = setTimeout(close, 200);
  };
  useEffect(() => clearHover, []);

  // 바깥을 누르거나 Esc를 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      if (closeCurrent === close) closeCurrent = null;
    };
  }, [open, close]);

  // 닫힐 때 '본 단어'로 옅게
  useEffect(() => {
    if (!open) onSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 화면 밖으로 나가지 않게 가로로 밀고, 아래 공간이 없으면 위로 띄운다
  useLayoutEffect(() => {
    const pop = popRef.current;
    const btn = btnRef.current;
    if (!open || !pop || !btn) return;
    pop.style.left = "0px";
    pop.classList.remove("term-pop-up");
    const margin = 12;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const r = pop.getBoundingClientRect();
    let shift = 0;
    if (r.right > vw - margin) shift = vw - margin - r.right;
    if (r.left + shift < margin) shift = margin - r.left;
    pop.style.left = `${shift}px`;
    const b = btn.getBoundingClientRect();
    pop.style.setProperty("--tail-x", `${Math.max(14, Math.min(b.width / 2 - shift, r.width - 20))}px`);
    if (r.bottom > window.innerHeight - margin && b.top > r.height + margin * 2) pop.classList.add("term-pop-up");
  }, [open]);

  return (
    <span className="term-wrap" ref={wrapRef} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <button
        ref={btnRef}
        type="button"
        className={`term${seen && !open ? " term-seen" : ""}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={`${term.term} 뜻 보기`}
        onClick={toggle}
      >
        {label}
      </button>
      {open && (
        <span ref={popRef} id={id} className="term-pop" role="note">
          <span className="term-pop-head">
            <strong>{term.term}</strong>
            <button type="button" className="term-close" aria-label="뜻 닫기" onClick={() => { close(); btnRef.current?.focus(); }}>
              ×
            </button>
          </span>
          <span className="term-pop-body">{term.short}</span>
          {term.sources[0] && (
            <Link href={`/sources#${term.sources[0]}`} className="term-more">
              근거 보기 →
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
