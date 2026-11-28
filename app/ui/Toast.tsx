"use client";
// 잠깐 떴다 사라지는 알림(저장했어요 · 지웠어요 [되돌리기]). 어디서나 toast()로 부르고, 화면에는 layout의 <Toaster /> 하나만 둔다.
import { useEffect, useState } from "react";

type T = { id: number; text: string; action?: { label: string; run: () => void } };
const EVENT = "homecheck:toast";
let seq = 0;

export function toast(text: string, action?: T["action"]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<T>(EVENT, { detail: { id: ++seq, text, action } }));
}

export default function Toaster() {
  const [t, setT] = useState<T | null>(null);
  useEffect(() => {
    const on = (e: Event) => setT((e as CustomEvent<T>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), t.action ? 5000 : 2200);
    return () => clearTimeout(h);
  }, [t]);
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {t && (
        <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.run();
                setT(null);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
