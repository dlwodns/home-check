"use client";
// F2 등기부등본 점검: 붙여 넣기 → 내 계약 정보 → 점검 → 결과 카드 · 이유 · 근거 → 읽은 내용 확인 · 고치기.
// 모든 계산은 이 브라우저 안에서만 하고, 서류 내용은 어디에도 보내거나 저장하지 않는다.
import Link from "next/link";
import { useId, useState } from "react";
import { formatWon, runCheck, todayKST, type CheckForm, type CheckOutcome, type FlagView } from "@/lib/registry/check";
import type { Mortgage, RegistryRead } from "@/lib/registry/types";

export interface Sample {
  label: string;
  text: string;
  form: CheckForm;
}

const EMPTY: CheckForm = { myDeposit: "", priorDeposits: "", marketPrice: "", contractParty: "" };

const VERDICT = {
  safe: { label: "안전", line: "큰 위험 신호는 보이지 않아요", icon: "✓" },
  caution: { label: "주의", line: "계약 전에 확인할 것이 있어요", icon: "!" },
  danger: { label: "위험", line: "이대로 계약하면 위험할 수 있어요", icon: "!!" },
} as const;

const LEVEL_LABEL = { danger: "위험", caution: "주의", info: "참고" } as const;

const STATUS_LABEL = {
  confirmed: "법령 원문 확인",
  check: "원문 확인 중",
  not_legal: "법정 기준 아님",
  unknown: "",
} as const;

export default function CheckClient({ samples }: { samples: Sample[] }) {
  const [text, setText] = useState("");
  const [form, setForm] = useState<CheckForm>(EMPTY);
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const [edited, setEdited] = useState<RegistryRead | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  // 새로 점검할 때마다 바뀌어 "읽은 내용 고치기" 입력칸을 새 결과로 초기화한다
  const [run, setRun] = useState(0);
  const ids = { text: useId(), my: useId(), prior: useId(), market: useId(), party: useId() };

  const check = (opts: { edited?: RegistryRead | null; confirmed?: boolean } = {}) => {
    const e = opts.edited === undefined ? edited : opts.edited;
    const c = opts.confirmed ?? confirmed;
    setOutcome(runCheck(text, form, todayKST(), { edited: e ?? undefined, confirmed: c }));
  };

  const start = () => {
    setRun((n) => n + 1);
    setEdited(null);
    setConfirmed(false);
    check({ edited: null, confirmed: false });
  };

  const pickSample = (s: Sample) => {
    setText(s.text);
    setForm(s.form);
    setOutcome(null);
    setEdited(null);
    setConfirmed(false);
  };

  const set = (k: keyof CheckForm) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: ev.target.value }));

  return (
    <main className="container check">
      <nav className="topbar">
        <Link href="/" className="back" aria-label="처음 화면으로">
          ←
        </Link>
        <span>등기부등본 점검</span>
      </nav>

      <p className="privacy">
        🔒 서류 내용은 이 휴대폰(브라우저) 안에서만 읽어요. 어디에도 보내거나 저장하지 않아요.
      </p>

      <section className="card">
        <h2>1. 서류 넣기</h2>
        <label htmlFor={ids.text} className="field-label">
          등기부등본(등기사항전부증명서) 내용을 그대로 붙여 넣어 주세요
        </label>
        <textarea
          id={ids.text}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="【 표 제 부 】 … 【 갑 구 】 … 【 을 구 】 …"
        />
        <div className="samples">
          <span className="muted small">샘플로 해 보기:</span>
          {samples.map((s) => (
            <button key={s.label} type="button" className="chip" onClick={() => pickSample(s)}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="muted small">샘플은 지어낸 가짜 서류예요.</p>
      </section>

      <section className="card">
        <h2>2. 내 계약 정보</h2>
        <div className="field">
          <label htmlFor={ids.my}>내 보증금 (만 원)</label>
          <input id={ids.my} inputMode="numeric" value={form.myDeposit} onChange={set("myDeposit")} placeholder="예: 500" />
        </div>
        <div className="field">
          <label htmlFor={ids.prior}>먼저 들어온 세입자들의 보증금 합계 (만 원)</label>
          <input id={ids.prior} inputMode="numeric" value={form.priorDeposits} onChange={set("priorDeposits")} placeholder="모르면 비워 두세요" />
          <p className="hint">다가구 원룸은 등기부등본에 안 나와요. 집주인 동의를 받아 주민센터에서 확인할 수 있어요.</p>
        </div>
        <div className="field">
          <label htmlFor={ids.market}>이 건물 시세 (만 원)</label>
          <input id={ids.market} inputMode="numeric" value={form.marketPrice} onChange={set("marketPrice")} placeholder="모르면 비워 두세요. 예: 8억" />
          <p className="hint">HUG 안심전세 앱에서 주소로 시세를 볼 수 있어요.</p>
        </div>
        <div className="field">
          <label htmlFor={ids.party}>계약하러 올 사람 이름</label>
          <input id={ids.party} value={form.contractParty} onChange={set("contractParty")} placeholder="집주인 본인인지 확인할게요" />
        </div>
        <button type="button" className="primary" onClick={start}>
          점검하기
        </button>
      </section>

      {outcome && !outcome.ok && (
        <section className="card errors" role="alert">
          <h2>이것만 고쳐 주세요</h2>
          <ul>
            {outcome.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {outcome?.ok && (
        <Result
          key={run}
          outcome={outcome}
          confirmed={confirmed}
          onEdit={(r) => {
            setEdited(r);
            check({ edited: r });
          }}
          onConfirm={(v) => {
            setConfirmed(v);
            check({ confirmed: v });
          }}
        />
      )}

      <p className="disclaimer">
        참고용 안내예요. 최종 확인은 공인중개사 · 법률 전문가에게 받아 주세요.
      </p>
    </main>
  );
}

function Result({
  outcome,
  confirmed,
  onEdit,
  onConfirm,
}: {
  outcome: Extract<CheckOutcome, { ok: true }>;
  confirmed: boolean;
  onEdit: (r: RegistryRead) => void;
  onConfirm: (v: boolean) => void;
}) {
  const { result, flags, warnings, read, ratioLines } = outcome;
  const v = VERDICT[result.verdict];

  return (
    <section aria-live="polite">
      <div className={`verdict verdict-${result.verdict}`}>
        <span className="verdict-icon" aria-hidden="true">
          {v.icon}
        </span>
        <div>
          <strong className="verdict-label">{v.label}</strong>
          <p>{v.line}</p>
        </div>
      </div>

      {warnings.length > 0 && !confirmed && (
        <div className="card warn" role="status">
          <h3>못 읽은 칸이 있어요</h3>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="small">아래 "읽은 내용 확인 · 고치기"에서 직접 확인해 주세요. 확인 전에는 '안전'이 나오지 않아요.</p>
        </div>
      )}

      {result.ratio !== null && <RatioBar ratio={result.ratio} lines={ratioLines} />}

      <ul className="flags">
        {flags.map((f) => (
          <FlagItem key={f.code} f={f} />
        ))}
        {flags.length === 0 && <li className="flag flag-safe">근저당 · 압류 · 신탁 등 위험 기록이 보이지 않아요.</li>}
      </ul>

      <ReadEditor read={read} hasWarnings={warnings.length > 0} confirmed={confirmed} onEdit={onEdit} onConfirm={onConfirm} />
    </section>
  );
}

function FlagItem({ f }: { f: FlagView }) {
  return (
    <li className={`flag flag-${f.level}`}>
      <span className="flag-level">{LEVEL_LABEL[f.level]}</span>
      <p className="flag-title">{f.title}</p>
      <p className="flag-sources">
        {f.sources.map((s) => (
          <span key={s.id}>
            근거 <Link href={`/sources#${s.id}`}>{s.id}</Link>
            {STATUS_LABEL[s.status] && <em> · {STATUS_LABEL[s.status]}</em>}{" "}
          </span>
        ))}
        {f.basis && <span>{f.basis}</span>}
      </p>
    </li>
  );
}

function RatioBar({ ratio, lines }: { ratio: number; lines: { caution: number; danger: number } }) {
  const width = Math.min(ratio, 100);
  const level = ratio >= lines.danger ? "danger" : ratio >= lines.caution ? "caution" : "safe";
  return (
    <div className="card ratio">
      <p>
        빚과 보증금을 합치면 건물 시세의 <strong>{ratio}%</strong>
      </p>
      <div className="bar" role="img" aria-label={`시세 대비 ${ratio}%, 참고선 ${lines.caution}%와 ${lines.danger}%`}>
        <div className={`bar-fill bar-${level}`} style={{ width: `${width}%` }} />
        <span className="bar-mark" style={{ left: `${lines.caution}%` }} />
        <span className="bar-mark" style={{ left: `${lines.danger}%` }} />
      </div>
      <div className="bar-labels" aria-hidden="true">
        <span style={{ left: `${lines.caution}%` }}>{lines.caution}%</span>
        <span style={{ left: `${lines.danger}%` }}>{lines.danger}%</span>
      </div>
      <p className="small muted">
        {lines.caution}% · {lines.danger}%는 법으로 정한 기준이 아니라 많이 쓰는 참고선이에요.
      </p>
    </div>
  );
}

function ReadEditor({
  read,
  hasWarnings,
  confirmed,
  onEdit,
  onConfirm,
}: {
  read: RegistryRead;
  hasWarnings: boolean;
  confirmed: boolean;
  onEdit: (r: RegistryRead) => void;
  onConfirm: (v: boolean) => void;
}) {
  const [owner, setOwner] = useState(read.current_owner);
  const [mortgages, setMortgages] = useState<{ amount: string; creditor: string }[]>(
    read.active_mortgages.map((m) => ({ amount: String(m.max_claim / 10_000), creditor: m.creditor })),
  );
  const [error, setError] = useState("");
  const ownerId = useId();

  const apply = () => {
    const parsed: Mortgage[] = [];
    for (const m of mortgages) {
      const n = Number(m.amount.replace(/[,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0 || m.amount.trim() === "") {
        setError("근저당 금액은 만 원 단위 숫자로 적어 주세요.");
        return;
      }
      parsed.push({ max_claim: Math.round(n * 10_000), creditor: m.creditor.trim() });
    }
    setError("");
    onEdit({ ...read, current_owner: owner.trim(), active_mortgages: parsed });
  };

  return (
    <details className="card editor" open={hasWarnings && !confirmed}>
      <summary>읽은 내용 확인 · 고치기</summary>
      <p className="small muted">서류와 다르면 고친 뒤 "다시 점검"을 눌러 주세요.</p>
      <div className="field">
        <label htmlFor={ownerId}>지금 집주인 (갑구의 마지막 소유자)</label>
        <input id={ownerId} value={owner} onChange={(e) => setOwner(e.target.value)} />
      </div>
      <p className="field-label">말소되지 않은 근저당 (채권최고액, 만 원)</p>
      {mortgages.length === 0 && <p className="small muted">읽은 근저당이 없어요.</p>}
      {mortgages.map((m, i) => (
        <div className="row" key={i}>
          <input
            aria-label={`근저당 ${i + 1} 금액 (만 원)`}
            inputMode="numeric"
            value={m.amount}
            onChange={(e) => setMortgages((ms) => ms.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
          />
          <input
            aria-label={`근저당 ${i + 1} 근저당권자`}
            value={m.creditor}
            placeholder="은행 이름"
            onChange={(e) => setMortgages((ms) => ms.map((x, j) => (j === i ? { ...x, creditor: e.target.value } : x)))}
          />
          <button type="button" className="ghost" aria-label={`근저당 ${i + 1} 지우기`} onClick={() => setMortgages((ms) => ms.filter((_, j) => j !== i))}>
            지우기
          </button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => setMortgages((ms) => [...ms, { amount: "", creditor: "" }])}>
        + 근저당 추가
      </button>
      {read.active_mortgages.length > 0 && (
        <p className="small muted">
          처음 읽은 합계: {formatWon(read.active_mortgages.reduce((s, m) => s + m.max_claim, 0))}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {hasWarnings && (
        <label className="confirm">
          <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} />
          못 읽은 칸을 서류에서 직접 확인했어요
        </label>
      )}
      <button type="button" className="primary" onClick={apply}>
        다시 점검
      </button>
    </details>
  );
}
