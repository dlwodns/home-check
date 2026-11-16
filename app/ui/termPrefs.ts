"use client";
// 용어 밑줄 · 말풍선 켜기/끄기 (해 봤어요인 사람은 꺼 둘 수 있게, 11/16 합의). 이 기기에만 저장한다.
import { useEffect, useState } from "react";

const KEY = "homecheck.terms.off.v1";
export const TERMS_PREF_EVENT = "homecheck:terms-pref";

export function termsOff(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setTermsOff(off: boolean) {
  try {
    if (off) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장이 막혀 있으면 이번 화면에서만 */
  }
  window.dispatchEvent(new CustomEvent<boolean>(TERMS_PREF_EVENT, { detail: off }));
}

export function useTermsOff(): boolean {
  const [off, setOff] = useState(false);
  useEffect(() => {
    setOff(termsOff());
    const on = (e: Event) => setOff((e as CustomEvent<boolean>).detail);
    window.addEventListener(TERMS_PREF_EVENT, on);
    return () => window.removeEventListener(TERMS_PREF_EVENT, on);
  }, []);
  return off;
}
