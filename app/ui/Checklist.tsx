"use client";
// 체크리스트 한 묶음(11/28 UX 정리): 한 줄 목록. 줄(네모 + 글자) 어디를 눌러도 체크되고, 오른쪽 ⓘ는 '왜 중요해요? · 근거'를 시트로 연다.
// 집 보기 기준(✓ 괜찮아요 / ▲ 다시 보세요)은 줄 아래에 그대로 보인다. 등기부 점검 항목에는 점검 버튼 · 결과(checkSlot)가 붙는다.
import Link from "next/link";
import { useState } from "react";
import Sheet from "./Sheet";
import type { ChecklistItem } from "@/lib/content";
import type { Segment } from "@/lib/content/terms";
import { itemKey } from "@/lib/store/progress";
import TermText from "./TermText";

export default function Checklist({
  groupId,
  items,
  checked,
  onToggle,
  segments,
  checkSlot,
  extra,
}: {
  groupId: string;
  items: ChecklistItem[];
  checked: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
  /** 항목마다 [할 일, 왜 중요해요] 순서로 미리 나눈 용어 조각 */
  segments: Segment[][][];
  /** '등기부등본 점검' 항목(opens F2) 아래에 넣을 것(방 안이면 그 방 점검으로 가는 버튼 · 결과). 없으면 기본 버튼 */
  checkSlot?: React.ReactNode;
  /** 항목 id → 줄 아래에 붙일 안내(예: 건축물대장을 계약 방법에 따라 어떻게 확인하는지) */
  extra?: Record<string, React.ReactNode>;
}) {
  const [why, setWhy] = useState<number | null>(null);
  const open = why === null ? null : items[why];
  return (
    <>
      <ul className="checklist">
        {items.map((item, idx) => {
          const key = itemKey(groupId, item.id);
          const done = Boolean(checked[key]);
          const inputId = `chk-${key}`;
          return (
            <li key={key} className={done ? "done" : undefined}>
              <div className="check-row">
                {/* 줄 전체가 label이라 글자를 눌러도 체크된다(안의 용어 버튼은 눌러도 체크되지 않고 뜻만 연다) */}
                <label className="check-hit" htmlFor={inputId}>
                  <input id={inputId} type="checkbox" aria-labelledby={`${inputId}-text`} checked={done} onChange={(e) => onToggle(key, e.target.checked)} />
                  <span id={`${inputId}-text`} className="check-text">
                    <TermText segments={segments[idx][0]} />
                    {item.optional && <span className="optional"> (해당 없으면 건너뛰어도 돼요)</span>}
                    {done && <span className="done-badge">✓ 했어요</span>}
                  </span>
                </label>
                <button type="button" className="why-btn" onClick={() => setWhy(idx)} aria-label={`왜 중요해요? ${item.text}`}>
                  ⓘ
                </button>
              </div>
              {(item.good || item.bad) && (
                <dl className="criteria">
                  {item.good && (
                    <>
                      <dt className="criteria-good"><span aria-hidden="true">✓</span><span className="visually-hidden">이러면 괜찮아요</span></dt>
                      <dd>{item.good}</dd>
                    </>
                  )}
                  {item.bad && (
                    <>
                      <dt className="criteria-bad"><span aria-hidden="true">▲</span><span className="visually-hidden">이러면 다시 보세요</span></dt>
                      <dd>{item.bad}</dd>
                    </>
                  )}
                </dl>
              )}
              {extra?.[item.id] && <div className="check-extra">{extra[item.id]}</div>}
              {item.opens === "F2" &&
                (checkSlot ?? (
                  <Link href="/check" className="cta small-cta">
                    다음: 등기부등본 점검 →
                  </Link>
                ))}
            </li>
          );
        })}
      </ul>
      <Sheet title="왜 중요해요?" open={open !== null} onClose={() => setWhy(null)}>
        {open && why !== null && (
          <>
            <p className="sheet-item">{open.text}</p>
            <p>
              <TermText segments={segments[why][1]} />
            </p>
            {open.sources.length > 0 && (
              <p className="small">
                근거{" "}
                {open.sources.map((id, i) => (
                  <span key={id}>
                    {i > 0 && " · "}
                    <Link href={`/sources#${id}`}>{id}</Link>
                  </span>
                ))}
              </p>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
