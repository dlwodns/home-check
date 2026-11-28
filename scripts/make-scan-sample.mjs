// 실제 인터넷등기소 '열람용' 등기부등본처럼 생긴 그림(스캔) PDF를 가짜 예시(samples/*.txt)로 만든다(11/28).
// 실제 서류(사용자가 결제해 받은 것, 저장소에 넣지 않음)를 보고 맞춘 점: 글자 없는 그림 PDF · 쪽마다 위에 주소 줄 ·
// 표 테두리 · 구역 머리글 줄('【 갑 구 】 ( 소유권에 관한 사항 )') · 말소된 기록의 빨간 실선 · 칸 안 여러 줄(주소 · 법인번호) ·
// 가운데 '열람용' · 아래 열람일시와 쪽 번호 · 끝의 이하여백 · 관할등기소 · 안내 문구. 이름 · 주소 · 번호는 모두 지어낸 값.
// 실행: NODE_PATH=/설치폴더/node_modules CHROME_PATH=/경로/chrome node scripts/make-scan-sample.mjs [E_apartment]
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
const { chromium } = createRequire(process.env.NODE_PATH + "/")("playwright-core");

const name = process.argv[2] ?? "E_apartment";
const text = readFileSync(`samples/${name}.txt`, "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
const title = lines.find((l) => l.startsWith("등기사항전부증명서")) ?? "";
const kind = title.split(" - ")[1] ?? "건물";
const no = lines.find((l) => l.startsWith("고유번호")) ?? "";
const addr = lines.find((l) => /^\[(집합건물|건물)\]/.test(l)) ?? "";

// 칸 안 줄바꿈: 실제 서류처럼 주민 · 법인번호 뒤 주소, 채무자 · 근저당권자 · 거래가액 앞에서 줄을 나눈다
const cell = (s) =>
  esc(s.trim())
    .replace(/(\d{6}-[\d*]{7})\s+/g, "$1<br>&nbsp;&nbsp;&nbsp;")
    .replace(/\s+(채무자|근저당권자|채권자|거래가액|전세권자|청구금액|공유자)/g, "<br>$1")
    .replace(/\s+(\([^)]*지점\))/g, "<br>&nbsp;&nbsp;&nbsp;$1");

// 구역마다 표 하나. 말소된 순위번호(같은 구역의 'N번…말소')는 빨간 실선
const blocks = [];
let cur = null;
for (const l of lines) {
  const h = /^【\s*(.+?)\s*】\s*(\(.*\))?/.exec(l);
  const sub = /^\(\s*(대지권.*)\s*\)$/.exec(l);
  if (h || sub) {
    cur = { head: h ? `【 ${h[1].split("").join("   ")} 】` : "", note: h ? (h[2] ?? "").replace(/[()]/g, "").trim() : sub[1], cols: [], rows: [] };
    blocks.push(cur);
  } else if (cur && /^(표시번호|순위번호)\s*\|/.test(l)) cur.cols = l.split("|").map((x) => x.trim());
  else if (cur && /^\d+(-\d+)?\s*\|/.test(l)) cur.rows.push(l.split("|").map((x) => x.trim()));
}
for (const b of blocks) {
  const erased = new Set(b.rows.flatMap((r) => [...(r[1] ?? "").matchAll(/(\d+)번[^|]*?말소/g)].map((m) => m[1])));
  b.rows = b.rows.map((r) => ({ cells: r, strike: erased.has(r[0]) }));
}
const widths = (n) => (n === 5 ? [9, 18, 16, 16, 41] : n === 4 ? [9, 30, 22, 39] : Array(n).fill(100 / n));
const table = (b) => `
  <table>
    <tr class="sec"><th colspan="${b.cols.length}">${b.head ? `<b>${esc(b.head)}</b>&nbsp;&nbsp;&nbsp;` : ""}( ${esc(b.note)} )</th></tr>
    <tr>${b.cols.map((c, i) => `<th style="width:${widths(b.cols.length)[i]}%">${esc(c)}</th>`).join("")}</tr>
    ${b.rows.map((r) => `<tr class="${r.strike ? "strike" : ""}">${b.cols.map((_, i) => `<td>${cell(r.cells[i] ?? "")}</td>`).join("")}</tr>`).join("")}
  </table>`;

// 쪽 나누기: 표제부들 / 갑구 / 을구 + 끝맺음(실제 서류도 구역 단위로 쪽이 넘어간다)
const pages = [
  blocks.filter((b) => !/갑|을/.test(b.head)),
  blocks.filter((b) => /갑/.test(b.head)),
  blocks.filter((b) => /을/.test(b.head)),
].filter((p) => p.length);
const court = (lines.find((l) => l.startsWith("관할등기소")) ?? "관할등기소 가상지방법원 한빛등기소").replace("관할등기소", "").trim();
const viewedAt = "열람일시 : 2026년11월28일 09시30분00초";

const page = (blocksOnPage, i) => `
<section class="page">
  ${i === 0 ? `<h1>등기사항전부증명서(말소사항 포함)<br>- ${esc(kind)} -</h1><p class="no">${esc(no)}</p>` : ""}
  <p class="addr">${esc(addr)}</p>
  ${blocksOnPage.map(table).join("")}
  ${i === pages.length - 1 ? `<p class="end">-- 이 &nbsp; 하 &nbsp; 여 &nbsp; 백 --</p><p class="court">관할등기소 &nbsp;${esc(court)}</p>
  <div class="notes">* 실선으로 그어진 부분은 말소사항을 표시함. &nbsp;&nbsp; * 기록사항 없는 갑구, 을구는 '기록사항 없음'으로 표시함.<br>* 본 등기사항증명서는 열람용이므로 출력하신 등기사항증명서는 법적인 효력이 없습니다.<br>* 테스트용 가짜 서류(홈체크 예시) · 이름 · 주소 · 번호는 모두 지어낸 값입니다.</div>` : ""}
  <div class="mark">열 &nbsp; 람 &nbsp; 용</div>
  <p class="foot">${viewedAt}</p><p class="pno">${i + 1}/${pages.length}</p>
</section>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin: 0; font-family: "NanumBarunGothic","Nanum Gothic","Noto Serif CJK KR",serif; color: #111; }
  .page { position: relative; width: 794px; height: 1123px; padding: 56px 46px 70px; overflow: hidden; background: #fff; }
  h1 { text-align: center; font-size: 25px; font-weight: 600; margin: 8px 0 6px; line-height: 1.35; }
  .no { text-align: right; font-size: 12px; margin: 0 0 14px; } .addr { font-size: 12.5px; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 14px; font-size: 12px; line-height: 1.55; }
  th, td { border: 1px solid #333; padding: 5px 6px; vertical-align: top; text-align: left; word-break: keep-all; }
  th { text-align: center; font-weight: 400; letter-spacing: 3px; } tr.sec th { background: #e6e6e6; text-align: left; letter-spacing: 0; font-size: 13px; padding: 7px 10px; }
  tr.strike td { color: #444; text-decoration: line-through; text-decoration-color: #e00; text-decoration-thickness: 1.5px; }
  .end { text-align: center; font-size: 12px; margin: 4px 0 6px; } .court { text-align: right; font-size: 12.5px; margin: 0; }
  .notes { position: absolute; left: 46px; right: 46px; bottom: 96px; font-size: 11px; line-height: 1.7; color: #333; }
  .mark { position: absolute; left: 0; right: 0; top: 46%; text-align: center; font-size: 72px; color: rgba(0,0,0,0.13); font-family: serif; letter-spacing: 8px; }
  .foot { position: absolute; left: 46px; bottom: 40px; font-size: 12px; font-weight: 700; margin: 0; } .pno { position: absolute; left: 0; right: 0; bottom: 18px; text-align: center; font-size: 12px; margin: 0; }
</style></head><body>${pages.map(page).join("")}</body></html>`;

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2.5 });
await p.setContent(html, { waitUntil: "load" });
const doc = await PDFDocument.create();
const shots = await p.locator("section.page").all();
for (const s of shots) {
  const png = await doc.embedPng(await s.screenshot());
  doc.addPage([595.32, 841.92]).drawImage(png, { x: 0, y: 0, width: 595.32, height: 841.92 });
}
await b.close();
writeFileSync(`samples/pdf/${name}_scan.pdf`, await doc.save());
console.log(`samples/pdf/${name}_scan.pdf (${shots.length}쪽, 글자 없는 그림 PDF)`);
