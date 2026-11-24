// F2 화면이 쓰는 점검 흐름: 입력칸 글자 → 숫자 · 검사 → 읽기 → 판정 → 화면에 보여 줄 이유 목록.
// 화면(React)과 분리해 두어 테스트로 확인한다. 브라우저 안에서만 돌아가며 어디로도 보내지 않는다.
import rules from "@/data/judge.json";
import { findSource } from "@/lib/content";
import { judge, levelOf } from "./judge";
import { readRegistry } from "./read";
import type { CheckInputs, CheckResult, FlagCode, RegistryRead } from "./types";

const MANWON = 10_000;

export type ParsedAmount = { ok: true; won: number | null } | { ok: false; message: string };

/**
 * 만 원 단위 입력칸을 원으로 바꾼다. 빈칸은 null(모름)이고, 0으로 치지 않는다.
 * 허용: "500", "1,000", " 500 ", "500만", "500만원", "1억", "1억 2,000", "1억2000만원"
 */
/** 받침에 맞는 조사: josa("월세", "은", "는") → "월세는", josa("보증금", "은", "는") → "보증금은" */
export const NOT_REGISTRY = "등기부등본 형식을 찾지 못했어요.";

export function josa(word: string, withBatchim: string, without: string): string {
  const last = word.charCodeAt(word.length - 1);
  const hangul = last >= 0xac00 && last <= 0xd7a3;
  return word + (hangul && (last - 0xac00) % 28 !== 0 ? withBatchim : without);
}

export function parseManwon(raw: string, label: string): ParsedAmount {
  const s = raw.replace(/\s/g, "").replace(/,/g, "").replace(/원$/, "");
  if (s === "") return { ok: true, won: null };
  const m = /^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)(?:만)?)?$/.exec(s);
  if (!m || (m[1] === undefined && m[2] === undefined)) {
    return { ok: false, message: `${josa(label, "은", "는")} 숫자로 적어 주세요. 예: 5,000,000 (원)` };
  }
  const manwon = Number(m[1] ?? 0) * 10_000 + Number(m[2] ?? 0);
  if (!Number.isFinite(manwon) || manwon > 1_000_000) {
    return { ok: false, message: `${josa(label, "이", "가")} 너무 커요. 금액을 다시 확인해 주세요.` };
  }
  return { ok: true, won: Math.round(manwon * MANWON) };
}

export interface CheckForm {
  /** 내 보증금 (만 원) */
  myDeposit: string;
  /** 앞선 세입자 보증금 합계 (만 원, 모르면 빈칸) */
  priorDeposits: string;
  /** 건물 시세 (만 원, 모르면 빈칸) */
  marketPrice: string;
  /** 계약하러 올 사람 이름 (모르면 빈칸) */
  contractParty: string;
}

export interface FlagView {
  code: FlagCode;
  level: "danger" | "caution" | "info";
  title: string;
  /** 3줄 요약용 짧은 제목 (judge.json의 short, 없으면 title) */
  short: string;
  /** 무슨 뜻 · 왜 위험한지 (data/judge.json) */
  meaning: string;
  why: string;
  sources: { id: string; title: string; url: string | null; status: "confirmed" | "check" | "not_legal" | "unknown" }[];
  basis?: string;
}

export type CheckOutcome =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      read: RegistryRead;
      /** 읽기 경고 + extraWarnings(전부) */
      warnings: string[];
      /** 읽기 규칙이 못 읽은 칸 경고만(결과 화면의 '직접 확인했어요'로 풀 수 있는 것) */
      readWarnings: string[];
      /** 아직 판정에서 '안전'을 막고 있는 경고(읽기 경고를 확인했으면 extraWarnings만) */
      blocking: string[];
      result: CheckResult;
      flags: FlagView[];
      ratioLines: { caution: number; danger: number };
    };

export function toFlagView(code: FlagCode): FlagView {
  const f = rules.flags[code] as { level: string; title: string; short?: string; meaning: string; why: string; sources: string[]; basis?: string };
  return {
    code,
    level: levelOf(code),
    title: f.title,
    short: f.short ?? f.title,
    meaning: f.meaning,
    why: f.why,
    sources: f.sources.map((id) => {
      const s = findSource(id);
      return { id, title: s?.title ?? id, url: s?.official_url ?? null, status: s?.status ?? "unknown" };
    }),
    basis: f.basis,
  };
}

/**
 * 점검 한 번. edited가 있으면 사용자가 고친 읽기 결과를 쓰고,
 * confirmed가 true면 사용자가 못 읽은 칸을 직접 확인했다는 뜻이라 읽기 경고를 판정에서 뺀다.
 * extraWarnings: 읽기 규칙 밖의 경고(예: 그림 PDF를 원본과 아직 맞춰 보지 않음). confirmed와 상관없이 '안전'을 막는다
 *   (그 경고는 따로 마련한 확인 단계에서만 풀리게, 부르는 쪽이 빼서 넘긴다).
 */
export function runCheck(
  text: string,
  form: CheckForm,
  asOf: string,
  options: { edited?: RegistryRead; confirmed?: boolean; extraWarnings?: string[] } = {},
): CheckOutcome {
  const errors: string[] = [];
  if (!options.edited && text.trim() === "") errors.push("등기부등본 PDF를 올리거나 내용을 붙여 넣어 주세요. 아직 없으면 위의 '인터넷등기소에서 떼기'를 보거나 샘플로 먼저 해 보세요.");

  const my = parseManwon(form.myDeposit, "내 보증금");
  const prior = parseManwon(form.priorDeposits, "앞선 세입자 보증금");
  const market = parseManwon(form.marketPrice, "건물 시세");
  for (const p of [my, prior, market]) if (!p.ok) errors.push(p.message);
  if (my.ok && my.won === null) errors.push("내 보증금을 적어 주세요. 예: 5,000,000 (원)");
  if (form.contractParty.trim().length > 30) errors.push("계약할 사람 이름이 너무 길어요.");
  if (errors.length || !my.ok || !prior.ok || !market.ok) return { ok: false, errors };

  const { read: parsed, warnings: readWarnings } = readRegistry(text);
  const warnings = [...readWarnings, ...(options.extraWarnings ?? [])];
  // 등기부등본이 아닌 글이면 판정(신호등)을 내지 않는다 — 엉뚱한 글에 '주의'가 뜨면 믿을 수 없는 결과처럼 보인다
  if (!options.edited && warnings.some((w) => w.startsWith(NOT_REGISTRY))) {
    return { ok: false, errors: [`${NOT_REGISTRY} 인터넷등기소에서 받은 등기사항전부증명서를 그대로 붙여 넣거나 PDF로 올려 주세요.`] };
  }
  const read = options.edited ?? parsed;
  const inputs: CheckInputs = {
    market_price: market.won,
    prior_deposits: prior.won,
    my_deposit: my.won!,
    contract_party: form.contractParty.trim(),
  };
  const blocking = [...(options.confirmed ? [] : readWarnings), ...(options.extraWarnings ?? [])];
  const result = judge(read, inputs, asOf, blocking);
  return {
    ok: true,
    read,
    warnings,
    readWarnings,
    blocking,
    result,
    flags: result.flags.map(toFlagView),
    ratioLines: { caution: rules.ratio.caution_from, danger: rules.ratio.danger_from },
  };
}

/** 오늘 날짜 YYYY-MM-DD (한국 시간) */
export function todayKST(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 원 → "4억 8,500만 원" */
export function formatWon(won: number): string {
  const man = Math.round(won / MANWON);
  const eok = Math.floor(man / 10_000);
  const rest = man % 10_000;
  if (eok && rest) return `${eok}억 ${rest.toLocaleString("ko-KR")}만 원`;
  if (eok) return `${eok}억 원`;
  return `${rest.toLocaleString("ko-KR")}만 원`;
}

/** 원 금액을 한국어로 끊어 읽기 쉽게: 5 → "5원", 50,000,000 → "5,000만 원", 812,345,678 → "8억 1,234만 5,678원" */
export function readWon(won: number): string {
  const eok = Math.floor(won / 100_000_000);
  const man = Math.floor((won % 100_000_000) / MANWON);
  const rest = won % MANWON;
  const parts = [eok && `${eok.toLocaleString("ko-KR")}억`, man && `${man.toLocaleString("ko-KR")}만`, rest && rest.toLocaleString("ko-KR")].filter(Boolean);
  if (!parts.length) return "0원";
  return parts.join(" ") + (rest ? "원" : " 원");
}
