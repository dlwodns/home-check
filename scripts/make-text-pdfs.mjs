// 글자로 된 등기부등본(열람 화면을 복사한 모양)을 같은 배치의 PDF로 만든다. 블라인드 시험 서류를 앱에서 PDF로 올려 보려고 쓴다.
// 줄마다, 띄어쓰기 두 칸 이상으로 나뉜 덩어리를 그 글자 위치(칸)에 맞춰 그린다 → 실제 PDF처럼 글자 조각이 칸별로 나뉜다.
// 사용법: FONT_PATH=/경로/NanumGothic-Regular.ttf node scripts/make-text-pdfs.mjs samples/blind samples/blind/pdf
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const [src = "samples/blind", out = "samples/blind/pdf"] = process.argv.slice(2);
const FONT_PATH = process.env.FONT_PATH;
if (!FONT_PATH) {
  console.error("FONT_PATH 환경변수로 한글 TTF 글꼴 경로를 알려 주세요.");
  process.exit(1);
}
const SIZE = 7;
const LINE = 10;
const CELL = 3.9; // 글자 한 칸 너비(반각 기준). 한글은 두 칸으로 센다
const PAGE = { w: 842, h: 595, margin: 28 }; // 가로로 넓은 표라 가로 방향
const wide = (ch) => /[ᄀ-ᇿ㄰-㆏가-힣　-〿＀-￯]/.test(ch);

mkdirSync(out, { recursive: true });
const fontBytes = readFileSync(FONT_PATH);
for (const file of readdirSync(src).filter((f) => /^B\d+\.txt$/.test(f))) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  let page = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - PAGE.margin;
  for (const line of readFileSync(`${src}/${file}`, "utf8").replace(/\r/g, "").split("\n")) {
    if (y < PAGE.margin) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - PAGE.margin;
    }
    let col = 0;
    for (const m of line.matchAll(/(\s*)(\S+(?: \S+)*)/g)) {
      for (const ch of m[1]) col += wide(ch) ? 2 : 1;
      const chunk = m[2];
      page.drawText(chunk, { x: PAGE.margin + col * CELL, y, size: SIZE, font, color: rgb(0, 0, 0) });
      for (const ch of chunk) col += wide(ch) ? 2 : 1;
    }
    y -= LINE;
  }
  writeFileSync(`${out}/${file.replace(".txt", ".pdf")}`, await doc.save());
}
console.log("완료");
