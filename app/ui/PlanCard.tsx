"use client";
// "오늘은 여기까지 · ○○날 만나요": 지금 단계의 '그날'을 정하고, 그날 할 일 수 · D-day · 캘린더 추가를 보여 준다.
import { useState } from "react";
import type { Step } from "@/lib/content";
import { DAY_LABEL, dayLine, icsEvent, koreanDay } from "@/lib/plan";
import { todayKST } from "@/lib/registry/check";

export default function PlanCard({ step, date, roomLabel, roomId, onSave }: { step: Step; date: string | undefined; roomLabel: string; roomId: string; onSave: (date: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(date ?? "");
  const today = todayKST();
  const label = DAY_LABEL[step.id] ?? "그날";

  const addToCalendar = () => {
    if (!date) return;
    const ics = icsEvent({
      uid: `${roomId}-${step.id}`,
      date,
      title: `홈체크 · ${roomLabel} ${label}`,
      description: `${step.no}단계 ${step.title}\n${step.items.map((i) => `- ${i.text}`).join("\n")}`,
      url: `${location.origin}/room?id=${encodeURIComponent(roomId)}`,
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = `homecheck-${step.id}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // 날짜를 아직 안 정했으면 버튼 한 줄로 접어 둔다(지금 할 일 버튼보다 눈에 띄지 않게, 11/28 단순하게)
  if (!date && !editing)
    return (
      <button type="button" className="ghost plan-open" onClick={() => setEditing(true)}>
        📅 오늘은 여기까지 · 그날 정하기
      </button>
    );
  if (editing || !date)
    return (
      <div className="card plan-card">
        <p className="strong">오늘은 여기까지 해도 괜찮아요</p>
        <p className="small">
          다음은 <strong>{step.no}단계 · {step.title}</strong>예요. {label}을 정해 두면 그날 할 일을 챙겨 드릴게요.
        </p>
        <label className="small plan-date">
          {label}
          <input type="date" min={today} value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <button
          type="button"
          className="primary"
          disabled={!draft}
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
        >
          이날로 정하기
        </button>
      </div>
    );

  const d = dayLine(step.id, date, today);
  return (
    <div className={`card plan-card plan-${d.level}`} role="status">
      <p className="plan-head">
        <span className="plan-badge">{d.badge}</span>
        <strong>{d.level === "today" ? d.text : d.level === "past" ? d.text : `${koreanDay(date)}에 만나요`}</strong>
      </p>
      <p className="small muted">
        {label} · 그날 할 일 {step.items.length}가지({step.items.map((i) => i.text.split(" (")[0]).slice(0, 3).join(" · ")}
        {step.items.length > 3 ? " …" : ""})
      </p>
      <div className="row-buttons">
        <button type="button" className="chip" onClick={addToCalendar}>
          📅 휴대폰 캘린더에 추가
        </button>
        <button type="button" className="ghost" onClick={() => setEditing(true)}>
          날짜 바꾸기
        </button>
      </div>
    </div>
  );
}
