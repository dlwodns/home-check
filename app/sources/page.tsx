// 근거 목록 화면. 점검 결과의 "근거 S8" 같은 링크가 여기로 온다(/sources#S8).
// docs/SOURCES.md에서 뽑은 data/sources.json을 그대로 보여 주고, 공식 확인 상태를 숨기지 않는다.
import type { Metadata } from "next";
import Link from "next/link";
import { sources, type SourceStatus } from "@/lib/content";
import HomeLink from "../ui/HomeLink";
import BackButton from "../ui/Back";

export const metadata: Metadata = {
  title: "근거 목록 · 홈체크",
  description: "홈체크가 안내하는 법 · 제도 · 기준이 어디에 근거하는지 모아 둔 목록이에요.",
};

const STATUS: Record<SourceStatus, { label: string; note: string }> = {
  confirmed: { label: "법령 원문 확인", note: "법령 원문이나 공공기관 자료로 직접 확인했어요." },
  check: { label: "원문 확인 중", note: "기사 · 해설 자료로 확인했고, 법령 원문 대조를 진행 중이에요." },
  not_legal: { label: "법정 기준 아님", note: "법으로 정한 기준이 아니라 많이 쓰는 참고선이거나 홈체크가 정한 참고 기준이에요." },
};

export default function SourcesPage() {
  return (
    <main className="container check">
      <nav className="topbar">
        <BackButton fallback={"/check"} />
        <HomeLink />
        <span>근거 목록</span>
      </nav>
      <p className="muted small">
        홈체크의 안내는 아래 근거를 바탕으로 해요. 법은 바뀔 수 있으니 계약 전에는 공식 링크에서 한 번 더 확인해 주세요.
      </p>
      <ol className="sources">
        {sources.map((s) => (
          <li key={s.id} id={s.id} className="card">
            <p className="source-head">
              <strong>{s.id}</strong> <span className={`badge badge-${s.status}`}>{STATUS[s.status].label}</span>
            </p>
            <h2>{s.title}</h2>
            <p className="small">{s.summary}</p>
            <p className="small muted">{STATUS[s.status].note}</p>
            <ul className="links">
              {s.official_url && (
                <li>
                  <a href={s.official_url} target="_blank" rel="noopener noreferrer">
                    공식 확인 링크
                  </a>
                </li>
              )}
              {s.refs.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    참고: {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
