"use client";
// F2 등기부등본 점검: 붙여 넣기 → 내 계약 정보 → 점검 → 결과 카드 · 이유 · 근거 → 읽은 내용 확인 · 고치기.
// 모든 계산은 이 브라우저 안에서만 하고, 서류 내용은 어디에도 보내거나 저장하지 않는다.
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { itemKey } from "@/lib/store/progress";
import { NOT_REGISTRY, formatWon, parseManwon, runCheck, todayKST, type CheckForm, type CheckOutcome, type FlagView } from "@/lib/registry/check";
import type { Mortgage, RegistryRead } from "@/lib/registry/types";
import { buildActions, todoFor } from "@/lib/registry/actions";
import { readRegistry } from "@/lib/registry/read";
import { roomIdFrom, summarize, updateRoom, withRoom, type Room } from "@/lib/store/rooms";
import { roomsStore } from "../ui/useProgress";
import { goodPoints, headline, summaryLines } from "@/lib/registry/goodPoints";
import { unknownsFor } from "@/lib/registry/unknowns";
import UnknownList from "../ui/UnknownList";
import HelpCard from "../ui/HelpCard";
import { splitAll, type Segment } from "@/lib/content/terms";
import NextActions from "./NextActions";
import TrafficLight from "../ui/TrafficLight";
import TermText from "../ui/TermText";
import TermHint from "../ui/TermHint";
import PriorDepositGuide from "../ui/PriorDepositGuide";
import { MAX_PDF_BYTES, readPdfFile } from "./readPdf";
import { MAX_OCR_PAGES, ocrPdfFile, type OcrPdfResult } from "./ocrPdf";
import { missedEntries } from "@/lib/registry/ocrCheck";
import OcrReview, { type OcrReviewState } from "./OcrReview";

/** 그림 PDF를 OCR로 읽고 아직 원본과 맞춰 보지 않았을 때. 맞춰 보기 전에는 '안전'을 내지 않는다 */
export const OCR_WARNING = "그림(스캔) PDF라 OCR로 읽었어요. 위 '원본과 맞춰 보기'를 마치면 최종 결과가 나와요.";
export const OCR_DIFFERS = "원본과 다른 값이 있다고 표시했어요. 등기부를 직접 확인해 주세요.";
import HomeLink from "../ui/HomeLink";
import MoneyInput from "../ui/MoneyInput";
import BackButton from "../ui/Back";

export interface Sample {
  label: string;
  text: string;
  form: CheckForm;
}

const EMPTY: CheckForm = { myDeposit: "", priorDeposits: "", marketPrice: "", contractParty: "" };

const LEVEL_LABEL = { danger: "위험", caution: "주의", info: "참고" } as const;

const STATUS_LABEL = {
  confirmed: "법령 원문 확인",
  check: "", // 근거 목록 화면에서만 '원문 확인 중'을 보여 준다(결과 화면에서는 불안만 줌)
  not_legal: "법정 기준 아님",
  unknown: "",
} as const;

export default function CheckClient({ samples }: { samples: Sample[] }) {
  const [text, setText] = useState("");
  const [form, setForm] = useState<CheckForm>(EMPTY);
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const [edited, setEdited] = useState<RegistryRead | null>(null);
  // '내가 고침' 표시용: 서류에서 처음 읽은 값과 사용자가 고친 값을 비교한다
  const original = useMemo(() => (text.trim() ? readRegistry(text).read : null), [text]);
  const editedFields = editedFieldsOf(original, edited);
  const [confirmed, setConfirmed] = useState(false);
  // 새로 점검할 때마다 바뀌어 "읽은 내용 고치기" 입력칸을 새 결과로 초기화한다
  const [run, setRun] = useState(0);
  const ids = { text: useId(), my: useId(), prior: useId(), market: useId(), party: useId(), file: useId() };
  const [pdfStatus, setPdfStatus] = useState<{ kind: "busy" | "ok" | "error"; message: string } | null>(null);
  // ?room=방id 로 들어오면 그 방을 점검하고, 결과 요약(판정 · 이유 · 다음 행동)만 그 방에 저장한다
  const [room, setRoom] = useState<Room | null>(null);
  const [savedToRoom, setSavedToRoom] = useState(false);
  // 그림 PDF를 OCR로 읽은 경우: 원본 쪽 그림 · 단어 자리(확인 화면용). 새 서류를 넣으면 비운다
  const [ocr, setOcr] = useState<OcrPdfResult | null>(null);
  // PDF로 넣었으면 읽은 글자 칸을 접는다(붙여 넣는 사람에게는 그대로)
  const [fromPdf, setFromPdf] = useState(false);
  const [ocrReview, setOcrReview] = useState<OcrReviewState>("pending");
  const clearOcr = () =>
    setOcr((o) => {
      o?.pages.forEach((p) => URL.revokeObjectURL(p.url));
      return null;
    });
  // 점검이 되면 입력 칸을 한 줄로 접어 결과가 바로 보이게 한다(R7: 한 페이지가 너무 길었음). '고쳐서 다시 점검'으로 다시 펼친다
  const [inputsOpen, setInputsOpen] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  // 한 화면에 카드 하나(D): 서류 넣기(doc) → 내 계약 정보(info). 서류가 들어오면 다음 카드로 넘어간다
  const [pane, setPane] = useState<"doc" | "info">("doc");
  const isSample = samples.some((s) => s.text === text);

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
      clearOcr();
      const r = await readPdfFile(file);
      if (!r.hasText) {
        // 글자가 없는 그림(스캔) PDF → 이 기기 안에서 OCR
        const o = await ocrPdfFile(file, (message) => setPdfStatus({ kind: "busy", message }));
        if (o.text.replace(/\s/g, "").length < 20) {
          o.pages.forEach((p) => URL.revokeObjectURL(p.url));
          setPdfStatus({ kind: "error", message: "그림에서 글자를 거의 읽지 못했어요. 더 선명한 PDF를 올리거나, 내용을 붙여 넣어 주세요." });
          return;
        }
        setOcr(o);
        setFromPdf(true);
        setOcrReview("pending");
        setEdited(null);
        setConfirmed(false);
        setText(o.text);
        setOutcome(null);
        setPdfStatus({ kind: "ok", message: `그림 PDF ${o.pages.length}쪽을 읽었어요. 아래에서 원본과 맞춰 봐 주세요.` });
        return;
      }
      // 등기부등본이 아닌 PDF는 점검 버튼까지 가기 전에 바로 알린다 (그림 PDF는 OCR 잡음이 있어 확인 화면에서 맞춰 본다)
      if (readRegistry(r.text).warnings.some((w) => w.startsWith(NOT_REGISTRY))) {
        setPdfStatus({ kind: "error", message: "이 PDF는 등기부등본이 아닌 것 같아요. 인터넷등기소에서 받은 등기사항전부증명서 PDF를 올려 주세요." });
        return;
      }
      setText(r.text);
      setFromPdf(true);
      setOutcome(null);
      setPane("info");
      setPdfStatus({ kind: "ok", message: `PDF ${r.pages}쪽에서 글자를 읽었어요. 아래 내용이 서류와 맞는지 확인한 뒤 점검해 주세요.` });
    } catch (e) {
      const many = /^too-many-pages:(\d+)/.exec(String((e as Error)?.message));
      setPdfStatus({
        kind: "error",
        message: many
          ? `그림 PDF가 ${many[1]}쪽이라 너무 길어요(${MAX_OCR_PAGES}쪽까지). 인터넷등기소 열람 화면의 내용을 붙여 넣어 주세요.`
          : "PDF를 읽지 못했어요. 비밀번호가 걸린 파일인지 확인하거나, 내용을 붙여 넣어 주세요.",
      });
    }
  };

  const check = (opts: { edited?: RegistryRead | null; confirmed?: boolean; review?: OcrReviewState } = {}) => {
    const e = opts.edited === undefined ? edited : opts.edited;
    const c = opts.confirmed ?? confirmed;
    const review = opts.review ?? ocrReview;
    const asOf = todayKST();
    // 그림 PDF: 원본과 맞춰 보기('같아요')를 마쳐야 '안전'이 풀린다. 놓친 기록 경고는 맞춰 보기 카드에서 보여 줬으므로 같이 풀림
    const extraWarnings = !ocr || review === "ok" ? [] : review === "differs" ? [OCR_DIFFERS] : [OCR_WARNING, ...missedEntries(ocr.raw, readRegistry(text).read)];
    // 맞춰 보기 카드에서 읽기 경고(갑구 못 찾음 등)를 보여 주고 '같아요'를 받았으므로 읽기 경고도 확인한 것으로 본다
    const out = runCheck(text, form, asOf, { edited: e ?? undefined, confirmed: c || (Boolean(ocr) && review === "ok"), extraWarnings });
    setOutcome(out);
    // 샘플(지어낸 서류) 결과를 내 방에 저장하면 실제 방이 가짜 판정을 갖게 된다 → 방에는 실제 서류 결과만
    if (out.ok && room && !isSample) {
      const store = roomsStore();
      const summary = {
        ...summarize(out.result, buildActions(out.read, out.result), asOf, unknownsFor(out.read, out.result).map((u) => u.id)),
        edited: editedFieldsOf(text.trim() ? readRegistry(text).read : null, e ?? null),
      };
      // 등기부를 점검했으니 4단계 '등기부등본 점검하기'도 한 일로 (사용자가 단계 화면에서 다시 끌 수 있음)
      store.save(updateRoom(store.load(), room.id, (r) => ({ ...r, check: summary, checked: { ...r.checked, [itemKey("documents", "registry")]: true } })));
      setSavedToRoom(true);
    }
  };

  // 내 계약 정보 칸의 오류는 그 칸 바로 아래에(11/28 UX: 맨 아래 상자에만 뜨면 어디를 고칠지 찾아야 함)
  const errs = outcome && !outcome.ok ? outcome.errors : [];
  const errFor = (label: string) => errs.find((e) => e.startsWith(label)) ?? null;
  const fieldErr = Boolean(errs.length) && errs.every((e) => /^(내 보증금|앞선 세입자 보증금|건물 시세|계약할 사람)/.test(e));
  useEffect(() => {
    if (!fieldErr) return;
    const el = document.querySelector<HTMLElement>(".check [aria-invalid='true']");
    el?.focus();
    el?.scrollIntoView?.({ block: "center" });
  }, [fieldErr, run]);

  const start = () => {
    setInputsOpen(false);
    setRun((n) => n + 1);
    setConfirmed(false);
    // 그림 PDF에서 맞춰 보며 고친 값은 점검에 그대로 쓴다
    const keep = ocr && ocrReview !== "pending" ? edited : null;
    setEdited(keep);
    check({ edited: keep, confirmed: false });
  };

  // 지금 어느 단계인지: 처음 쓰는 사람이 다음에 뭘 할지 한 줄로 알게
  const stepNames = ["서류 넣기", ...(ocr ? ["원본과 맞춰 보기"] : []), "내 계약 정보", "결과 보기"];
  const stepNow =
    outcome?.ok && !inputsOpen ? "결과 보기" : pane === "info" && text.trim() ? "내 계약 정보" : ocr && ocrReview === "pending" ? "원본과 맞춰 보기" : "서류 넣기";
  // 위쪽 단계 표시에서 앞 단계를 누르면 그 카드로 돌아간다
  const goStep = (name: string) => {
    if (name === "결과 보기") return;
    setInputsOpen(true);
    setPane(name === "내 계약 정보" ? "info" : "doc");
    window.scrollTo?.({ top: 0 });
  };
  const stepNo = (name: string) => stepNames.indexOf(name) + 1;
  const review =
    ocr && original ? (
      <OcrReview
        key={JSON.stringify([(edited ?? original).current_owner, (edited ?? original).active_mortgages])}
        ocr={ocr}
        original={original}
        current={edited ?? original}
        missed={missedEntries(ocr.raw, original)}
        readWarnings={readRegistry(text).warnings}
        stepNo={stepNo("원본과 맞춰 보기")}
        state={ocrReview}
        editedFields={editedFields}
        onReopen={() => {
          setOcrReview("pending");
          setPane("doc");
        }}
        onDone={(st, r) => {
          setOcrReview(st);
          setEdited(r);
          if (outcome?.ok) check({ edited: r, review: st });
          else setPane("info");
        }}
      />
    ) : null;

  const pickSample = (s: Sample) => {
    setPdfStatus(null);
    setFromPdf(false);
    clearOcr();
    setText(s.text);
    // 방에서 해 볼 때는 내 방 보증금을 지킨다(샘플 값으로 덮지 않음)
    setForm(room ? { ...s.form, myDeposit: form.myDeposit || s.form.myDeposit } : s.form);
    setOutcome(null);
    setEdited(null);
    setConfirmed(false);
    setPane("info");
  };

  const setMoney = (k: keyof CheckForm) => (manwon: string) => setForm((f) => ({ ...f, [k]: manwon }));
  const set = (k: keyof CheckForm) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: ev.target.value }));

  const showInputs = inputsOpen || !outcome?.ok;
  const savedNote =
    outcome?.ok && room ? (
      isSample ? (
        <p className="saved-note" role="status">
          예시 서류로 해 본 결과라 이 방에는 저장하지 않았어요. 이 방의 등기부등본을 올리면 결과가 <strong>{room.label}</strong>에 저장돼요.
        </p>
      ) : savedToRoom ? (
        <p className="saved-note" role="status">
          ✓ <strong>{room.label}</strong>에 저장했어요.
        </p>
      ) : null
    ) : null;
  const pasteBox = (
    <>
      <label htmlFor={ids.text} className="field-label">
        {fromPdf ? "읽은 글자(서류와 다르면 고쳐도 돼요)" : "또는 등기부등본(등기사항전부증명서) 내용을 그대로 붙여 넣어 주세요"}
      </label>
      <textarea id={ids.text} value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="【 표 제 부 】 … 【 갑 구 】 … 【 을 구 】 …" />
    </>
  );
  return (
    <main className="container check">
      <nav className="topbar">
        <BackButton fallback={room ? withRoom("/steps/4", room.id) : "/"} />
        <HomeLink />
        <span>{room ? "4단계 · 등기부등본 점검" : "등기부등본 점검"}</span>
      </nav>

      <nav className="check-steps" aria-label="점검 단계">
        <ol>
          {stepNames.map((n, i) => (
            <li key={n} aria-current={n === stepNow ? "step" : undefined} className={stepNames.indexOf(stepNow) > i ? "done" : undefined}>
              {stepNames.indexOf(stepNow) > i && n !== "원본과 맞춰 보기" ? (
                <button type="button" className="step-back" onClick={() => goStep(n)} aria-label={`${n}(으)로 돌아가기`}>
                  <span className="step-no">✓</span>
                  {n}
                </button>
              ) : (
                <>
                  <span className="step-no">{stepNames.indexOf(stepNow) > i ? "✓" : i + 1}</span>
                  {n}
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* 서류를 올리는 화면에서만(정보 입력 · 결과 화면에서는 같은 말 반복이라 뺌) */}
      {showInputs && pane === "doc" && (
      <p className="privacy">
        🔒 서류는 이 기기 안에서만 읽어요{room ? " · 이 방엔 판정 요약만 저장" : ""} · <Link href="/privacy">자세히</Link>
      </p>
      )}

      {!showInputs && (
        <section className="card small inputs-folded" aria-label="넣은 서류 · 내 계약 정보">
          <p>
            ✓ <strong>{isSample ? samples.find((x) => x.text === text)?.label : "넣은 서류"}</strong>
            {ocr && ocrReview === "ok" ? " · 원본과 맞춰 봄" : ""} · 내 보증금 {money(form.myDeposit) ?? "?"}
            {money(form.marketPrice) ? ` · 시세 ${money(form.marketPrice)}` : " · 시세 모름"}
            {money(form.priorDeposits) ? ` · 앞선 보증금 ${money(form.priorDeposits)}` : ""}
          </p>
          {savedNote}
          <button type="button" className="ghost" onClick={() => setInputsOpen(true)}>
            ← 이전: 내 계약 정보
          </button>
        </section>
      )}
      {!showInputs && ocrReview !== "ok" && review}

      {showInputs && pane === "doc" && (
      <>
      <section className="card">
        <h2>서류 넣기</h2>
        <p className="get-registry">
          <a href="https://www.iros.go.kr" target="_blank" rel="noopener noreferrer">
            인터넷등기소에서 떼기 ↗
          </a>{" "}
          <span className="small muted">5분 · 1,100원</span>
        </p>
        <details className="howto">
          <summary>떼는 순서 보기</summary>
          <ol>
            <li>
              인터넷등기소에서 로그인 → <strong>부동산 등기 → 열람하기</strong>
            </li>
            <li>방 주소로 검색해서 <strong>건물</strong> · <strong>전부(말소사항 포함)</strong>를 골라요</li>
            <li>1,100원을 결제하고 열람 화면에서 <strong>인쇄 → &apos;PDF로 저장&apos;</strong>해 여기에 올려요</li>
          </ol>
        </details>
        {fromPdf ? (
          // 서류를 넣은 뒤에는 큰 상자 대신 한 줄로(다음 할 일이 눈에 띄게)
          <label htmlFor={ids.file} className="file-pick compact">
            <span>다른 PDF 올리기</span>
          </label>
        ) : (
          <label htmlFor={ids.file} className="file-pick">
            <span>등기부등본 PDF 올리기</span>
          </label>
        )}
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
        {fromPdf ? (
          // PDF에서 읽은 글자는 사람이 읽을 용도가 아니라 접어 둔다(OCR 원문은 특히 지저분함). 고칠 때만 펼친다
          <details className="raw-text">
            <summary>읽은 글자 보기 (고칠 때만)</summary>
            {pasteBox}
          </details>
        ) : (
          // PDF가 기본 길이라 붙여 넣기는 접어 둔다. 글자가 들어 있으면 펼친 채로
          <details className="raw-text" open={pasteOpen || text.trim() !== ""} onToggle={(e) => setPasteOpen(e.currentTarget.open)}>
            <summary>PDF 대신 글자로 붙여 넣기</summary>
            {pasteBox}
          </details>
        )}
        {/* 진짜 서류를 넣었으면 샘플은 숨긴다("샘플도 눌러야 하나?" 헷갈리지 않게) */}
        {!fromPdf && (
          <>
            {/* 실제 서류가 주인공. 예시는 등기부가 없는 사람만 펼쳐 보게(방에서 점검할 때는 접어 둠) */}
            <details className="samples-fold">
              <summary>등기부등본이 아직 없나요? 예시 서류로 먼저 보기</summary>
              <div className="samples">
                {samples.map((s) => (
                  <button key={s.label} type="button" className="chip" onClick={() => pickSample(s)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="muted small">처음 써 보는 분을 위한 지어낸 서류예요. 실제 점검은 내 방의 등기부등본으로 해 주세요.</p>
            </details>
          </>
        )}
      </section>

      {review}

      {text.trim() && (
        <div className="sticky-cta">
          {ocr && ocrReview === "pending" && <p className="small muted">원본과 맞춰 보기 전에는 결과에 '안전'이 나오지 않아요.</p>}
          <button type="button" className="primary" onClick={() => setPane("info")}>
            다음: 내 계약 정보 →
          </button>
        </div>
      )}
      </>
      )}

      {showInputs && pane === "info" && (
      <>
      <section className="card small inputs-folded" aria-label="넣은 서류">
        <p>
          ✓ <strong>{isSample ? samples.find((x) => x.text === text)?.label : fromPdf ? "올린 PDF" : "붙여 넣은 서류"}</strong>
        </p>
        {pdfStatus?.kind === "ok" && !ocr && <p className="small muted">{pdfStatus.message}</p>}
        <button type="button" className="ghost" onClick={() => setPane("doc")}>
          ← 이전: 서류 넣기
        </button>
      </section>
      {/* 그림 PDF를 맞춰 봤으면 그 결과(고친 값)를 이 카드 위에 한 줄로 남긴다 */}
      {ocr && ocrReview !== "pending" && review}

      <section className="card">
        <h2>내 계약 정보</h2>
        <div className="field">
          <label htmlFor={ids.my} data-mark="필수">내 보증금 (원)</label>
          <MoneyInput id={ids.my} aria-required="true" aria-invalid={Boolean(errFor("내 보증금"))} aria-describedby={errFor("내 보증금") ? `${ids.my}-e` : undefined} hintId={`${ids.my}-h`} value={form.myDeposit} onChange={setMoney("myDeposit")} placeholder="예: 5,000,000" />
          {errFor("내 보증금") && <p className="field-error" role="alert" id={`${ids.my}-e`}>{errFor("내 보증금")}</p>}
        </div>
        <div className="field">
          <label htmlFor={ids.prior} data-mark="선택">앞선 세입자 보증금 합계 (원)</label>
          <MoneyInput id={ids.prior} aria-invalid={Boolean(errFor("앞선 세입자 보증금"))} hintId={`${ids.prior}-h`} value={form.priorDeposits} onChange={setMoney("priorDeposits")} placeholder="모르면 비워 두세요" />
          {errFor("앞선 세입자 보증금") && <p className="field-error" role="alert" id={`${ids.prior}-e`}>{errFor("앞선 세입자 보증금")}</p>}
          <p className="hint">다가구 원룸은 등기부에 안 나와요 · 모르면 비워 두세요</p>
          <PriorDepositGuide />
        </div>
        <div className="field">
          <label htmlFor={ids.market} data-mark="선택">이 건물 시세 (원)</label>
          <MoneyInput id={ids.market} aria-invalid={Boolean(errFor("건물 시세"))} hintId={`${ids.market}-h`} value={form.marketPrice} onChange={setMoney("marketPrice")} placeholder="예: 800,000,000 또는 8억 · 모르면 비워 두세요" />
          {errFor("건물 시세") && <p className="field-error" role="alert" id={`${ids.market}-e`}>{errFor("건물 시세")}</p>}
          <p className="hint">HUG 안심전세 앱에서 볼 수 있어요 · 모르면 비워 두세요</p>
        </div>
        <div className="field">
          <label htmlFor={ids.party} data-mark="선택">집주인 이름 (계약서에 서명할 사람)</label>
          <input id={ids.party} aria-invalid={Boolean(errFor("계약할 사람"))} value={form.contractParty} onChange={set("contractParty")} placeholder="예: 김도윤 · 모르면 비워 두세요" aria-describedby={`${ids.party}-h`} />
          {errFor("계약할 사람") && <p className="field-error" role="alert">{errFor("계약할 사람")}</p>}
          <p className="hint" id={`${ids.party}-h`}>
            내 이름 말고, 집주인이라고 들은 이름이에요
          </p>
        </div>
        <div className="sticky-cta">
          <button type="button" className="primary" onClick={start}>
            점검하기
          </button>
        </div>
      </section>
      </>
      )}

      {outcome && !outcome.ok && !fieldErr && (
        <section className="card errors" role="alert">
          <h2>이것만 고쳐 주세요</h2>
          <ul>
            {outcome.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {showInputs && savedNote && <div className="card small">{savedNote}</div>}

      {outcome?.ok && (
        <Result
          key={run}
          showNext={!room || isSample}
          outcome={outcome}
          editedFields={editedFields}
          confirmed={confirmed}
          reviewed={Boolean(ocr) && ocrReview === "ok"}
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

      {outcome?.ok && (
        <nav className="card check-next" aria-label="다음 단계">
          <h2>다음 단계</h2>
          {room && !isSample ? (
            <>
              <Link href={`${withRoom("/steps/4", room.id)}#next-title`} className="primary-link">
                다음: 결과에 맞춘 할 일 →
              </Link>
              <p className="small muted">집주인에게 물어볼 말 · 특약을 4단계(계약 전 서류 확인)에서 이어서 챙겨요.</p>
              {/* 갈래길: 위험이면 이 방을 계속 볼지 묻는다(그만 보면 다른 방 담기로) */}
              {outcome.result.verdict === "danger" && (
                <>
                  <p className="small strong">위험 신호가 있어요. 이 방은 그만 보고 다른 방을 찾아도 괜찮아요.</p>
                  <Link href="/rooms/new" className="nav-btn">
                    이 방 그만 보기 · 다른 방 담기
                  </Link>
                </>
              )}
            </>
          ) : room ? (
            <>
              <p className="small">예시 서류 결과는 이 방에 저장하지 않아요. 이 방의 등기부등본을 올리면 결과가 방에 저장되고 4단계로 이어져요.</p>
              {/* 막다른 곳이 되지 않게(11/28 UX): 서류 넣기로 바로 돌아가는 버튼 */}
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setInputsOpen(true);
                  setPane("doc");
                  window.scrollTo?.({ top: 0 });
                }}
              >
                ← 이전: 서류 넣기 (이 방 등기부등본 올리기)
              </button>
            </>
          ) : (
            <>
              <Link href="/rooms/new" className="primary-link">
                다음: 방 담기 →
              </Link>
              <p className="small muted">방을 담고 그 방에서 등기부등본을 점검하면 결과 · 질문 · 계약 6단계를 이어서 챙겨 드려요.</p>
            </>
          )}
        </nav>
      )}

      <p className="disclaimer">
        참고용 안내예요. 최종 확인은 공인중개사 · 법률 전문가에게 받아 주세요.
      </p>
    </main>
  );
}

/** 입력한 금액(만 원 · '8억')을 '9억 원'처럼 읽기 쉽게. 비었거나 이상하면 null */
function money(raw: string): string | null {
  const p = parseManwon(raw, "금액");
  return p.ok && p.won !== null ? formatWon(p.won) : null;
}

/** 사용자가 고친 칸 이름 (없으면 빈 배열) */
export function editedFieldsOf(original: RegistryRead | null, edited: RegistryRead | null): string[] {
  if (!original || !edited) return [];
  const out: string[] = [];
  if (original.current_owner !== edited.current_owner) out.push("집주인");
  const sig = (r: RegistryRead) => JSON.stringify(r.active_mortgages.map((m) => [m.max_claim, m.creditor]));
  if (sig(original) !== sig(edited)) out.push("근저당");
  return out;
}

function Result({
  showNext,
  outcome,
  editedFields,
  confirmed,
  reviewed,
  onEdit,
  onConfirm,
}: {
  /** 방에서 실제 서류로 점검했으면 false: 결과에 맞춘 할 일은 4단계에서 한 번만 보여 준다(같은 내용 두 번 X) */
  showNext: boolean;
  outcome: Extract<CheckOutcome, { ok: true }>;
  editedFields: string[];
  confirmed: boolean;
  /** 그림 PDF를 위에서 원본과 맞춰 봤으면 아래 '읽은 내용 확인 · 고치기'는 겹치므로 뺀다 */
  reviewed: boolean;
  onEdit: (r: RegistryRead) => void;
  onConfirm: (v: boolean) => void;
}) {
  const { result, flags, readWarnings, blocking, read, ratioLines } = outcome;
  const readUnconfirmed = !confirmed && readWarnings.length > 0;
  const toCheck = flags.filter((f) => f.level !== "info");
  const notes = flags.filter((f) => f.level === "info");
  const good = goodPoints(result, ratioLines);
  const unknowns = unknownsFor(read, result);
  const actions = buildActions(read, result);
  const summary = summaryLines(toCheck[0]?.short ?? null, actions.todos[0] ?? null, good.length, unknowns.length);
  // 이 결과 화면의 이유 문장들: 같은 용어는 처음 나올 때만 누를 수 있게
  const segs = splitAll(flags.map((f) => f.title));
  const segOf = (code: string) => segs[flags.findIndex((f) => f.code === code)];
  const anyTerm = segs.some((g) => g.some((x) => x.term));
  const firstHasTerm = toCheck.length > 0 && Boolean(segOf(toCheck[0].code)?.some((x) => x.term));
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
      {editedFields.length > 0 && (
        <p className="edited-note" role="status">
          ✎ 내가 고친 값({editedFields.join(" · ")})으로 다시 계산한 결과예요. 서류와 다르게 고쳤다면 결과도 달라져요.
        </p>
      )}
      {/* 확인할 것이 있으면 바로 아래 '가장 먼저 확인할 것' 카드 · '자세히 보기'와 같은 말이라 요약 줄은 뺀다(11/28 글자 줄이기). 없을 때만 요약 */}
      {toCheck.length === 0 && (
        <ul className="summary-lines">
          {summary.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}

      {blocking.length > 0 && (
        <div className="card warn" role="status">
          <h3>{readUnconfirmed ? "못 읽은 칸이 있어요" : "확인이 필요해요"}</h3>
          <ul>
            {blocking.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {readUnconfirmed && <p className="small">아래 "읽은 내용 확인 · 고치기"에서 직접 확인해 주세요. 확인 전에는 '안전'이 나오지 않아요.</p>}
        </div>
      )}

      {/* 용어 안내는 누를 단어가 보이는 곳에만: 펼친 첫 이유에 단어가 있으면 위에, 없으면 '자세히 보기' 안에 */}
      {firstHasTerm && <TermHint />}

      {/* 요약 먼저(E): 가장 급한 이유 하나만 펼쳐 두고, 나머지는 '자세히 보기'로 */}
      {toCheck.length > 0 && (
        <>
          <h3 className="list-title">가장 먼저 확인할 것</h3>
          <ul className="flags">
            <FlagItem f={toCheck[0]} segments={segOf(toCheck[0].code)} todo={todoFor(toCheck[0].code, read, result)} />
          </ul>
        </>
      )}

      {readUnconfirmed && !reviewed && <ReadEditor read={read} hasWarnings={readWarnings.length > 0} confirmed={confirmed} onEdit={onEdit} onConfirm={onConfirm} />}

      <details className="result-more">
        <summary>
          자세히 보기
          <span className="small muted">
            {[toCheck.length > 1 ? `확인할 것 ${toCheck.length - 1}개 더` : null, result.ratio !== null ? "빚 비율" : null, good.length ? "괜찮은 점" : null, `등기부로 알 수 없는 것 ${unknowns.length}가지`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </summary>
        {anyTerm && !firstHasTerm && <TermHint />}
        {toCheck.length > 1 && (
          <>
            <h3 className="list-title">확인할 것 더</h3>
            <ul className="flags">
              {toCheck.slice(1).map((f) => (
                <FlagItem key={f.code} f={f} segments={segOf(f.code)} todo={todoFor(f.code, read, result)} />
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
                <FlagItem key={f.code} f={f} segments={segOf(f.code)} todo={todoFor(f.code, read, result)} />
              ))}
            </ul>
          </>
        )}

        <UnknownList items={unknowns} />

        {!readUnconfirmed && !reviewed && <ReadEditor read={read} hasWarnings={readWarnings.length > 0} confirmed={confirmed} onEdit={onEdit} onConfirm={onConfirm} />}
        <HelpCard />
      </details>

      {showNext && <NextActions actions={actions} termHint={!firstHasTerm} />}
    </section>
  );
}

function FlagItem({ f, segments, todo }: { f: FlagView; segments?: Segment[]; todo?: string | null }) {
  return (
    <li className={`flag flag-${f.level}`}>
      <span className="flag-level">{LEVEL_LABEL[f.level]}</span>
      <p className="flag-title">{segments ? <TermText segments={segments} /> : f.title}</p>
      <details className="flag-explain">
        <summary>왜 문제인지 · 할 일</summary>
        <dl>
          <dt>무슨 뜻</dt>
          <dd>{f.meaning}</dd>
          <dt>왜 위험</dt>
          <dd>{f.why}</dd>
          {todo && (
            <>
              <dt>할 일</dt>
              <dd>{todo}</dd>
            </>
          )}
        </dl>
      </details>
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
      <p className="small ratio-range">{ratioRangeText(ratio, lines)}</p>
      <p className="small muted">
        {lines.caution}% · {lines.danger}%는 법으로 정한 기준이 아니라 많이 쓰는 참고선이에요. 시세는 직접 적은 값이라 실제와 다를 수 있어요.
      </p>
    </div>
  );
}

/** 시세가 10% 다르면 비율이 어떻게 되는지 — 시세는 추정값이라 범위로도 보여 준다 */
export function ratioRangeText(ratio: number, lines: { caution: number; danger: number }): string {
  const r = (x: number) => Math.round(x * 10) / 10;
  const ifLower = r(ratio / 0.9);
  const ifHigher = r(ratio / 1.1);
  const base = `시세가 10% 낮으면 ${ifLower}%, 10% 높으면 ${ifHigher}%예요.`;
  if (ratio < lines.danger && ifLower >= lines.danger) return `${base} 시세가 조금만 낮아도 ${lines.danger}%를 넘어요.`;
  if (ratio < lines.caution && ifLower >= lines.caution) return `${base} 시세가 조금만 낮아도 ${lines.caution}%를 넘어요.`;
  return base;
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
        setError("근저당 금액은 원 단위 숫자로 적어 주세요. 예: 120,000,000");
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
      <p className="field-label">말소되지 않은 근저당 (채권최고액, 원)</p>
      {mortgages.length === 0 && <p className="small muted">읽은 근저당이 없어요.</p>}
      {mortgages.map((m, i) => (
        <div className="row" key={i}>
          <MoneyInput
            aria-label={`근저당 ${i + 1} 금액 (원)`}
            value={m.amount}
            onChange={(v) => setMortgages((ms) => ms.map((x, j) => (j === i ? { ...x, amount: v } : x)))}
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
