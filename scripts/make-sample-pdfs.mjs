// 테스트용 가짜 등기부등본 글자(samples/*.txt)를 실제 등기부등본처럼 표 모양 PDF로 만든다.
// 긴 칸은 실제 서류처럼 여러 줄로 접히게(줄바꿈) 그려서, PDF 읽기가 표를 제대로 다시 맞추는지 시험한다.
//
// 사용법: FONT_PATH=/경로/NanumGothic-Regular.ttf node scripts/make-sample-pdfs.mjs
// (한글 글꼴은 저장소에 넣지 않는다. 만든 PDF에는 쓴 글자만 들어간다.)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const FONT_PATH = process.env.FONT_PATH;
if (!FONT_PATH) {
  console.error("FONT_PATH 환경변수로 한글 TTF 글꼴 경로를 알려 주세요.");
  process.exit(1);
}

const SAMPLES = ["A_safe", "B_caution", "C_danger", "D_jeonse", "E_apartment"];
const PAGE = { w: 595, h: 842, margin: 40 };
const SIZE = 8.5;
const LINE = 12;
// 갑구 · 을구 칸: 순위번호 · 등기목적 · 접수 · 등기원인 · 권리자 및 기타사항
const COLS = [40, 92, 86, 96, 201];
const TITLE_COLS = [40, 86, 130, 160, 99]; // 표제부: 표시번호 · 접수 · 소재지번 · 건물내역 · 등기원인

function wrap(text, width, font) {
  const out = [];
  let line = "";
  for (const ch of text) {
    const next = line + ch;
    if (font.widthOfTextAtSize(next, SIZE) > width - 6 && line) {
      out.push(line);
      line = ch === " " ? "" : ch;
    } else line = next;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

async function make(name, fontBytes) {
  const text = readFileSync(`samples/${name}.txt`, "utf8");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  let page = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - PAGE.margin;

  const newPageIfNeeded = (need) => {
    if (y - need < PAGE.margin) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - PAGE.margin;
    }
  };
  const textLine = (s, size = SIZE, x = PAGE.margin) => {
    newPageIfNeeded(LINE);
    page.drawText(s, { x, y, size, font, color: rgb(0, 0, 0) });
    y -= LINE + (size > SIZE ? 4 : 0);
  };
  const row = (cells, widths) => {
    const wrapped = cells.map((c, i) => wrap(c.trim(), widths[i], font));
    const lines = Math.max(...wrapped.map((w) => w.length));
    newPageIfNeeded(lines * LINE + 4);
    let x = PAGE.margin;
    wrapped.forEach((ls, i) => {
      ls.forEach((l, k) => page.drawText(l, { x: x + 2, y: y - k * LINE, size: SIZE, font }));
      x += widths[i];
    });
    page.drawLine({ start: { x: PAGE.margin, y: y - lines * LINE + 8 }, end: { x: PAGE.w - PAGE.margin, y: y - lines * LINE + 8 }, thickness: 0.3 });
    y -= lines * LINE + 4;
  };

  let widths = COLS;
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (/【\s*표\s*제\s*부\s*】/.test(l)) {
      textLine(l, 11);
      widths = TITLE_COLS;
      row(["표시번호", "접수", "소재지번 및 건물번호", "건물내역", "등기원인 및 기타사항"], widths);
    } else if (/【\s*[갑을]\s*구\s*】/.test(l)) {
      textLine(l, 11);
      widths = COLS;
      row(["순위번호", "등기목적", "접수", "등기원인", "권리자 및 기타사항"], widths);
    } else if (/^(표시번호|순위번호)/.test(l)) {
      // 머리글은 위에서 이미 그렸다
    } else if (/^\d+(-\d+)?\s*\|/.test(l)) {
      const cells = l.split("|");
      while (cells.length < widths.length) cells.push("");
      row(cells.slice(0, widths.length), widths);
    } else {
      textLine(l, /등기사항전부증명서/.test(l) ? 12 : SIZE);
    }
  }
  mkdirSync("samples/pdf", { recursive: true });
  writeFileSync(`samples/pdf/${name}.pdf`, await doc.save({ useObjectStreams: false }));
  console.log(`samples/pdf/${name}.pdf`);
}

const fontBytes = readFileSync(FONT_PATH);
for (const n of SAMPLES) await make(n, fontBytes);
