// F2 등기부등본 점검 화면. 샘플 서류는 서버에서 읽어 넘기고, 점검 자체는 브라우저 안(CheckClient)에서만 한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import expected from "@/samples/expected.json";
import CheckClient, { type Sample } from "./CheckClient";

export const metadata: Metadata = {
  title: "등기부등본 점검 · 홈체크",
  description: "등기부등본을 붙여 넣으면 계약 전 위험 신호를 쉬운 말로 알려 줘요.",
};

const LABEL: Record<string, string> = { safe: "안전 샘플", caution: "주의 샘플", danger: "위험 샘플" };
const toManwon = (won: number | null) => (won === null ? "" : String(won / 10_000));

function loadSamples(): Sample[] {
  return expected.samples.map((s) => ({
    label: LABEL[s.expected.verdict] ?? s.file,
    text: readFileSync(path.join(process.cwd(), "samples", s.file), "utf8"),
    form: {
      myDeposit: toManwon(s.inputs.my_deposit),
      priorDeposits: toManwon(s.inputs.prior_deposits),
      marketPrice: toManwon(s.inputs.market_price),
      contractParty: s.inputs.contract_party,
    },
  }));
}

export default function CheckPage() {
  return <CheckClient samples={loadSamples()} />;
}
