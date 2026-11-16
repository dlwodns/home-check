// 개인정보 · 데이터 안내: 무엇을 어디에 저장하고, 무엇을 서버로 보내는지 쉬운 말로. 기록 지우기 버튼 포함.
import type { Metadata } from "next";
import Link from "next/link";
import ClearData from "./ClearData";

export const metadata: Metadata = { title: "개인정보 · 데이터 안내 · 홈체크" };

export default function PrivacyPage() {
  return (
    <main className="container check privacy-page">
      <nav className="topbar">
        <Link href="/" className="back" aria-label="내 후보 방으로">
          ←
        </Link>
        <span>개인정보 · 데이터 안내</span>
      </nav>
      <h1 className="title">내 정보는 이렇게 다뤄요</h1>
      <p className="muted">2026년 11월 기준 · 기능이 바뀌면 이 안내도 함께 고쳐요.</p>

      <section className="card">
        <h2>등기부등본</h2>
        <p>
          PDF나 붙여 넣은 글자는 <strong>이 휴대폰(브라우저) 안에서만</strong> 읽어요. 홈체크 서버를 포함해 어디에도 보내지 않고, 원문과 집주인
          이름은 저장하지 않아요.
        </p>
      </section>

      <section className="card">
        <h2>이 휴대폰에만 저장하는 것</h2>
        <ul>
          <li>내 후보 방: 주소, 보증금 · 월세, 메모 · 매물 링크, 고른 동네</li>
          <li>단계별 체크 표시, 중개사 · 직거래 선택</li>
          <li>점검 결과 요약: 안전 · 주의 · 위험, 이유, 다음 행동 문장</li>
          <li>한 번 본 용어 표시, 안내를 닫았는지</li>
        </ul>
        <p className="small muted">다른 휴대폰이나 브라우저에서는 보이지 않아요. 브라우저 기록을 지우면 함께 지워져요.</p>
      </section>

      <section className="card">
        <h2>서버로 보내는 것</h2>
        <p>
          동네 시세를 볼 때 <strong>시군구 코드와 동 이름만</strong>(예: 마포구 · 서교동) 홈체크 서버를 거쳐 국토교통부 공공데이터로 물어봐요. 번지 ·
          금액 · 메모는 보내지 않아요.
        </p>
      </section>

      <section className="card">
        <h2>쓰지 않는 것</h2>
        <p>광고, 방문 분석 도구, 외부 AI 서비스는 쓰지 않아요.</p>
      </section>

      <section className="card">
        <h2>로그인 (준비 중)</h2>
        <p>
          로그인을 붙이면 이메일과 비밀번호만 받고, 이메일은 로그인에만 써요. 그때 계정에 저장하는 항목도 여기에 적을게요.
        </p>
      </section>

      <ClearData />

      <p className="disclaimer">홈체크는 참고용 안내예요. 최종 확인은 공인중개사 · 법률 전문가에게 받아 주세요.</p>
    </main>
  );
}
