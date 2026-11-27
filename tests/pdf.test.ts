// 등기부등본 PDF 읽기 테스트.
// 1) 표 모양으로 만든 샘플 PDF 4종(scripts/make-sample-pdfs.mjs, 칸이 여러 줄로 접힘)을 실제 pdf.js로 읽어 정답표와 비교
// 2) 실제 PDF에서 생길 만한 경우(금액이 줄에서 잘림, 페이지 머리 · 꼬리 글, 페이지 넘김, 글자 없는 스캔 PDF)를 글자 조각으로 재현
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import expected from "@/samples/expected.json";
import { extractPdfText, pagesToText, type TextItem } from "@/lib/registry/pdf";
import { readRegistry } from "@/lib/registry/read";
import { judge } from "@/lib/registry/judge";
import type { CheckInputs, CheckResult, RegistryRead } from "@/lib/registry/types";

const samples = expected.samples as unknown as { file: string; read: RegistryRead; inputs: CheckInputs; expected: CheckResult }[];
const pdfjs = () => import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<Parameters<typeof extractPdfText>[1]>;

describe("샘플 PDF (칸이 여러 줄로 접힌 표)", () => {
  it.each(samples)("$file → PDF로 읽어도 정답표와 같고, 판정도 같다", async (s) => {
    const pdf = readFileSync(`samples/pdf/${s.file.replace(".txt", ".pdf")}`);
    const r = await extractPdfText(new Uint8Array(pdf), await pdfjs());
    expect(r.hasText).toBe(true);
    const { read, warnings } = readRegistry(r.text);
    expect(read).toEqual(s.read);
    expect(warnings).toEqual([]);
    expect(judge(read, s.inputs, expected.rules.as_of, warnings)).toEqual(s.expected);
  });
});

// 글자 조각 만들기: [x, y, 글자] (너비는 글자 수로 대략)
const t = (x: number, y: number, str: string): TextItem => ({ x, y, str, w: str.length * 8 });
const HEADER = (y: number) => [t(42, y, "순위번호"), t(82, y, "등기목적"), t(174, y, "접수"), t(260, y, "등기원인"), t(356, y, "권리자 및 기타사항")];

describe("표 다시 맞추기", () => {
  it("금액 · 이름이 줄 경계에서 잘려도 같은 칸끼리 이어 붙인다", () => {
    const page = [
      t(40, 700, "【 을 구 】 (소유권 이외의 권리에 관한 사항)"),
      ...HEADER(684),
      t(42, 668, "1"), t(82, 668, "근저당권설정"), t(174, 668, "2018년9월20일"), t(260, 668, "2018년9월20일"), t(356, 668, "채권최고액 금360,000,"),
      t(174, 656, "제5001호"), t(260, 656, "설정계약"), t(356, 656, "000원 채무자 김도윤 근저당권자 가"),
      t(356, 644, "나은행"),
    ];
    const { read } = readRegistry(pagesToText([page]));
    expect(read.active_mortgages).toEqual([{ max_claim: 360_000_000, creditor: "가나은행" }]);
  });

  it("표 안의 '이하여백' · 페이지 꼬리 글은 행에 섞이지 않는다", () => {
    const text = pagesToText([
      [
        t(40, 700, "【 갑 구 】 (소유권에 관한 사항)"),
        ...HEADER(684),
        t(42, 668, "1"), t(82, 668, "소유권보존"), t(174, 668, "2015년3월10일"), t(356, 668, "소유자 이하늘 850101-*******"),
        t(40, 640, "-- 이 하 여 백 --"),
        t(250, 30, "열람용 1/1"),
      ],
    ]);
    expect(text).toContain("1 | 소유권보존 | 2015년3월10일 |  | 소유자 이하늘 850101-*******");
    expect(text).toContain("\n-- 이 하 여 백 --");
    expect(text.split("\n").find((l) => l.startsWith("1 |"))).not.toContain("열람용");
  });

  it("페이지가 바뀌어 머리글이 다시 나와도 이어서 읽는다", () => {
    const p1 = [t(40, 700, "【 을 구 】 (소유권 이외의 권리에 관한 사항)"), ...HEADER(684), t(42, 668, "1"), t(82, 668, "근저당권설정"), t(174, 668, "2018년9월20일"), t(356, 668, "채권최고액 금100,000,000원 근저당권자 가나은행")];
    const p2 = [...HEADER(800), t(42, 784, "2"), t(82, 784, "근저당권설정"), t(174, 784, "2023년2월8일"), t(356, 784, "채권최고액 금50,000,000원 근저당권자 다라저축은행")];
    const { read } = readRegistry(pagesToText([p1, p2]));
    expect(read.active_mortgages.map((m) => m.max_claim)).toEqual([100_000_000, 50_000_000]);
  });

  it("같은 줄에서 띄어 쓴 조각은 띄어쓰기를 살린다", () => {
    const text = pagesToText([[t(40, 700, "[건물]"), t(100, 700, "가상시 한빛구")]]);
    expect(text).toBe("[건물] 가상시 한빛구");
  });
});

describe("읽을 수 없는 PDF", () => {
  const fake = (pages: { str: string; transform: number[]; width: number }[][]) => ({
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: async (n: number) => ({ getTextContent: async () => ({ items: pages[n - 1] }) }),
      }),
    }),
  });

  it("글자가 없는 사진 · 스캔 PDF는 hasText=false", async () => {
    const r = await extractPdfText(new Uint8Array([1]), fake([[]]));
    expect(r).toEqual({ text: "", pages: 1, hasText: false });
  });

  it("글자 조각이 아닌 항목(표시 정보)은 건너뛴다", async () => {
    const r = await extractPdfText(
      new Uint8Array([1]),
      fake([[{ str: "【 갑 구 】 (소유권에 관한 사항) 충분히 긴 글자", transform: [1, 0, 0, 1, 40, 700], width: 200 }, { type: "beginMarkedContent" } as never]]),
    );
    expect(r.hasText).toBe(true);
  });
});
