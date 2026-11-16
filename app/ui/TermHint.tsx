"use client";
// 처음 한 번만: "초록 점선 단어를 누르면 뜻이 나와요". 단어를 한 번 누르거나 '알겠어요'를 누르면 다시 안 나온다.
import { useEffect, useState } from "react";
import { TERM_OPEN_EVENT } from "./TermText";

const KEY = "homecheck.hint.terms.v1";

export default function TermHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "done");
    } catch {
      setShow(true);
    }
    const done = () => {
      setShow(false);
      try {
        localStorage.setItem(KEY, "done");
      } catch {
        /* 막혀 있으면 이번 화면에서만 숨김 */
      }
    };
    window.addEventListener(TERM_OPEN_EVENT, done);
    return () => window.removeEventListener(TERM_OPEN_EVENT, done);
  }, []);

  if (!show) return null;
  return (
    <p className="term-hint" role="status">
      <span>
        <span className="term term-demo" aria-hidden="true">
          초록 점선
        </span>{" "}
        단어를 누르면 뜻이 나와요
      </span>
      <button
        type="button"
        className="linklike"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(KEY, "done");
          } catch {}
        }}
      >
        알겠어요
      </button>
    </p>
  );
}
