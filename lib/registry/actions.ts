// F3 다음 행동 카드: 판정 이유마다 정해 둔 문장 틀(data/actions.json)을 채워 질문 · 할 일 · 특약 · 가족 · 지인 요약을 만든다.
// 외부 AI를 쓰지 않고, 같은 결과면 항상 같은 문장이 나온다.
import data from "@/data/actions.json";
import { findSource } from "@/lib/content";
import { formatWon, toFlagView } from "./check";
import { unknownsFor } from "./unknowns";
import type { CheckResult, FlagCode, RegistryRead } from "./types";

interface FlagActions {
  ask?: string[];
  todo?: string[];
  clauses?: string[];
}

interface ClauseData {
  title: string;
  text: string;
  sources: string[];
  basis: string;
}

export interface ClauseView {
  id: string;
  title: string;
  text: string;
  basis: string;
  sources: { id: string; title: string }[];
}

export interface NextActions {
  questions: string[];
  todos: string[];
  clauses: ClauseView[];
  parentSummary: string;
}

const VERDICT_WORD = { safe: "안전", caution: "주의", danger: "위험" } as const;

/** "2026-09-01" → "2026년 9월 1일" */
function koreanDate(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : "최근";
}

/** {이름} 자리를 채운다. 모르는 자리는 남겨 두지 않고 "확인 필요"로 바꾼다. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "확인 필요");
}

export function buildActions(read: RegistryRead, result: CheckResult): NextActions {
  const flags = data.flags as Record<string, FlagActions>;
  const clauses = data.clauses as Record<string, ClauseData>;
  const values: Record<string, string> = {
    transferDate: koreanDate(read.last_ownership_transfer),
    mortgageTotal: formatWon(result.mortgage_total),
    ratio: result.ratio === null ? "확인 필요" : `${result.ratio}%`,
  };

  const questions: string[] = [];
  const todos: string[] = [];
  const clauseIds: string[] = [];
  const add = (list: string[], items: string[] = []) => {
    for (const t of items) {
      const s = fill(t, values);
      if (!list.includes(s)) list.push(s);
    }
  };

  for (const code of result.flags) {
    const a = flags[code] ?? {};
    add(questions, a.ask);
    add(todos, a.todo);
    for (const c of a.clauses ?? []) if (!clauseIds.includes(c)) clauseIds.push(c);
  }
  add(todos, data.always.todo);
  for (const c of data.always.clauses) if (!clauseIds.includes(c)) clauseIds.push(c);

  return {
    questions,
    todos,
    clauses: clauseIds.map((id) => {
      const c = clauses[id];
      return {
        id,
        title: c.title,
        text: c.text,
        basis: c.basis,
        sources: c.sources.map((sid) => ({ id: sid, title: findSource(sid)?.title ?? sid })),
      };
    }),
    parentSummary: parentSummary(result, todos, unknownsFor(read, result).map((u) => u.short)),
  };
}

/**
 * 가족 · 지인에게 보낼 요약. 집주인 이름 · 주소 같은 다른 사람의 개인정보는 넣지 않는다.
 * 참고 안내(info)는 빼고 위험 · 주의 이유와 할 일 3개까지만 넣어 짧게 유지한다.
 */
function parentSummary(result: CheckResult, todos: string[], unknowns: string[]): string {
  const reasons = result.flags
    .map((f: FlagCode) => toFlagView(f))
    .filter((f) => f.level !== "info")
    .map((f) => `· ${f.title}`);
  const lines = [
    `[홈체크] 등기부등본 점검 결과: ${VERDICT_WORD[result.verdict]}`,
    ...(reasons.length ? reasons : ["· 확인한 범위 안에서는 큰 위험 신호가 없었어요"]),
    result.ratio !== null ? `· 빚 + 보증금 = 건물 시세의 ${result.ratio}% (70 · 80%는 참고선)` : null,
    unknowns.length ? `· 등기부로는 알 수 없어 따로 확인할 것: ${unknowns.join(" · ")}` : null,
    "",
    "다음에 할 일",
    ...todos.slice(0, 3).map((t, i) => `${i + 1}. ${t}`),
    "",
    "참고용 안내예요. 최종 확인은 공인중개사 · 전문가에게 받을게요.",
  ];
  return lines.filter((l) => l !== null).join("\n");
}
