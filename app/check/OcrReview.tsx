"use client";
// 그림 PDF를 OCR로 읽은 바로 뒤, 점검 전에 판정에 쓰일 값을 원본 그림 조각과 맞춰 보고 그 자리에서 고친다.
// 집주인 이름 · 근저당 금액만 고칠 수 있고, 나머지(날짜 · 위험 기록)가 다르면 '원본과 달라요'로 표시한다 → '안전'을 막음.
import { useId, useState } from "react";
import { evidenceFor, type Evidence } from "@/lib/registry/ocrCheck";
import type { Mortgage, RegistryRead } from "@/lib/registry/types";
import type { OcrPdfResult } from "./ocrPdf";

export type OcrReviewState = "pending" | "ok" | "differs";

/** 근저당 입력 칸(만 원) → 원. 숫자가 아니면 null */
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
          : "원본과 다른 값이 있다고 표시했어요. '안전'은 나오지 않아요. 등기부를 직접 확인해 주세요."}{" "}
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
  const doubtful = ev.filter((e) => e.doubtful).length;

  const finish = (s: "ok" | "differs") => {
    const parsed = parseMortgageRows(mortgages);
    if (!parsed) {
      setError("근저당 금액은 만 원 단위 숫자로 적어 주세요.");
      return;
    }
    setError("");
    onDone(s, { ...current, current_owner: owner.trim(), active_mortgages: parsed });
  };

  return (
    <section className="card ocr-evidence" aria-label="원본과 맞춰 보기">
      <h3>원본과 맞춰 보기 ({ev.length}개)</h3>
      <p className="small muted">
        판정에 쓰일 값만 모았어요. 값과 오른쪽 원본 조각이 같은지 보고, 다르면 바로 고쳐 주세요.
        {doubtful > 0 && <> <strong>⚠ 표시 {doubtful}개</strong>는 흐리게 읽혔거나 원본 자리를 못 찾은 것이라 특히 꼼꼼히 봐 주세요.</>}
      </p>
      {missed.length > 0 && (
        <ul className="ocr-missed" role="status">
          {missed.map((m) => (
            <li key={m}>⚠ {m}</li>
          ))}
        </ul>
      )}
      <ul>
        <li className={owners.some((e) => e.doubtful) || !owners.length ? "doubtful" : undefined}>
          <span className="ocr-value">
            <label htmlFor={ownerId} className="small muted">
              {owners.some((e) => e.doubtful) || !owners.length ? "⚠ " : ""}지금 집주인 (갑구의 마지막 소유자)
            </label>
            <input id={ownerId} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="못 읽었어요. 원본에서 보고 적어 주세요" />
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
                <span className="small muted">{!e || e.doubtful ? "⚠ " : ""}근저당 채권최고액 (만 원)</span>
                <span className="row">
                  <input
                    aria-label={`근저당 ${i + 1} 금액 (만 원)`}
                    inputMode="numeric"
                    value={m.amount}
                    onChange={(ev) => setMortgages((ms) => ms.map((x, j) => (j === i ? { ...x, amount: ev.target.value } : x)))}
                  />
                  <button type="button" className="ghost" aria-label={`근저당 ${i + 1} 지우기`} onClick={() => setMortgages((ms) => ms.filter((_, j) => j !== i))}>
                    지우기
                  </button>
                </span>
              </span>
              {e ? <CropOrMissing e={e} ocr={ocr} /> : <span className="small muted">직접 추가한 근저당</span>}
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
          ✓ 원본과 같아요(고친 값 포함)
        </button>
        <button type="button" className="ghost" onClick={() => finish("differs")}>
          날짜 · 위험 기록이 원본과 달라요
        </button>
      </div>
    </section>
  );
}

function CropOrMissing({ e, ocr }: { e: Evidence; ocr: OcrPdfResult }) {
  return e.box ? (
    <Crop page={ocr.pages[e.box.page]} box={e.box} label={`${e.label} 원본 조각`} />
  ) : (
    <span className="small muted">원본에서 자리를 못 찾았어요. PDF에서 직접 찾아봐 주세요.</span>
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
