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
              <span className="small muted">
                {p.what}
                {p.hours ? ` · ${p.hours}` : ""}
              </span>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="small">
                공식 사이트
              </a>
            </span>
          </li>
        ))}
      </ul>
      <p className="small muted">무료 상담이에요(통화료는 걸 수 있어요). 번호 확인일 {help.checked}</p>
    </section>
  );
}
