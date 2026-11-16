"use client";
// 브라우저에서 PDF 파일을 읽어 글자로 바꾼다. 파일은 이 기기 안에서만 처리하고 어디에도 보내지 않는다.
import { extractPdfText, type PdfTextResult } from "@/lib/registry/pdf";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function readPdfFile(file: File): Promise<PdfTextResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return extractPdfText(await file.arrayBuffer(), pdfjs as unknown as Parameters<typeof extractPdfText>[1]);
}
