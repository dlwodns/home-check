"use client";
// 계약까지 가는 길(세로 한 줄). 방이 있든 없든 같은 모양을 쓴다(11/28 UX: 사용자가 익히는 화면은 '길' 하나).
// 끝낸 단계는 다시 보기, 지금 단계는 카드로 펼치고, 아직 안 온 단계는 누르면 '앞 단계부터'라고 알린다.
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "./Toast";

export type PathRow = { key: string; no: number | "✓"; title: string; status: "done" | "current" | "locked" | "skipped"; href?: string; caption?: ReactNode; lockedHint?: string };

export default function PathList({ rows, current }: { rows: PathRow[]; current: ReactNode }) {
  return (
    <ol className="path" aria-label="계약까지 가는 길">
      {rows.map((row) => {
        if (row.status === "current")
          return (
            <li key={row.key} className="path-step path-current" aria-current="step">
              <span className="path-dot" aria-hidden="true">{row.no}</span>
              <div className="path-body card focus-card">{current}</div>
            </li>
          );
        if (row.status === "skipped")
          return (
            <li key={row.key} className="path-step path-skipped">
              <span className="path-dot" aria-hidden="true">✓</span>
              <span className="path-body">
                <span className="small muted">{row.title}</span>
              </span>
            </li>
          );
        const done = row.status === "done";
        return (
          <li key={row.key} className={`path-step ${done ? "path-done" : "path-locked"}`}>
            <span className="path-dot" aria-hidden="true">{done ? "✓" : row.no}</span>
            <span className="path-body">
              {done && row.href ? (
                <Link href={row.href} className="path-title">
                  {row.no}. {row.title} <span className="small muted">· 다시 보기</span>
                </Link>
              ) : (
                <button type="button" className="path-title path-title-locked" onClick={() => toast(row.lockedHint ?? "앞 단계부터 차례대로 해요")}>
                  {row.no}. {row.title}
                </button>
              )}
              {row.caption}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
