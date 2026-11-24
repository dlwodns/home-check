import { describe, expect, it } from "vitest";
import { evidenceFor, linesFromBlocks, locate, missedEntries, type OcrLine } from "@/lib/registry/ocrCheck";
import { readRegistry } from "@/lib/registry/read";

const w = (text: string, x0: number, conf = 95) => ({ text, conf, bbox: { x0, y0: 10, x1: x0 + 50, y1: 30 } });
const lines: OcrLine[] = [
  { page: 0, words: [w("소유자", 0), w("김민석", 60), w("780922-*******", 120)] },
  { page: 1, words: [w("채권최고액", 0), w("금240,000,000원", 60, 60)] },
];

describe("ocrCheck: OCR 결과 확인 돕기", () => {
  it("값이 있는 가장 짧은 단어 묶음의 자리와 확신도를 찾는다", () => {
    expect(locate(lines, ["김민석"])).toEqual({ box: { page: 0, x0: 60, y0: 10, x1: 110, y1: 30 }, conf: 95 });
    expect(locate(lines, ["240,000,000"])?.box.page).toBe(1);
    expect(locate(lines, ["없는값"])).toBeNull();
  });
  it("판정 값마다 자리를 붙이고, 확신도가 낮거나 못 찾으면 의심 표시", () => {
    const read = readRegistry(["【 갑 구 】", "1 소유권이전 2019년5월20일 소유자 김민석 780922-*******", "【 을 구 】", "1 근저당권설정 2019년5월20일 채권최고액 금240,000,000원"].join("\n")).read;
    const ev = evidenceFor(read, lines);
    expect(ev.find((e) => e.label === "지금 집주인")).toMatchObject({ value: "김민석", doubtful: false });
    expect(ev.find((e) => e.label === "근저당 채권최고액")).toMatchObject({ value: "240,000,000원", doubtful: true });
    expect(ev.find((e) => e.label === "마지막 소유권 이전")).toMatchObject({ box: null, doubtful: true });
  });
  it("놓친 근저당 · 위험 기록을 알리되, 말소 · 요약 · 본등기된 가등기는 세지 않는다", () => {
    const empty = readRegistry("").read;
    const text = [
      "1 근저당권설정 2019년",
      "2 1번근저당권설정등기말소",
      "3 가처분 2021년",
      "4 3번가처분등기 2022년",
      "말소",
      "5 소유권이전청구권가등기 2022년",
      "가등기에 의한 본등기로 인하여",
      "주요 등기사항 요약",
      "1 근저당권설정 2019년",
    ].join("\n");
    expect(missedEntries(text, empty)).toEqual(["근저당이 원본엔 1개, 읽은 건 0개예요. 을구를 확인해 주세요."]);
    expect(missedEntries("3\n임의경매개시결정\n4\n3번임의경매개시결정등기말소\n5 가압류 2025년", empty)).toEqual([
      "원본에 '가압류' 기록이 보이는데 못 읽었어요. 확인해 주세요.",
    ]);
  });
  it("tesseract 결과 모양을 줄 목록으로 바꾼다", () => {
    const blocks = [{ paragraphs: [{ lines: [{ words: [{ text: "갑구", confidence: 90, bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] }] }] }];
    expect(linesFromBlocks(blocks, 2)).toEqual([{ page: 2, words: [{ text: "갑구", conf: 90, bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] }]);
    expect(linesFromBlocks(null, 0)).toEqual([]);
  });
});
