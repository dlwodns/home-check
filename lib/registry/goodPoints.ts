// 점검 결과의 "괜찮은 점": 걸린 이유가 없는 항목을 초록으로 보여 준다(초록불 없는 신호등이 되지 않게).
// 못 읽은 칸이 있으면(read_incomplete) 아무것도 "괜찮다"고 말하지 않는다 — 못 읽은 값을 안전으로 치지 않는 원칙.
import type { CheckResult, FlagCode } from "./types";

const OWNER: FlagCode[] = ["owner_mismatch", "owner_mismatch_previous_owner", "owner_unchecked"];
const RECORDS: FlagCode[] = ["seizure", "trust", "provisional_disposition", "provisional_registration", "auction"];
const LEASE: FlagCode[] = ["lease_registration", "past_lease_registration"];

export function goodPoints(result: Pick<CheckResult, "flags" | "ratio">, lines: { caution: number }): string[] {
  const has = (codes: FlagCode[]) => codes.some((c) => result.flags.includes(c));
  if (has(["read_incomplete"])) return [];
  const out: string[] = [];
  if (!has(OWNER)) out.push("계약 상대가 등기부등본의 지금 집주인이에요");
  if (!has(RECORDS)) out.push("압류 · 신탁 · 가처분 · 가등기 · 경매 기록이 없어요");
  if (!has(LEASE)) out.push("앞 세입자가 보증금을 못 받아 남긴 임차권등기가 없어요");
  if (result.ratio !== null && result.ratio < lines.caution) {
    out.push(`빚과 보증금을 합쳐도 시세의 ${result.ratio}%예요 (참고선 ${lines.caution}% 아래)`);
  }
  return out;
}

/** 위험 · 주의 이유 개수 → 큰 제목 */
export function headline(verdict: CheckResult["verdict"], count: number): string {
  if (count > 0) return `계약 전에 확인할 것이 ${count}가지 있어요`;
  return verdict === "safe" ? "확인한 범위 안에서는 큰 위험 신호가 없어요" : "계약 전에 한 번 더 확인해 주세요";
}

/**
 * 큰 제목 아래 3줄 요약: 가장 먼저 볼 것 · 지금 할 일 · 괜찮은 점과 알 수 없는 것 개수 (직방 지킴 진단 '종합 의견'처럼 짧게)
 * @param topReason 위험 · 주의 이유 중 가장 급한 것의 제목 (없으면 null)
 */
export function summaryLines(topReason: string | null, firstTodo: string | null, goodCount: number, unknownCount: number): string[] {
  const lines: string[] = [];
  lines.push(topReason ? `가장 먼저: ${topReason}` : "등기부등본에서 위험 기록은 찾지 못했어요");
  if (firstTodo) lines.push(`지금 할 일: ${firstTodo}`);
  lines.push(`괜찮은 점 ${goodCount}가지 · 등기부로는 알 수 없는 것 ${unknownCount}가지`);
  return lines;
}
