// 6칸 진행 막대. 색만으로 구분하지 않도록 화면 읽기 도구용 문장을 같이 붙인다.
import type { Seg } from "./roomView";

const SEG_WORD: Record<Seg, string> = { done: "완료", current: "지금", todo: "남음", skipped: "건너뜀" };

export default function StepBar({ segs, finish = false }: { segs: Seg[]; finish?: boolean }) {
  const label = segs.map((s, i) => `${i + 1}단계 ${SEG_WORD[s]}`).join(", ");
  return (
    <div className="stepbar" role="img" aria-label={label}>
      {segs.map((s, i) => (
        <span key={i} className={`seg seg-${s}`} />
      ))}
      {finish && (
        <svg className="stepbar-flag" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 21V4" />
          <path d="M5 4h11l-2 4 2 4H5" />
        </svg>
      )}
    </div>
  );
}
