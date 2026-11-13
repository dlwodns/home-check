// F2 등기부등본 점검에서 쓰는 값의 모양. samples/expected.json과 같은 이름을 쓴다.
// 읽기(read.ts)와 판정(judge.ts)이 이 타입을 채운다.

export interface Mortgage {
  /** 채권최고액(원) */
  max_claim: number;
  creditor: string;
}

export interface Seizure {
  /** 압류 · 가압류 */
  type: "압류" | "가압류";
  /** 청구금액(원). 세금 압류처럼 금액이 없으면 0 */
  amount: number;
  creditor: string;
  /** 접수일 YYYY-MM-DD */
  date: string;
}

/** 근저당 · 압류 말고 위험 신호가 되는 기록 (SOURCES S12 · S13 · S14) */
export type RiskType = "가처분" | "가등기" | "경매개시결정" | "신탁" | "임차권등기";

export interface RiskRecord {
  type: RiskType;
  /** 접수일 YYYY-MM-DD (못 읽으면 "") */
  date: string;
}

/** 규칙 기반 읽기 결과 (expected.json의 read) */
export interface RegistryRead {
  address: string;
  building_type: string;
  /** 지금 등기부상 소유자. 공동 소유면 ", "로 이음. 신탁이면 수탁자(신탁회사) */
  current_owner: string;
  /** 지금 소유자 전에 소유자였던 사람들 (오래된 순) */
  previous_owners: string[];
  active_mortgages: Mortgage[];
  erased_mortgages: Mortgage[];
  seizures: Seizure[];
  /** 말소되지 않은 위험 기록 */
  risk_records: RiskRecord[];
  /** 말소된 위험 기록 (예: 예전 임차권등기) */
  erased_risk_records: RiskRecord[];
  /** 가장 최근 소유권 이전 접수일 YYYY-MM-DD, 없으면 null */
  last_ownership_transfer: string | null;
}

/** 읽기 결과 + 못 읽은 것에 대한 안내 (화면에서 "직접 입력해 주세요"로 보여 줌) */
export interface ReadResult {
  read: RegistryRead;
  warnings: string[];
}

/** 사용자가 직접 넣는 값 (expected.json의 inputs, 금액 단위 원) */
export interface CheckInputs {
  /** 건물 시세. 모르면 null */
  market_price: number | null;
  prior_deposits: number;
  my_deposit: number;
  /** 계약하러 올 사람 이름. 모르면 "" */
  contract_party: string;
}

export type Verdict = "safe" | "caution" | "danger";

/** 판정 이유 코드. 문구 · 등급 · 근거는 data/judge.json의 flags에 있다 */
export type FlagCode =
  | "owner_mismatch"
  | "owner_mismatch_previous_owner"
  | "co_owned"
  | "owner_unchecked"
  | "trust"
  | "seizure"
  | "provisional_disposition"
  | "provisional_registration"
  | "auction"
  | "lease_registration"
  | "ratio_danger"
  | "ratio_caution"
  | "ratio_unknown"
  | "past_lease_registration"
  | "recent_transfer";

/** 판정 결과 (expected.json의 expected) */
export interface CheckResult {
  mortgage_total: number;
  /** 시세를 모르면 null */
  ratio: number | null;
  verdict: Verdict;
  /** 위험 → 주의 → 참고 순서 */
  flags: FlagCode[];
}
