// 브라우저에서 쓰는 작업 파일을 public/에 복사한다. npm install 때 자동으로 돈다(postinstall).
// - pdf.js 작업 파일(worker): PDF 글자 읽기
// - tesseract.js 작업 파일 · 엔진(wasm) · 한국어 글자 모델: 그림(스캔) PDF를 이 기기 안에서 OCR (외부 CDN을 쓰지 않음)
// 버전이 항상 설치된 패키지와 같도록 저장소에는 넣지 않는다(.gitignore).
import { copyFileSync, cpSync, mkdirSync } from "node:fs";
mkdirSync("public/ocr", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
// 스캔 PDF 안 그림 형식(JBIG2 · JPEG2000)을 풀 때 pdf.js가 쓰는 디코더
cpSync("node_modules/pdfjs-dist/wasm", "public/pdfjs-wasm", { recursive: true });
copyFileSync("node_modules/tesseract.js/dist/worker.min.js", "public/ocr/worker.min.js");
// OCR은 LSTM 엔진만 쓰므로(oem 1) LSTM 판만. 브라우저가 SIMD 지원 여부에 따라 하나를 고른다
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"]) {
  copyFileSync(`node_modules/tesseract.js-core/${f}`, `public/ocr/${f}`);
}
copyFileSync("node_modules/@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz", "public/ocr/kor.traineddata.gz");
console.log("pdf.js worker → public/, tesseract.js(OCR) → public/ocr/");
