// 신호등: 위험(빨강) · 주의(노랑) · 안전(초록) 중 하나만 켜진다. 색만으로 알리지 않도록 옆에 글자도 같이 쓴다.
import type { Verdict } from "@/lib/store/rooms";

const LABEL = { danger: "위험", caution: "주의", safe: "안전" } as const;
const ORDER: Verdict[] = ["danger", "caution", "safe"];
/** 색만으로 알리지 않도록 모양도 함께 (WCAG 1.4.1) */
export const VERDICT_GLYPH = { danger: "▲", caution: "●", safe: "✓" } as const;

export default function TrafficLight({ verdict, size = "md" }: { verdict: Verdict; size?: "sm" | "md" }) {
  return (
    <span className={`signal signal-${size}`}>
      <span className="signal-box" aria-hidden="true">
        {ORDER.map((v) => (
          <span key={v} className={`lamp lamp-${v}${v === verdict ? " lamp-on" : ""}`} />
        ))}
      </span>
      <span className={`signal-glyph signal-label-${verdict}`} aria-hidden="true">
        {VERDICT_GLYPH[verdict]}
      </span>
      <span className={`signal-label verdict-label signal-label-${verdict}`}>{LABEL[verdict]}</span>
    </span>
  );
}
