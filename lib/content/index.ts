// 화면 · 결과 설명 · 도우미가 같이 쓰는 내용 데이터(data/*.json)를 타입과 함께 읽어 온다.
// 문장은 코드에 쓰지 않고 data/에만 둔다(PRD F1 "용어 사전 파일 하나").
import sourcesFile from "@/data/sources.json";
import stepsFile from "@/data/steps.json";
import checklistsFile from "@/data/checklists.json";
import glossaryFile from "@/data/glossary.json";

export type SourceStatus = "confirmed" | "check" | "not_legal";

export interface Source {
  id: string;
  title: string;
  status: SourceStatus;
  official_url: string | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  why: string;
  sources: string[];
  /** 이 항목에서 열리는 기능(예: F2 등기부등본 점검) */
  opens?: "F2";
}

export interface Step {
  id: string;
  no: number;
  title: string;
  summary: string;
  key?: boolean;
  items: ChecklistItem[];
}

export interface Branch {
  id: "broker" | "direct";
  label: string;
  items: ChecklistItem[];
}

export interface Term {
  id: string;
  term: string;
  aliases: string[];
  short: string;
  sources: string[];
  verified: boolean;
}

export const sources = sourcesFile.sources as Source[];
export const steps = stepsFile.steps as Step[];
export const branchQuestion: string = checklistsFile.question;
export const branches = checklistsFile.branches as Branch[];
export const terms = glossaryFile.terms as Term[];

export function findSource(id: string): Source | undefined {
  return sources.find((s) => s.id === id);
}

/** 용어 또는 다른 이름으로 찾는다(예: '선순위 보증금' → 앞선 세입자 보증금). */
export function findTerm(word: string): Term | undefined {
  return terms.find((t) => t.term === word || t.aliases.includes(word));
}
