"use client";
// F2 등기부등본 점검: 붙여 넣기 → 내 계약 정보 → 점검 → 결과 카드 · 이유 · 근거 → 읽은 내용 확인 · 고치기.
// 모든 계산은 이 브라우저 안에서만 하고, 서류 내용은 어디에도 보내거나 저장하지 않는다.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatWon, runCheck, todayKST, type CheckForm, type CheckOutcome, type FlagView } from "@/lib/registry/check";
import type { Mortgage, RegistryRead } from "@/lib/registry/types";
import { buildActions } from "@/lib/registry/actions";
import { roomHref, roomIdFrom, summarize, updateRoom, type Room } from "@/lib/store/rooms";
import { roomsStore } from "../ui/useProgress";
import { goodPoints, headline, summaryLines } from "@/lib/registry/goodPoints";
import { unknownsFor } from "@/lib/registry/unknowns";
import UnknownList from "../ui/UnknownList";
import { splitAll, type Segment } from "@/lib/content/terms";
import NextActions from "./NextActions";
import TrafficLight from "../ui/TrafficLight";
import TermText from "../ui/TermText";
import TermHint from "../ui/TermHint";
import PriorDepositGuide from "../ui/PriorDepositGuide";
import { MAX_PDF_BYTES, readPdfFile } from "./readPdf";
import HomeLink from "../ui/HomeLink";

export interface Sample {
  label: string;
  text: string;
  form: CheckForm;
}

const EMPTY: CheckForm = { myDeposit: "", priorDeposits: "", marketPrice: "", contractParty: "" };

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
  const ids = { text: useId(), my: useId(), prior: useId(), market: useId(), party: useId(), file: useId() };
  const [pdfStatus, setPdfStatus] = useState<{ kind: "busy" | "ok" | "error"; message: string } | null>(null);
  // ?room=방id 로 들어오면 그 방을 점검하고, 결과 요약(판정 · 이유 · 다음 행동)만 그 방에 저장한다
  const [room, setRoom] = useState<Room | null>(null);
  const [savedToRoom, setSavedToRoom] = useState(false);

  useEffect(() => {
    const id = roomIdFrom(window.location.search);
    const found = id ? roomsStore().load().rooms.find((r) => r.id === id) ?? null : null;
    if (!found) return;
    setRoom(found);
    setForm((f) => (f.myDeposit ? f : { ...f, myDeposit: String(found.deposit) }));
  }, []);

  const onPdf = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setPdfStatus({ kind: "error", message: "PDF 파일만 올릴 수 있어요." });
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setPdfStatus({ kind: "error", message: "파일이 너무 커요(10MB까지). 인터넷등기소에서 받은 PDF를 그대로 올려 주세요." });
      return;
    }
    setPdfStatus({ kind: "busy", message: "PDF에서 글자를 읽는 중이에요…" });
    try {
      const r = await readPdfFile(file);
      if (!r.hasText) {
        setPdfStatus({
          kind: "error",
          message: "이 PDF에는 읽을 수 있는 글자가 없어요(사진 · 스캔 파일). 인터넷등기소에서 받은 PDF를 올리거나, 내용을 붙여 넣어 주세요.",
        });
        return;
      }
      setText(r.text);
      setOutcome(null);
      setPdfStatus({ kind: "ok", message: `PDF ${r.pages}쪽에서 글자를 읽었어요. 아래 내용이 서류와 맞는지 확인한 뒤 점검해 주세요.` });
    } catch {
      setPdfStatus({ kind: "error", message: "PDF를 읽지 못했어요. 비밀번호가 걸린 파일인지 확인하거나, 내용을 붙여 넣어 주세요." });
    }
  };

  const check = (opts: { edited?: RegistryRead | null; confirmed?: boolean } = {}) => {
    const e = opts.edited === undefined ? edited : opts.edited;
    const c = opts.confirmed ?? confirmed;
    const asOf = todayKST();
    const out = runCheck(text, form, asOf, { edited: e ?? undefined, confirmed: c });
    setOutcome(out);
    if (out.ok && room) {
      const store = roomsStore();
      const summary = summarize(out.result, buildActions(out.read, out.result), asOf, unknownsFor(out.read, out.result).map((u) => u.id));
      store.save(updateRoom(store.load(), room.id, (r) => ({ ...r, check: summary })));
      setSavedToRoom(true);
    }
  };

  const start = () => {
    setRun((n) => n + 1);
    setEdited(null);
    setConfirmed(false);
    check({ edited: null, confirmed: false });
  };

  const pickSample = (s: Sample) => {
    setPdfStatus(null);
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
        <Link href={room ? roomHref(room.id) : "/"} className="back" aria-label={room ? "이 방으로" : "처음 화면으로"}>
          ←
        </Link>
        <span>{room ? `${room.label} · 등기부등본 점검` : "등기부등본 점검"}</span>
        <HomeLink />
      </nav>

      {room && (
        <p className="card small room-banner">
          <strong>{room.label}</strong> 방을 점검해요. 결과는 이 방에 <strong>판정 요약만</strong> 저장돼요(서류 원문 · 집주인 이름은 저장하지 않아요).
        </p>
      )}

      <p className="privacy">
        🔒 서류 내용은 이 휴대폰(브라우저) 안에서만 읽어요. 어디에도 보내거나 저장하지 않아요. <Link href="/privacy">자세히</Link>
      </p>

      <section className="card">
        <h2>1. 서류 넣기</h2>
        <label htmlFor={ids.file} className="file-pick">
          <span>등기부등본 PDF 올리기</span>
          <span className="small muted">인터넷등기소에서 받은 PDF 그대로 · 이 기기 안에서만 읽어요</span>
        </label>
        <input
          id={ids.file}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            void onPdf(e.target.files?.[0]);
            e.target.value = ""; // 같은 파일을 다시 골라도 읽게
          }}
        />
        {pdfStatus && (
          <p className={`pdf-status pdf-${pdfStatus.kind}`} role={pdfStatus.kind === "error" ? "alert" : "status"}>
            {pdfStatus.message}
          </p>
        )}
        <label htmlFor={ids.text} className="field-label">
          또는 등기부등본(등기사항전부증명서) 내용을 그대로 붙여 넣어 주세요
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
          <p className="hint">다가구 원룸은 등기부등본에 안 나와요. 모르면 비워 두면 '모름'으로 따로 알려 드려요.</p>
          <PriorDepositGuide />
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

      {outcome?.ok && room && savedToRoom && (
        <p className="card small saved-note" role="status">
          ✓ <strong>{room.label}</strong>에 저장했어요. <Link href={roomHref(room.id)}>이 방으로 돌아가 계약 방법 보기 →</Link>
        </p>
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
  const toCheck = flags.filter((f) => f.level !== "info");
  const notes = flags.filter((f) => f.level === "info");
  const good = goodPoints(result, ratioLines);
  const unknowns = unknownsFor(read, result);
  const actions = buildActions(read, result);
  const summary = summaryLines(toCheck[0]?.title ?? null, actions.todos[0] ?? null, good.length, unknowns.length);
  // 이 결과 화면의 이유 문장들: 같은 용어는 처음 나올 때만 누를 수 있게
  const segs = splitAll(flags.map((f) => f.title));
  const segOf = (code: string) => segs[flags.findIndex((f) => f.code === code)];
  const ref = useRef<HTMLElement>(null);

  // 점검하기를 누르면 결과로 바로 이동한다 (입력칸이 길어서 결과가 화면 아래에 생기므로)
  useEffect(() => {
    const el = ref.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }, []);

  return (
    <section aria-live="polite" className="result" ref={ref}>
      <TrafficLight verdict={result.verdict} />
      <h2 className="result-head">{headline(result.verdict, toCheck.length)}</h2>
      <ul className="summary-lines">
        {summary.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

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

      {segs.some((g) => g.some((x) => x.term)) && <TermHint />}

      {toCheck.length > 0 && (
        <>
          <h3 className="list-title">확인할 것</h3>
          <ul className="flags">
            {toCheck.map((f) => (
              <FlagItem key={f.code} f={f} segments={segOf(f.code)} />
            ))}
          </ul>
        </>
      )}

      {result.ratio !== null && <RatioBar ratio={result.ratio} lines={ratioLines} />}

      {good.length > 0 && (
        <>
          <h3 className="list-title">괜찮은 점</h3>
          <ul className="good">
            {good.map((g) => (
              <li key={g}>
                <span className="good-mark" aria-hidden="true">✓</span>
                {g}
              </li>
            ))}
          </ul>
        </>
      )}

      {notes.length > 0 && (
        <>
          <h3 className="list-title">참고</h3>
          <ul className="flags">
            {notes.map((f) => (
              <FlagItem key={f.code} f={f} segments={segOf(f.code)} />
            ))}
          </ul>
        </>
      )}

      <UnknownList items={unknowns} />

      <ReadEditor read={read} hasWarnings={warnings.length > 0} confirmed={confirmed} onEdit={onEdit} onConfirm={onConfirm} />

      <NextActions actions={actions} />
    </section>
  );
}

function FlagItem({ f, segments }: { f: FlagView; segments?: Segment[] }) {
  return (
    <li className={`flag flag-${f.level}`}>
      <span className="flag-level">{LEVEL_LABEL[f.level]}</span>
      <p className="flag-title">{segments ? <TermText segments={segments} /> : f.title}</p>
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
