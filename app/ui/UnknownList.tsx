// '등기부등본으로는 알 수 없는 것' — 판정과 상관없이 결과에 항상 보여 준다.
import Link from "next/link";
import type { Unknown } from "@/lib/registry/unknowns";

export default function UnknownList({ items }: { items: Unknown[] }) {
  if (!items.length) return null;
  return (
    <details className="card unknowns">
      <summary>
        <strong>등기부등본으로는 알 수 없는 것 {items.length}가지</strong>
        <span className="small muted">따로 확인해야 보증금을 지킬 수 있어요</span>
      </summary>
      <ul>
        {items.map((u) => (
          <li key={u.id}>
            <strong>{u.title}</strong>
            <span className="small">{u.how}</span>
            {u.sources.length > 0 && (
              <span className="small muted">
                근거{" "}
                {u.sources.map((s, i) => (
                  <span key={s}>
                    {i > 0 && " · "}
                    <Link href={`/sources#${s}`}>{s}</Link>
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
