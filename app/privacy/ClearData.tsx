"use client";
// 이 기기에 저장된 홈체크 기록(homecheck.* 키)만 모두 지운다. 다른 사이트 · 다른 앱의 저장값은 건드리지 않는다.
import { useState } from "react";

export const STORAGE_PREFIX = "homecheck.";

export function clearHomecheckData(storage: Storage): number {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => storage.removeItem(k));
  return keys.length;
}

export default function ClearData() {
  const [step, setStep] = useState<"idle" | "confirm" | "done" | "fail">("idle");

  return (
    <section className="card">
      <h2>기록 지우기</h2>
      {step === "idle" && (
        <button type="button" className="ghost danger" onClick={() => setStep("confirm")}>
          이 기기의 홈체크 기록 모두 지우기
        </button>
      )}
      {step === "confirm" && (
        <div className="row-buttons" role="group" aria-label="기록 지우기 확인">
          <span className="small">후보 방 · 체크 · 점검 요약이 모두 지워지고 되돌릴 수 없어요.</span>
          <button
            type="button"
            className="ghost danger"
            onClick={() => {
              try {
                clearHomecheckData(window.localStorage);
                setStep("done");
              } catch {
                setStep("fail");
              }
            }}
          >
            모두 지우기
          </button>
          <button type="button" className="ghost" onClick={() => setStep("idle")}>
            취소
          </button>
        </div>
      )}
      {step === "done" && (
        <p role="status" className="small">
          ✓ 이 기기의 홈체크 기록을 지웠어요.
        </p>
      )}
      {step === "fail" && (
        <p role="alert" className="error-text">
          지우지 못했어요. 브라우저 설정에서 사이트 데이터를 지워 주세요.
        </p>
      )}
    </section>
  );
}
