"use client";
// 문장 속 어려운 용어에 점선 밑줄을 긋고, 누르면 바로 아래에 한 줄 설명을 펼친다(용어 사전 data/glossary.json).
import { useId, useState } from "react";
import type { Segment } from "@/lib/content/terms";
import type { Term } from "@/lib/content";

/** segments는 lib/content/terms의 splitAll로 화면 단위에서 미리 나눈 것 */
export default function TermText({ segments }: { segments: Segment[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();
  const opened = segments.find((s) => s.term?.id === open)?.term;

  return (
    <>
      {segments.map((s, i) =>
        s.term ? (
          <TermButton
            key={i}
            term={s.term}
            label={s.text}
            expanded={open === s.term.id}
            controls={`${baseId}-${s.term.id}`}
            onToggle={() => setOpen((o) => (o === s.term!.id ? null : s.term!.id))}
          />
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
      {opened && (
        <span id={`${baseId}-${opened.id}`} className="term-note" role="note">
          <strong>{opened.term}</strong>: {opened.short}
        </span>
      )}
    </>
  );
}

function TermButton(props: { term: Term; label: string; expanded: boolean; controls: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="term"
      aria-expanded={props.expanded}
      aria-controls={props.controls}
      title={`${props.term.term} 뜻 보기`}
      onClick={(e) => {
        props.onToggle();
      }}
    >
      {props.label}
    </button>
  );
}
