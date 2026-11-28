"use client";
// 그림(스캔) 등기부 PDF를 이 기기 안에서 OCR로 읽는다. 파일 · 그림은 어디에도 보내지 않는다(엔진 · 글자 모델도 이 사이트에서 받음).
// 흐름: pdf.js로 쪽마다 그림으로 그림 → tesseract.js(한국어)로 글자 · 단어 자리 읽기 → ocrFix로 잡음 정리
import { ocrFix } from "@/lib/registry/ocrFix";
import { linesFromBlocks, type OcrLine } from "@/lib/registry/ocrCheck";

export interface OcrPage {
  /** 원본 조각을 보여 줄 때 쓰는 쪽 그림(blob: 주소). 새로 읽거나 화면을 떠나면 revoke */
  url: string;
  width: number;
  height: number;
}
export interface OcrPdfResult {
  /** 읽기 규칙에 넣을 글자(잡음 정리 후) */
  text: string;
  /** 잡음 정리 전 글자(놓친 기록 세기에 씀) */
  raw: string;
  lines: OcrLine[];
  pages: OcrPage[];
}

// 글자 높이가 OCR에 알맞게(약 30px) 되도록 A4를 2.5배로 그린다
const SCALE = 3.5;
// shortcut: 쪽 수 상한 10. 등기부는 보통 2–6쪽이고, 휴대폰 메모리 · 시간(쪽당 수 초)을 지키려는 값. 실제 긴 등기부가 나오면 늘린다
export const MAX_OCR_PAGES = 10;

export async function ocrPdfFile(file: File, onProgress: (message: string) => void): Promise<OcrPdfResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), wasmUrl: "/pdfjs-wasm/" });
  const doc = await task.promise;
  if (doc.numPages > MAX_OCR_PAGES) {
    await task.destroy();
    throw new Error(`too-many-pages:${doc.numPages}`);
  }

  onProgress("글자 읽는 도구를 준비하는 중이에요(처음 한 번 약 5MB)…");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("kor", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    workerBlobURL: false,
  });
  const pages: OcrPage[] = [];
  const lines: OcrLine[] = [];
  const raws: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress(`${p} / ${doc.numPages}쪽 글자를 읽는 중이에요…`);
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d")!;
      // 투명 배경이면 OCR이 글자를 못 본다 → 흰 종이로
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      raws.push(data.text);
      lines.push(...linesFromBlocks(data.blocks, p - 1));
      const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("canvas"))), "image/png"));
      pages.push({ url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
    }
  } finally {
    await worker.terminate();
    await task.destroy();
  }
  const raw = raws.join("\n");
  return { text: ocrFix(raw), raw, lines, pages };
}
