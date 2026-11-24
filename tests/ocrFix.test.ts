import { describe, expect, it } from "vitest";
import { ocrFix } from "@/lib/registry/ocrFix";
import { readRegistry } from "@/lib/registry/read";

describe("ocrFix: 그림 등기부 OCR 잡음 정리", () => {
  it("순위번호 뒤 잡음과 표 테두리를 걷어 낸다", () => {
    expect(ocrFix("2 、_ 소유권이전 2019년")).toBe("2 소유권이전 2019년");
    expect(ocrFix("3 . 가처분")).toBe("3 가처분");
    expect(ocrFix("|2 、. ㅣ소유권이전 ㅣ2020년")).toBe("2 |소유권이전 |2020년");
    expect(ocrFix("1-1_ ｜1번근저당권변경")).toBe("1-1 |1번근저당권변경");
  });
  it("날짜 · 금액으로 시작하는 줄은 건드리지 않는다", () => {
    expect(ocrFix("2019년5월20일 매매")).toBe("2019년5월20일 매매");
    expect(ocrFix("1,204.5분의 6.21")).toBe("1,204.5분의 6.21");
  });
  it("깨진 주민번호 가림을 7자리로, 진짜 번호(법인)는 그대로", () => {
    expect(ocrFix("서지훈 910204-\\******")).toBe("서지훈 910204-*******");
    expect(ocrFix("김미경 520306-**재제")).toBe("김미경 520306-*******");
    expect(ocrFix("홍길동 930714-0*****")).toBe("홍길동 930714-0******");
    expect(ocrFix("주식회사누리 165811-0011223")).toBe("주식회사누리 165811-0011223");
  });
  it("금액 안의 O · l을 숫자로", () => {
    expect(ocrFix("채권최고액 금24O,OOO,OOl원")).toBe("채권최고액 금240,000,001원");
  });
  it("정리하면 읽기 규칙이 소유자 · 근저당을 찾는다", () => {
    const ocr = ["【 갑구 】 ( 소유권에 관한 사항 )", "2 、_ 소유권이전 2019년5월20일 2019년4월15일 소유자 김민석 780922-\\******", "【 을 구 】", "1 、 근저당권설정 2019년5월20일 _ 2019년5월20일 채권최고액금240,000,000원", "근저당권자 주식회사가온저축은행 234711-0012345"].join("\n");
    const r = readRegistry(ocrFix(ocr)).read;
    expect(r.current_owner).toBe("김민석");
    expect(r.active_mortgages.map((m) => m.max_claim)).toEqual([240_000_000]);
  });
});
