"use client";
// 그림 PDF를 OCR로 읽은 바로 뒤, 점검 전에 판정에 쓰일 값을 원본 그림 조각과 맞춰 보고 그 자리에서 고친다.
// 집주인 이름 · 근저당 금액만 고칠 수 있고, 나머지(날짜 · 위험 기록)가 다르면 '원본과 달라요'로 표시한다 → '안전'을 막음.
import { useId, useState } from "react";
import { evidenceFor, type Evidence } from "@/lib/registry/ocrCheck";
import type { Mortgage, RegistryRead } from "@/lib/registry/types";
import type { OcrPdfResult } from "./ocrPdf";
import MoneyInput from "../ui/MoneyInput";

export type OcrReviewState = "pending" | "ok" | "differs";

/** 근저당 입력 칸 값(MoneyInput이 넘겨 준 만 원 단위 글자) → 원. 숫자가 아니면 null */
export function parseMortgageRows(rows: { amount: string; creditor: string }[]): Mortgage[] | null {
  const out: Mortgage[] = [];
  for (const m of rows) {
    const n = Number(m.amount.replace(/[,\s]/g, ""));
    if (m.amount.trim() === "" || !Number.isFinite(n) || n < 0) return null;
    out.push({ max_claim: Math.round(n * 10_000), creditor: m.creditor.trim() });
  }
  return out;
}

export default function OcrReview({
  ocr,
  original,
  current,
  missed,
  readWarnings,
  stepNo,
  state,
  editedFields,
  onDone,
  onReopen,
}: {
  ocr: OcrPdfResult;
  /** OCR 글자에서 처음 읽은 값(원본 조각을 찾는 기준) */
  original: RegistryRead;
  /** 지금 쓰는 값(고쳤으면 고친 값) */
  current: RegistryRead;
  missed: string[];
  /** 읽기 규칙이 못 읽은 칸 경고(예: 갑구를 못 찾음). 첫 문장만 짧게 보여 준다 */
  readWarnings: string[];
  /** 화면 단계 번호(예: 2) */
  stepNo: number;
  state: OcrReviewState;
  editedFields: string[];
  onDone: (state: "ok" | "differs", read: RegistryRead) => void;
  onReopen: () => void;
}) {
  const [owner, setOwner] = useState(current.current_owner);
  const [mortgages, setMortgages] = useState(current.active_mortgages.map((m) => ({ amount: String(m.max_claim / 10_000), creditor: m.creditor })));
  const [error, setError] = useState("");
  const ownerId = useId();

  if (state !== "pending") {
    return (
      <p className={`card small ocr-review-done${state === "differs" ? " differs" : ""}`} role="status">
        {state === "ok"
          ? `✓ 원본과 맞춰 봤어요${editedFields.length ? ` (고친 값: ${editedFields.join(" · ")})` : ""}`
          : "다른 값이 있다고 표시했어요. '안전'은 나오지 않아요."}{" "}
        <button type="button" className="ghost" onClick={onReopen}>
          다시 보기
        </button>
      </p>
    );
  }

  const ev = evidenceFor(original, ocr.lines);
  const owners = ev.filter((e) => e.label === "지금 집주인");
  const mortgageEv = ev.filter((e) => e.label === "근저당 채권최고액");
  const others = ev.filter((e) => !owners.includes(e) && !mortgageEv.includes(e));
  const ownerDoubt = !owners.length || owners.some((e) => e.doubtful);
  // 못 읽은 항목도 줄로 보여 준다(빠지면 '없나 보다' 하고 넘어가기 쉬움)
  const noTransfer = !original.last_ownership_transfer;
  const total = 1 + mortgages.length + others.length + (noTransfer ? 1 : 0);
  const doubtful = (ownerDoubt ? 1 : 0) + mortgages.filter((_, i) => !mortgageEv[i] || mortgageEv[i].doubtful).length + others.filter((e) => e.doubtful).length + (noTransfer ? 1 : 0);
  const notices = [...new Set(readWarnings.map((w) => w.split(/(?<=요\.)\s/)[0]))].filter((w) => !/집주인 이름을 읽지 못했어요/.test(w) || owners.length);

  const finish = (s: "ok" | "differs") => {
    if (s === "ok" && !owner.trim()) {
      setError("집주인 이름을 적어 주세요. 원본 갑구의 마지막 소유자예요.");
      return;
    }
    const parsed = parseMortgageRows(mortgages);
    if (!parsed) {
      setError("근저당 금액은 원 단위 숫자로 적어 주세요. 예: 120,000,000");
      return;
    }
    setError("");
    onDone(s, { ...current, current_owner: owner.trim(), active_mortgages: parsed });
  };

  return (
    <section className="card ocr-evidence" aria-label="원본과 맞춰 보기">
      <h2>
        {stepNo}. 원본과 맞춰 보기 <span className="muted small">({total}개)</span>
      </h2>
      <p className="small muted">
        원본 조각과 같은지만 보면 돼요. 다르면 바로 고쳐요.
        {doubtful > 0 && <> <strong>⚠ {doubtful}개</strong>는 꼼꼼히 봐 주세요.</>}
      </p>
      {(notices.length > 0 || missed.length > 0) && (
        <ul className="ocr-missed" role="status">
          {[...notices, ...missed].map((m) => (
            <li key={m}>⚠ {m}</li>
          ))}
        </ul>
      )}
      <ul>
        <li className={ownerDoubt ? "doubtful" : undefined}>
          <span className="ocr-value wide">
            <label htmlFor={ownerId} className="small muted">
              {ownerDoubt ? "⚠ " : ""}지금 집주인 (갑구의 마지막 소유자)
            </label>
            <input id={ownerId} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="원본에서 보고 적어 주세요" />
          </span>
          {owners.map((e, i) => (
            <CropOrMissing key={i} e={e} ocr={ocr} />
          ))}
        </li>
        {mortgages.map((m, i) => {
          const e = mortgageEv[i];
          return (
            <li key={i} className={!e || e.doubtful ? "doubtful" : undefined}>
              <span className="ocr-value">
                <span className="small muted">{!e || e.doubtful ? "⚠ " : ""}근저당 채권최고액 (원)</span>
                <span className="row">
                  <MoneyInput
                    aria-label={`근저당 ${i + 1} 금액 (원)`}
                    value={m.amount}
                    onChange={(v) => setMortgages((ms) => ms.map((x, j) => (j === i ? { ...x, amount: v } : x)))}
                  />
                  <button type="button" className="ghost small-btn" aria-label={`근저당 ${i + 1} 지우기`} onClick={() => setMortgages((ms) => ms.filter((_, j) => j !== i))}>
                    지우기
                  </button>
                </span>
              </span>
              {e ? <CropOrMissing e={e} ocr={ocr} /> : <span className="small muted">직접 추가함</span>}
            </li>
          );
        })}
        {others.map((e, i) => (
          <li key={`o${i}`} className={e.doubtful ? "doubtful" : undefined}>
            <span className="ocr-value">
              <span className="small muted">{e.label}</span>
              <strong>
                {e.doubtful && <span aria-label="꼼꼼히 확인">⚠ </span>}
                {e.value || "날짜 못 읽음"}
              </strong>
            </span>
            <CropOrMissing e={e} ocr={ocr} />
          </li>
        ))}
        {noTransfer && (
          <li className="doubtful">
            <span className="ocr-value">
              <span className="small muted">마지막 소유권 이전</span>
              <strong>⚠ 못 읽었어요</strong>
            </span>
            <span className="small muted">원본 갑구에서 확인해 주세요</span>
          </li>
        )}
      </ul>
      <button type="button" className="ghost" onClick={() => setMortgages((ms) => [...ms, { amount: "", creditor: "" }])}>
        + 빠진 근저당 추가
      </button>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="ocr-review-actions">
        <button type="button" className="primary" onClick={() => finish("ok")}>
          ✓ 원본과 같아요
        </button>
        <button type="button" className="ghost" onClick={() => finish("differs")}>
          날짜 · 위험 기록이 원본과 달라요
        </button>
        <p className="small muted">고친 값은 그대로 점검에 써요.</p>
      </div>
    </section>
  );
}

function CropOrMissing({ e, ocr }: { e: Evidence; ocr: OcrPdfResult }) {
  return e.box ? (
    <Crop page={ocr.pages[e.box.page]} box={e.box} label={`${e.label} 원본 조각`} />
  ) : (
    <span className="small muted">원본에서 자리를 못 찾았어요</span>
  );
}

/** 쪽 그림의 한 부분만 잘라 보여 준다(그림을 새로 만들지 않고 배경 위치로 자름) */
function Crop({ page, box, label }: { page: OcrPdfResult["pages"][number] | undefined; box: NonNullable<Evidence["box"]>; label: string }) {
  if (!page) return null;
  const pad = 8;
  const x = Math.max(0, box.x0 - pad),
    y = Math.max(0, box.y0 - pad);
  const w = Math.min(page.width, box.x1 + pad) - x,
    h = Math.min(page.height, box.y1 + pad) - y;
  const s = Math.min(1, 280 / w); // 휴대폰 폭에 맞게 줄이기만 함
  return (
    <span
      className="ocr-crop"
      role="img"
      aria-label={label}
      style={{
        width: w * s,
        height: h * s,
        backgroundImage: `url(${page.url})`,
        backgroundSize: `${page.width * s}px ${page.height * s}px`,
        backgroundPosition: `${-x * s}px ${-y * s}px`,
      }}
    />
  );
}
