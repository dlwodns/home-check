// F2 등기부등본 점검에서 쓰는 값의 모양. samples/expected.json과 같은 이름을 쓴다.
// 읽기(11/11)와 판정(11/12) 코드가 이 타입을 채운다.

export interface Mortgage {
  /** 채권최고액(원) */
  max_claim: number;
  creditor: string;
}

export interface Seizure {
  /** 압류 · 가압류 */
  type: "압류" | "가압류";
  /** 청구금액(원) */
  amount: number;
  creditor: string;
  /** 접수일 YYYY-MM-DD */
  date: string;
}

/** 규칙 기반 읽기 결과 (expected.json의 read) */
export interface RegistryRead {
  address: string;
  building_type: string;
  current_owner: string;
  active_mortgages: Mortgage[];
  erased_mortgages: Mortgage[];
  seizures: Seizure[];
  /** 가장 최근 소유권 이전 접수일 YYYY-MM-DD, 없으면 null */
  last_ownership_transfer: string | null;
}

/** 사용자가 직접 넣는 값 (expected.json의 inputs, 금액 단위 원) */
export interface CheckInputs {
  market_price: number;
  prior_deposits: number;
  my_deposit: number;
  contract_party: string;
}

export type Verdict = "safe" | "caution" | "danger";

/** 판정 결과 (expected.json의 expected) */
export interface CheckResult {
  mortgage_total: number;
  ratio: number;
  verdict: Verdict;
  flags: string[];
}
