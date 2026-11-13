// F2 위험 판정. 읽은 값(RegistryRead) + 사용자가 넣은 값(CheckInputs)으로 안전 · 주의 · 위험을 정한다.
// 기준값 · 이유 문구 · 근거는 data/judge.json에만 두고, 여기서는 규칙만 적용한다.
// 같은 입력이면 항상 같은 결과가 나오도록, "오늘"도 인자로 받는다.
import rules from "@/data/judge.json";
import type { CheckInputs, CheckResult, FlagCode, RegistryRead, RiskType, Verdict } from "./types";

type Level = "danger" | "caution" | "info";

const FLAG_ORDER = Object.keys(rules.flags) as FlagCode[];
const LEVEL_RANK: Record<Level, number> = { danger: 0, caution: 1, info: 2 };

const RISK_FLAG: Record<RiskType, FlagCode> = {
  신탁: "trust",
  가처분: "provisional_disposition",
  가등기: "provisional_registration",
  경매개시결정: "auction",
  임차권등기: "lease_registration",
};

export function levelOf(flag: FlagCode): Level {
  return rules.flags[flag].level as Level;
}

/** 이름 비교용: 띄어쓰기를 지우고 비교한다 ("김 도윤" = "김도윤") */
const sameName = (a: string, b: string) => a.replace(/\s/g, "") === b.replace(/\s/g, "");

/** asOf 기준으로 date가 최근 months개월 안인지 (YYYY-MM-DD) */
function withinMonths(date: string, asOf: string, months: number): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  const limit = new Date(`${asOf}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(limit.getTime())) return false;
  limit.setUTCMonth(limit.getUTCMonth() - months);
  return d >= limit;
}

function ownerFlags(read: RegistryRead, party: string): FlagCode[] {
  if (!party.trim() || !read.current_owner) return ["owner_unchecked"];
  const owners = read.current_owner.split(", ");
  if (owners.some((o) => sameName(o, party))) return owners.length > 1 ? ["co_owned"] : [];
  if (read.previous_owners.some((o) => sameName(o, party))) return ["owner_mismatch_previous_owner"];
  return ["owner_mismatch"];
}

export function judge(read: RegistryRead, inputs: CheckInputs, asOf: string): CheckResult {
  const mortgage_total = read.active_mortgages.reduce((sum, m) => sum + m.max_claim, 0);

  const { market_price, prior_deposits, my_deposit } = inputs;
  const ratio =
    market_price && market_price > 0
      ? Math.round(((mortgage_total + prior_deposits + my_deposit) / market_price) * 1000) / 10
      : null;

  const flags = new Set<FlagCode>(ownerFlags(read, inputs.contract_party));
  for (const r of read.risk_records) flags.add(RISK_FLAG[r.type]);
  if (read.seizures.length) flags.add("seizure");

  if (ratio === null) flags.add("ratio_unknown");
  else if (ratio >= rules.ratio.danger_from) flags.add("ratio_danger");
  else if (ratio >= rules.ratio.caution_from) flags.add("ratio_caution");

  if (read.erased_risk_records.some((r) => r.type === "임차권등기")) flags.add("past_lease_registration");
  if (
    read.last_ownership_transfer &&
    withinMonths(read.last_ownership_transfer, asOf, rules.recent_transfer_months)
  ) {
    flags.add("recent_transfer");
  }

  const sorted = [...flags].sort(
    (a, b) => LEVEL_RANK[levelOf(a)] - LEVEL_RANK[levelOf(b)] || FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b),
  );
  const verdict: Verdict = sorted.some((f) => levelOf(f) === "danger")
    ? "danger"
    : sorted.some((f) => levelOf(f) === "caution")
      ? "caution"
      : "safe";

  return { mortgage_total, ratio, verdict, flags: sorted };
}
