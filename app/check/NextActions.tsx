"use client";
// F3 다음 행동 카드: 이렇게 물어보세요 · 이렇게 하세요 · 계약서 특약 · 가족 · 지인에게 보내기(복사 · 공유).
import Link from "next/link";
import { useState } from "react";
import type { NextActions as Actions } from "@/lib/registry/actions";

/** 클립보드에 복사. 막힌 환경에서는 숨긴 입력칸을 써서 한 번 더 시도한다. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={async () => {
          setState((await copyText(text)) ? "done" : "fail");
          setTimeout(() => setState("idle"), 2000);
        }}
      >
        {state === "done" ? "복사했어요" : label}
      </button>
      <span className="sr-status" role="status">
        {state === "done" ? "복사했어요" : state === "fail" ? "복사하지 못했어요. 글자를 길게 눌러 직접 복사해 주세요." : ""}
      </span>
    </>
  );
}

export default function NextActions({ actions }: { actions: Actions }) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section className="next" aria-labelledby="next-title">
      <h2 id="next-title">다음에 할 일</h2>

      {actions.questions.length > 0 && (
        <div className="card">
          <h3>집주인 · 중개사에게 이렇게 물어보세요</h3>
          <ul className="bubbles">
            {actions.questions.map((q) => (
              <li key={q}>
                <p className="bubble">{q}</p>
                <CopyButton text={q} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>이렇게 하세요</h3>
        <ol className="plain">
          {actions.todos.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h3>계약서 특약에 이렇게 적어요</h3>
        <ul className="bubbles">
          {actions.clauses.map((c) => (
            <li key={c.id}>
              <p className="small strong">{c.title}</p>
              <p className="bubble">{c.text}</p>
              <p className="small muted">
                {c.basis}
                {c.sources.map((s) => (
                  <span key={s.id}>
                    {" "}
                    · 근거 <Link href={`/sources#${s.id}`}>{s.id}</Link>
                  </span>
                ))}
              </p>
              <CopyButton text={c.text} />
            </li>
          ))}
        </ul>
      </div>

      <div className="card parent">
        <h3>가족 · 지인에게 보내기</h3>
        <p className="small muted">보증금을 함께 마련한 가족이나 믿을 만한 사람에게 보여 주세요. 집주인 이름 · 주소는 넣지 않았어요.</p>
        <pre className="summary">{actions.parentSummary}</pre>
        <div className="row-buttons">
          <CopyButton text={actions.parentSummary} label="요약 복사" />
          {canShare && (
            <button
              type="button"
              className="ghost"
              onClick={() => navigator.share({ title: "홈체크 점검 결과", text: actions.parentSummary }).catch(() => {})}
            >
              카카오톡 등으로 보내기
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
