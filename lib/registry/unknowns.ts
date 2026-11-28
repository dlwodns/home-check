// 등기부등본만으로는 알 수 없는 것 — 결과에 항상 함께 보여 준다(초록불 하나로 끝내지 않기, docs/BENCHMARK.md).
// '안전'도 "확인한 범위 안에서"라는 뜻이라, 무엇을 확인하지 못했는지 구체적으로 적는다.
import type { CheckResult, RegistryRead } from "./types";

export interface Unknown {
  id: string;
  /** 짧은 이름 (가족 요약 · 개수 표시에 씀) */
  short: string;
  title: string;
  how: string;
  sources: string[];
}

const ALL: Record<string, Unknown> = {
  prior_deposits: {
    id: "prior_deposits",
    short: "앞선 세입자 보증금",
    title: "먼저 사는 세입자들의 보증금 합계",
    how: "다가구 · 다중주택은 등기부등본에 나오지 않아요. 집주인 동의를 받아 주민센터에서 확인해요.",
    sources: ["S6", "S23"],
  },
  tax: {
    id: "tax",
    short: "집주인 세금 체납",
    title: "집주인의 국세 · 지방세 체납",
    how: "세금이 밀리면 보증금보다 먼저 가져갈 수 있어요. 계약할 때 납세증명서를 보여 달라고 하세요(집주인이 보여 줘야 해요).",
    sources: ["S5"],
  },
  identity: {
    id: "identity",
    short: "진짜 집주인인지",
    title: "계약하러 온 사람이 진짜 집주인인지",
    how: "여기서는 이름만 비교했어요. 신분증을 직접 보고, 대리인이면 위임장과 인감증명서를 확인해요.",
    sources: ["S11"],
  },
  building: {
    id: "building",
    short: "불법 개조 · 건물 용도",
    title: "불법 개조 · 건물 용도",
    how: "건축물대장에서 '위반건축물' 표시와 실제 용도(주택인지)를 확인해요.",
    sources: ["S22"],
  },
  trust_deed: {
    id: "trust_deed",
    short: "신탁원부 내용",
    title: "신탁원부 내용 (누가 세를 놓을 수 있는지)",
    how: "신탁된 집은 신탁회사 동의 없이 맺은 계약이 보호받기 어려울 수 있어요. 신탁원부를 떼어 확인해요.",
    sources: ["S13"],
  },
  market: {
    id: "market",
    short: "건물 시세",
    title: "건물 시세가 맞는지",
    how: "빚 비율은 직접 적은 시세로 계산했어요. HUG 안심전세 앱이나 실거래가로 한 번 더 확인해요.",
    sources: ["S8", "S10"],
  },
  later_changes: {
    id: "later_changes",
    short: "뗀 뒤 생긴 변화",
    title: "등기부등본을 뗀 뒤 생긴 변화",
    how: "계약하는 날과 잔금 치르기 전에 등기부등본을 다시 떼어, 새로 생긴 근저당 · 압류가 없는지 봐요.",
    sources: [],
  },
};

export const UNKNOWN_IDS = Object.keys(ALL);
export const unknownById = (id: string): Unknown | undefined => ALL[id];

const SHARED_BUILDING = /다가구|다중|단독|근린/;
/** 한 건물을 여러 세입자가 나눠 쓰는 집(다가구 등)인가. 종류를 못 읽었으면 조심해서 그렇다고 본다 */
export const isSharedBuilding = (type: string) => !type || SHARED_BUILDING.test(type);

/** 이 결과에서 '등기부로는 알 수 없는 것' (확인한 순서대로 중요한 것부터) */
export function unknownsFor(read: Pick<RegistryRead, "building_type">, result: Pick<CheckResult, "flags" | "ratio">): Unknown[] {
  const ids: string[] = [];
  const shared = isSharedBuilding(read.building_type);
  if (result.flags.includes("prior_deposits_unknown") && shared) ids.push("prior_deposits");
  ids.push("tax", "identity", "building");
  if (result.flags.includes("trust")) ids.push("trust_deed");
  if (result.ratio !== null) ids.push("market");
  ids.push("later_changes");
  return ids.map((id) => ALL[id]);
}
