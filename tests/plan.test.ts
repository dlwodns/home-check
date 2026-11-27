// 단계마다 '그날' 정하기: 날짜 글 · D-day · 캘린더 파일
import { describe, expect, it } from "vitest";
import { dayLine, daysUntil, icsEvent, isDate, koreanDay } from "@/lib/plan";

describe("그날 정하기", () => {
  it("날짜 모양 검사", () => {
    expect(isDate("2026-12-01")).toBe(true);
    expect(isDate("2026-13-01")).toBe(false);
    expect(isDate("12/1")).toBe(false);
  });
  it("한국어 날짜와 요일", () => {
    expect(koreanDay("2026-12-01")).toBe("12월 1일(화)");
    expect(koreanDay("2026-11-28")).toBe("11월 28일(토)");
  });
  it("D-day · 오늘 · 지남", () => {
    expect(daysUntil("2026-12-01", "2026-11-28")).toBe(3);
    expect(dayLine("visit", "2026-12-01", "2026-11-28")).toMatchObject({ badge: "D-3", text: "12월 1일(화) 집 보러 가는 날", level: "soon" });
    expect(dayLine("visit", "2026-11-28", "2026-11-28")).toMatchObject({ badge: "오늘", text: "오늘이 집 보러 가는 날이에요" });
    expect(dayLine("contract", "2026-11-20", "2026-11-28").level).toBe("past");
    expect(dayLine("contract", "2026-12-20", "2026-11-28").level).toBe("later");
  });
  it("캘린더 파일: 하루 종일 일정 · 전날 알림 · 특수문자 처리 · CRLF", () => {
    const ics = icsEvent({ uid: "r1-visit", date: "2026-12-01", title: "홈체크 · 정문 원룸 집 보러 가는 날", description: "수압, 곰팡이; 잠금\n소음", url: "https://home-check-pi.vercel.app/room?id=r1", now: new Date("2026-11-28T00:00:00Z") });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261201\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261202\r\n");
    expect(ics).toContain("DESCRIPTION:수압\\, 곰팡이\; 잠금\\n소음\r\n");
    expect(ics).toContain("TRIGGER:-PT15H");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});
