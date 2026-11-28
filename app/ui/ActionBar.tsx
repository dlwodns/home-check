// 흐름 화면의 주 버튼 자리(11/28 UX 정리): 화면 아래 엄지가 닿는 곳에 '주 버튼 하나'를 고정한다.
// 이전은 맨 위 ←(방금 보던 화면)가 맡고, 여기에는 필요할 때만 작은 '← 이전'을 둔다(긴 이름은 화면 읽기용 이름으로).
import Link from "next/link";
import type { ReactNode } from "react";

type Act = { label: string; href?: string; onClick?: () => void; aria?: string };

const Btn = ({ a, cls }: { a: Act; cls: string }) =>
  a.href ? (
    <Link href={a.href} className={cls} aria-label={a.aria} onClick={a.onClick}>
      {a.label}
    </Link>
  ) : (
    <button type="button" className={cls} aria-label={a.aria} onClick={a.onClick}>
      {a.label}
    </button>
  );

export default function ActionBar({ primary, prev, note, extra }: { primary: Act; prev?: Act; note?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="action-bar">
      {note && <div className="action-note">{note}</div>}
      <div className="action-row">
        {prev && <Btn a={prev} cls="action-prev" />}
        <Btn a={primary} cls="action-primary" />
      </div>
      {extra}
    </div>
  );
}
