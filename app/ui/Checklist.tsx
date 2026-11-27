"use client";
// 체크리스트 한 묶음: 할 일(체크) · 왜 중요해요? · 근거 링크 · 등기부등본 점검으로 가기.
import Link from "next/link";
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
}: {
  groupId: string;
  items: ChecklistItem[];
  checked: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
  /** 항목마다 [할 일, 왜 중요해요] 순서로 미리 나눈 용어 조각 */
  segments: Segment[][][];
}) {
  return (
    <ul className="checklist">
      {items.map((item, idx) => {
        const key = itemKey(groupId, item.id);
        const done = Boolean(checked[key]);
        const inputId = `chk-${key}`;
        return (
          <li key={key} className={done ? "done" : undefined}>
            <div className="check-row">
              <input
                id={inputId}
                type="checkbox"
                aria-labelledby={`${inputId}-text`}
                checked={done}
                onChange={(e) => onToggle(key, e.target.checked)}
              />
              {/* 용어 버튼이 들어가므로 label 대신 aria-labelledby로 이름을 붙인다 */}
              <span id={`${inputId}-text`} className="check-text">
                <TermText segments={segments[idx][0]} />
                {item.optional && <span className="optional"> (해당 없으면 건너뛰어도 돼요)</span>}
              </span>
            </div>
            {(item.good || item.bad) && (
              <dl className="criteria">
                {item.good && (
                  <>
                    <dt className="criteria-good">✓ 이러면 괜찮아요</dt>
                    <dd>{item.good}</dd>
                  </>
                )}
                {item.bad && (
                  <>
                    <dt className="criteria-bad">▲ 이러면 다시 보세요</dt>
                    <dd>{item.bad}</dd>
                  </>
                )}
              </dl>
            )}
            <details className="why">
              <summary>왜 중요해요?</summary>
              <p>
                <TermText segments={segments[idx][1]} />
              </p>
              {item.sources.length > 0 && (
                <p className="small">
                  근거{" "}
                  {item.sources.map((id, i) => (
                    <span key={id}>
                      {i > 0 && " · "}
                      <Link href={`/sources#${id}`}>{id}</Link>
                    </span>
                  ))}
                </p>
              )}
            </details>
            {item.opens === "F2" && (
              <Link href="/check" className="cta small-cta">
                등기부등본 점검하러 가기
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
