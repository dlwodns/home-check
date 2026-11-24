"use client";
// 금액 입력 칸: 원 단위로 쉼표를 넣어 보여 주고, 옆에 "= 5,000만 원"처럼 읽기 쉽게 바로바로 풀어 준다.
// 화면 밖(폼 상태 · 판정)은 지금처럼 만 원 단위 글자를 쓴다 → 칸 경계에서만 바꾼다. '8억' · '5000만'처럼 적어도 알아듣는다.
import { useEffect, useState } from "react";
import { parseManwon, readWon } from "@/lib/registry/check";

const wonOf = (manwon: string) => {
  const p = parseManwon(manwon, "금액");
  return p.ok ? p.won : null;
};
const withCommas = (digits: string) => (digits ? Number(digits).toLocaleString("ko-KR") : "");

export default function MoneyInput({
  value,
  onChange,
  hintId,
  ...rest
}: {
  /** 만 원 단위 글자(기존 폼 값) */
  value: string;
  onChange: (manwon: string) => void;
  hintId?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const toText = (manwon: string) => {
    const w = wonOf(manwon);
    return w === null ? manwon : withCommas(String(w));
  };
  const [text, setText] = useState(() => toText(value));
  // 샘플 고르기 · 방 보증금 채우기처럼 밖에서 값이 바뀌면 칸도 따라간다
  useEffect(() => {
    setText((t) => (wonOfText(t) === wonOf(value) ? t : toText(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const won = wonOfText(text);
  return (
    <span className="money-input">
      <input
        {...rest}
        inputMode="numeric"
        value={text}
        aria-describedby={[rest["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined}
        onChange={(e) => {
          const raw = e.target.value;
          // 숫자 · 쉼표만이면 원 단위 → 쉼표 다시 넣기, '억' · '만'이 있으면 적은 그대로
          const digitsOnly = /^[\d,\s]*원?$/.test(raw);
          const next = digitsOnly ? withCommas(raw.replace(/[^\d]/g, "")) : raw;
          setText(next);
          const w = wonOfText(next);
          onChange(w === null ? (next.trim() === "" ? "" : next) : String(w / 10_000));
        }}
      />
      <span id={hintId} className="money-hint" aria-live="polite">
        {won !== null && won > 0 ? `= ${readWon(won)}` : ""}
      </span>
    </span>
  );
}

/** 칸 글자(원 · 쉼표, 또는 '8억 5000만') → 원. 못 읽으면 null */
function wonOfText(t: string): number | null {
  const s = t.replace(/[\s,]/g, "").replace(/원$/, "");
  if (s === "") return null;
  if (/^\d+$/.test(s)) return Number(s);
  return wonOf(s); // '8억' · '5000만'은 만 원 규칙으로
}
