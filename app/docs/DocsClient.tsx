"use client";
// 서류 · 준비물: 언제 · 누가 챙기는지로 나눠 한곳에 (data/documents.json). ?room=방id 면 그 방에 체크가 저장된다.
// 비용 · 기한 · 필요한 서류는 법령 원문으로 확인한 것만 적고 근거 번호를 단다.
import Link from "next/link";
import docs from "@/data/documents.json";
import { roomHref, withRoom } from "@/lib/store/rooms";
import { useProgress } from "../ui/useProgress";
import HomeLink from "../ui/HomeLink";
import PriorDepositGuide from "../ui/PriorDepositGuide";
import BackButton from "../ui/Back";

interface DocItem {
  id: string;
  when: string;
  only?: string;
  title: string;
  where: string;
  cost: string;
  why: string;
  sources: string[];
  guide?: boolean;
  room?: boolean;
}

const ONLY_LABEL: Record<string, string> = { broker: "중개사를 통해서라면", direct: "직거래라면", shared: "다가구 · 다중주택이면" };
export const docKey = (id: string) => `docs.${id}`;

/** 이 방에 해당하는 서류만 (모르면 보여 주되 '○○라면' 표시) */
export function visibleDocs(branch: string | null, unknowns: string[] | null): { item: DocItem; conditional: boolean }[] {
  return (docs.items as DocItem[]).flatMap((item) => {
    if (item.only === "broker" || item.only === "direct") {
      if (branch && branch !== "none" && branch !== item.only) return [];
      return [{ item, conditional: !branch || branch === "none" }];
    }
    if (item.only === "shared") {
      if (unknowns && !unknowns.includes("prior_deposits")) return [];
      return [{ item, conditional: !unknowns }];
    }
    return [{ item, conditional: false }];
  });
}

export default function DocsClient() {
  const { progress, update, room, roomId, loaded } = useProgress();
  const list = visibleDocs(progress.branch, room?.check?.unknowns ?? null);
  const done = list.filter((d) => progress.checked[docKey(d.item.id)]).length;

  const toggle = (id: string, value: boolean) =>
    update((p) => {
      const checked = { ...p.checked };
      if (value) checked[docKey(id)] = true;
      else delete checked[docKey(id)];
      return { ...p, checked };
    });

  return (
    <main className="container check docs-page">
      <nav className="topbar">
        <BackButton fallback={room ? roomHref(room.id) : "/"} />
        <span>{room ? `${room.label} · 서류 · 준비물` : "서류 · 준비물"}</span>
        <HomeLink />
      </nav>
      <h1 className="title">무엇을 챙기면 되나요?</h1>
      <p className="muted" aria-live="polite">
        {loaded ? `${list.length}개 중 ${done}개 챙겼어요` : " "}
      </p>

      {docs.groups.map((g) => (
        <DocGroup key={g.id} groupId={g.id} list={list} checked={progress.checked} onToggle={toggle} roomId={room?.id ?? null} />
      ))}

      {room && (
        <Link href={withRoom("/steps", roomId)} className="nav-btn">
          다음: 계약 과정 6단계 →
        </Link>
      )}
      <p className="disclaimer">비용 · 기한은 법령 원문 기준(2026-11-17 확인) · 기관마다 조금 다를 수 있어요.</p>
    </main>
  );
}

/** 서류 한 묶음(언제 챙기는지 기준). 서류 화면과 단계 화면(4 · 5단계 안)에서 같이 쓴다 */
export function DocGroup({
  groupId,
  list,
  checked,
  onToggle,
  roomId,
}: {
  groupId: string;
  list: { item: DocItem; conditional: boolean }[];
  checked: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
  roomId: string | null;
}) {
  const g = docs.groups.find((x) => x.id === groupId);
  const items = list.filter((d) => d.item.when === groupId);
  if (!g || !items.length) return null;
  return (
    <section className="docs-group" aria-labelledby={`g-${g.id}`}>
      <h2 id={`g-${g.id}`}>{g.title}</h2>
      <ul className="docs-list">
        {items.map(({ item, conditional }) => {
          const id = `doc-${item.id}`;
          const on = Boolean(checked[docKey(item.id)]);
          return (
            <li key={item.id} className={on ? "doc-done" : undefined}>
              <input id={id} type="checkbox" checked={on} onChange={(e) => onToggle(item.id, e.target.checked)} />
              <div>
                <label htmlFor={id}>
                  {conditional && item.only && <span className="doc-only">{ONLY_LABEL[item.only]}</span>}
                  <strong>{item.title}</strong>
                </label>
                <span className="small muted">{item.why}</span>
                {item.room && roomId && (
                  <Link href={withRoom("/steps/4", roomId)} className="nav-btn nav-btn-sm">
                    다음: 4단계 특약 문장 →
                  </Link>
                )}
                {/* 어디서 · 얼마 · 근거는 펼쳐야 보이게(11/28 첫 화면 글자 줄이기) */}
                {(item.where || item.cost || item.sources.length > 0 || item.guide) && (
                  <details className="doc-more">
                    <summary className="small">어디서 · 얼마</summary>
                    {(item.where || item.cost) && <span className="small doc-meta">{[item.where, item.cost].filter(Boolean).join(" · ")}</span>}
                    {item.sources.length > 0 && (
                      <span className="small muted">
                        근거{" "}
                        {item.sources.map((s, i) => (
                          <span key={s}>
                            {i > 0 && " · "}
                            <Link href={`/sources#${s}`}>{s}</Link>
                          </span>
                        ))}
                      </span>
                    )}
                    {item.guide && <PriorDepositGuide />}
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
