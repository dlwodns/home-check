// pdf.js가 브라우저에서 쓰는 작업 파일(worker)을 public/에 복사한다. npm install 때 자동으로 돈다(postinstall).
// 버전이 항상 설치된 pdfjs-dist와 같도록 저장소에는 넣지 않는다(.gitignore).
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
console.log("pdf.js worker → public/pdf.worker.min.mjs");
