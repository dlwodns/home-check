"use client";
// 다가구 원룸의 '앞선 세입자 보증금' 확인 방법 — 무엇을 들고, 어디 가서, 뭐라고 하는지.
// 근거(법령 원문 확인 11/17): 주택임대차보호법 제3조의6 ④ · 시행령 제6조 ② · 규칙 제7조 ②(계약하려는 사람의 열람 요청과 서류),
// 제3조의7(계약할 때 집주인의 정보 제시 의무). 근거 번호 S6 · S5.
import Link from "next/link";
import { CopyButton } from "../check/NextActions";

export const ASK_LANDLORD =
  "안녕하세요, 계약 전에 이 건물에 먼저 사는 세입자분들의 보증금(확정일자 부여현황)을 주민센터에서 확인하고 싶어요. 임대차 정보 제공 동의서에 서명해 주시고, 신분증 사본(또는 인감증명서 · 본인서명사실확인서)을 함께 부탁드려도 될까요?";

export default function PriorDepositGuide({ open = false }: { open?: boolean }) {
  return (
    <details className="card guide" open={open}>
      <summary>앞선 세입자 보증금, 어떻게 확인해요?</summary>
      <ol className="guide-steps">
        <li>
          <strong>집주인에게 동의를 부탁해요.</strong> 계약하려는 사람은 집주인 동의가 있으면 열람할 수 있어요.
          <span className="bubble">{ASK_LANDLORD}</span>
          <CopyButton text={ASK_LANDLORD} label="부탁 문장 복사" />
        </li>
        <li>
          <strong>가까운 주민센터에 가져가요.</strong>
          <ul>
            <li>임대차 정보제공 요청서 (주민센터에 있어요)</li>
            <li>집주인의 동의서</li>
            <li>집주인의 신분증 사본, 인감증명서, 본인서명사실확인서 중 하나</li>
            <li>내 신분증</li>
          </ul>
        </li>
        <li>
          <strong>받은 서류의 보증금을 모두 더해</strong> 점검 화면의 &apos;먼저 들어온 세입자들의 보증금 합계&apos;에 적어요. 차임 · 보증금 · 확정일자 부여일 · 임대차기간이 나와요.
        </li>
      </ol>
      <p className="small">
        집주인이 동의를 미루거나 거절하면 그 자체가 확인할 점이에요. 그리고 <strong>계약할 때는 집주인이 이 정보를 보여 줄 의무</strong>가 있어요.
      </p>
      <p className="small muted">
        근거 <Link href="/sources#S6">S6</Link> · <Link href="/sources#S5">S5</Link> · 주택임대차보호법 제3조의6 · 제3조의7, 같은 법 시행령 제6조, 확정일자 · 정보제공 규칙 제7조
      </p>
    </details>
  );
}
