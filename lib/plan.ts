// 계약은 며칠 · 몇 주에 걸친다: 단계마다 '그날'을 정해 두고("집 보러 가는 날 만나요"), 홈에서 D-day로 보여 주고,
// 휴대폰 캘린더에 넣을 일정 파일(.ics)을 만든다. 앱이 직접 알림을 보내지 않고 캘린더 알림을 쓴다.

/** 단계 id → 그날 이름 */
export const DAY_LABEL: Record<string, string> = {
  prepare: "준비하는 날",
  search: "집 찾아보는 날",
  visit: "집 보러 가는 날",
  documents: "서류 확인하는 날",
  contract: "계약하는 날",
  move_in: "이사하는 날",
};

export const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const WEEK = "일월화수목금토";
/** "2026-12-01" → "12월 1일(화)" */
export function koreanDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일(${WEEK[w]})`;
}

/** 오늘(YYYY-MM-DD, 한국 시간) 기준 남은 날: 0 = 오늘, 음수 = 지남 */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}

/** 홈 카드용 한 줄: "D-2 · 12월 1일(화) 집 보러 가는 날" / "오늘이 집 보러 가는 날이에요" / "12월 1일(화) 집 보러 가는 날이 지났어요" */
export function dayLine(stepId: string, date: string, today: string): { badge: string; text: string; level: "today" | "soon" | "later" | "past" } {
  const label = DAY_LABEL[stepId] ?? "그날";
  const n = daysUntil(date, today);
  if (n === 0) return { badge: "오늘", text: `오늘이 ${label}이에요`, level: "today" };
  if (n < 0) return { badge: "지남", text: `${koreanDay(date)} ${label}이 지났어요 · 했다면 체크해 주세요`, level: "past" };
  return { badge: `D-${n}`, text: `${koreanDay(date)} ${label}`, level: n <= 3 ? "soon" : "later" };
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** 하루 종일 일정 1개 + 전날 오전 9시 알림. 줄바꿈은 CRLF(캘린더 표준) */
export function icsEvent(o: { uid: string; date: string; title: string; description: string; url?: string; now?: Date }): string {
  const day = o.date.replace(/-/g, "");
  const next = new Date(Date.parse(o.date) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = (o.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//homecheck//ko",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${o.uid}@homecheck`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${icsText(o.title)}`,
    `DESCRIPTION:${icsText(o.description)}`,
    ...(o.url ? [`URL:${o.url}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(o.title)}`,
    "TRIGGER:-PT15H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
