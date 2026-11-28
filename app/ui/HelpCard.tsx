// 막히면 물어보세요: 공공 상담 창구 (번호는 공식 사이트에서 확인, data/help.json)
import help from "@/data/help.json";

export default function HelpCard() {
  return (
    <section className="card help" aria-labelledby="help-title">
      <h3 id="help-title">혼자 판단하기 어려우면 물어보세요</h3>
      <ul>
        {help.places.map((p) => (
          <li key={p.id}>
            <a href={`tel:${p.tel}`} className="help-tel" aria-label={`${p.name} ${p.tel} 전화하기`}>
              {p.tel}
            </a>
            <span>
              <strong>{p.name}</strong>
              {/* 설명은 한 줄만(11/28 UX: 카드가 길었음). 운영 시간 · 공식 사이트는 이름 옆 링크로 */}
              <span className="small muted">{p.what}</span>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="small help-site">
                {p.hours ? `${p.hours} · ` : ""}공식 사이트 ↗
              </a>
            </span>
          </li>
        ))}
      </ul>
      <p className="small muted">무료 상담(통화료 별도) · 번호 확인 {help.checked}</p>
    </section>
  );
}
