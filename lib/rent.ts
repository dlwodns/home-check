// F6 동네 원룸 시세: 국토부 전월세 신고 자료(단독 · 다가구 · 연립 · 다세대 · 오피스텔)를 읽고, 같은 동의 보증금 · 월세 분포를 계산한다.
// 화면 · 서버 어디서나 쓰는 순수 함수만 둔다(키 · 네트워크 없음 → 테스트 가능).

export interface RentDeal {
  dong: string;
  /** 만 원 */
  deposit: number;
  /** 만 원, 0이면 전세 */
  rent: number;
  houseType: string;
}

export type RentXml = { ok: true; deals: RentDeal[]; total: number } | { ok: false; code: string };

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block);
  return m ? m[1].trim() : "";
};
const amount = (s: string) => {
  const n = Number(s.replace(/[,\s]/g, ""));
  return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** XML 응답 → 거래 목록. resultCode 000은 성공, 03은 '자료 없음'(빈 목록), 그 밖은 실패. */
export function parseRentXml(xml: string): RentXml {
  const code = tag(xml, "resultCode") || tag(xml, "returnReasonCode") || "unknown";
  if (code === "03") return { ok: true, deals: [], total: 0 };
  if (code !== "000" && code !== "00") return { ok: false, code };
  const deals: RentDeal[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const deposit = amount(tag(b, "deposit"));
    const rent = amount(tag(b, "monthlyRent"));
    const dong = tag(b, "umdNm");
    if (deposit === null || rent === null || !dong) continue; // 못 읽은 거래는 0으로 치지 않고 뺀다
    deals.push({ dong, deposit, rent, houseType: tag(b, "houseType") });
  }
  return { ok: true, deals, total: Number(tag(xml, "totalCount")) || deals.length };
}

export interface Spread {
  p25: number;
  mid: number;
  p75: number;
}

export interface RentStats {
  dong: string;
  months: string[];
  /** 월세 거래 (월세 > 0) */
  monthly: { count: number; deposit: Spread; rent: Spread } | null;
  /** 전세 거래 (월세 = 0) */
  jeonse: { count: number; deposit: Spread } | null;
  /** 받아 온 주택 종류(서버가 붙임). 없으면 예전 응답(단독 · 다가구만) */
  types?: string[];
}

/** 사분위(25% · 50% · 75%) — 정렬 후 선형 보간 */
export function spread(values: number[]): Spread {
  const v = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const i = (v.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return Math.round(v[lo] + (v[hi] - v[lo]) * (i - lo));
  };
  return { p25: q(0.25), mid: q(0.5), p75: q(0.75) };
}

export function summarizeRent(deals: RentDeal[], dong: string, months: string[]): RentStats {
  const same = deals.filter((d) => d.dong === dong);
  const monthly = same.filter((d) => d.rent > 0);
  const jeonse = same.filter((d) => d.rent === 0);
  return {
    dong,
    months,
    monthly: monthly.length
      ? { count: monthly.length, deposit: spread(monthly.map((d) => d.deposit)), rent: spread(monthly.map((d) => d.rent)) }
      : null,
    jeonse: jeonse.length ? { count: jeonse.length, deposit: spread(jeonse.map((d) => d.deposit)) } : null,
  };
}

/** 이번 달부터 거꾸로 n개월 (YYYYMM, 한국 시간 기준) */
export function monthsBack(n: number, now = new Date()): string[] {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  let y = kst.getUTCFullYear();
  let m = kst.getUTCMonth() + 1;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${y}${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export const FEW_DEALS = 5;
export const NEAR = 0.15;

export type Compare =
  | { level: "none"; text: string }
  | { level: "few"; text: string; count: number }
  | { level: "high" | "similar" | "low"; text: string; count: number };

/** 이 방이 동네 신고 거래와 비교해 어느 정도인지. 거래가 적으면 비교하지 않는다(0이나 '적정'으로 치지 않음). */
export function compareRoom(room: { deposit: number; rent: number | null }, stats: RentStats): Compare {
  const isMonthly = (room.rent ?? 0) > 0;
  const group = isMonthly ? stats.monthly : stats.jeonse;
  const kind = isMonthly ? "월세" : "전세";
  if (!group) return { level: "none", text: `최근 ${stats.months.length}개월 동안 이 동네 ${kind} 신고 거래가 없어요` };
  if (group.count < FEW_DEALS) return { level: "few", count: group.count, text: `거래 기록이 적어요 (${group.count}건) · 비교는 참고만 해 주세요` };
  const mine = isMonthly ? room.rent! : room.deposit;
  const mid = isMonthly ? stats.monthly!.rent.mid : stats.jeonse!.deposit.mid;
  const diff = mid > 0 ? (mine - mid) / mid : 0;
  const what = isMonthly ? "월세가" : "보증금이";
  if (diff > NEAR) return { level: "high", count: group.count, text: `${what} 동네 중간값보다 높은 편이에요` };
  if (diff < -NEAR) return { level: "low", count: group.count, text: `${what} 동네 중간값보다 낮은 편이에요` };
  return { level: "similar", count: group.count, text: `${what} 동네 중간값과 비슷해요` };
}

/** ["202606", …, "202611"] → "2026년 6월–11월" (해가 바뀌면 "2025년 12월–2026년 5월") */
export function monthSpan(months: string[]): string {
  if (!months.length) return "";
  const [a, b] = [[...months].sort()[0], [...months].sort().at(-1)!];
  const y = (m: string) => m.slice(0, 4), mo = (m: string) => Number(m.slice(4));
  if (a === b) return `${y(a)}년 ${mo(a)}월`;
  return y(a) === y(b) ? `${y(a)}년 ${mo(a)}월–${mo(b)}월` : `${y(a)}년 ${mo(a)}월–${y(b)}년 ${mo(b)}월`;
}
