// 등기부등본 PDF → 규칙 기반 읽기(read.ts)가 읽는 글자 모양으로 바꾼다. 브라우저 안에서만 돌아간다.
//
// 어려운 점: PDF 표의 한 칸이 여러 줄로 접히면(예: "다가구" / "주택", "금360,000," / "000원")
// 줄 단위로 읽어서는 칸이 섞인다. 그래서 표 머리글(순위번호 · 등기목적 · 접수 …)의 x 위치로 칸 경계를 잡고,
// 글자 조각마다 칸을 정해 같은 칸끼리 이어 붙인다. 순위번호 칸에 숫자가 나오면 새 기록(행)이 시작된다.

export interface TextItem {
  str: string;
  x: number;
  y: number;
  /** 글자 조각의 너비(pt). 조각 사이 띄어쓰기를 판단하는 데 쓴다 */
  w: number;
}

const HEADERS = [
  { starts: ["순위번호", "등기목적", "접수", "등기원인", "권리자"], label: "순위번호 | 등기목적 | 접수 | 등기원인 | 권리자 및 기타사항" },
  { starts: ["표시번호", "접수", "소재지번", "건물내역", "등기원인"], label: "표시번호 | 접수 | 소재지번 및 건물번호 | 건물내역 | 등기원인 및 기타사항" },
];
const SECTION = /【[^】]*】/;
const RANK = /^\d+(-\d+)?$/;
const Y_TOLERANCE = 2.5;
const X_TOLERANCE = 4;

/** 제어 문자(글꼴에 없는 글자 등)를 지우고 공백을 정리한다 */
const clean = (s: string) => s.replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ");

function groupLines(items: TextItem[]): TextItem[][] {
  const sorted = items.filter((i) => clean(i.str).trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= Y_TOLERANCE) last.push(it);
    else lines.push([it]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

/** 같은 줄 · 같은 칸의 조각을 잇는다. 사이가 벌어져 있으면 띄어쓴다 */
function joinPieces(pieces: TextItem[]): string {
  let out = "";
  let end = -Infinity;
  for (const p of pieces) {
    const s = clean(p.str);
    if (out && p.x - end > 1.5 && !out.endsWith(" ") && !s.startsWith(" ")) out += " ";
    out += s;
    end = p.x + p.w;
  }
  return out.trim();
}

function headerColumns(line: TextItem[]): { cols: number[]; label: string } | null {
  for (const h of HEADERS) {
    const xs = h.starts.map((w) => line.find((i) => clean(i.str).trim().startsWith(w))?.x);
    if (xs.every((x) => x !== undefined)) return { cols: xs as number[], label: h.label };
  }
  return null;
}

/** 페이지마다의 글자 조각 → 등기부등본 글자. 표의 행은 "순위 | 목적 | 접수 | 원인 | 권리자 …" 한 줄로 만든다 */
export function pagesToText(pages: TextItem[][]): string {
  const out: string[] = [];
  let cols: number[] | null = null;
  let row: string[] | null = null;

  const flush = () => {
    if (row) out.push(row.map((c) => c.trim()).join(" | "));
    row = null;
  };
  const colOf = (x: number) => {
    let c = 0;
    cols!.forEach((cx, i) => {
      if (x >= cx - X_TOLERANCE) c = i;
    });
    return c;
  };

  for (const items of pages) {
    flush(); // 페이지가 바뀌면 이어지던 행을 끝낸다(다음 페이지 머리 · 꼬리 글이 섞이지 않게)
    for (const line of groupLines(items)) {
      const whole = joinPieces(line);
      if (SECTION.test(whole)) {
        flush();
        cols = null;
        out.push(whole);
        continue;
      }
      const header = headerColumns(line);
      if (header) {
        flush();
        cols = header.cols;
        out.push(header.label);
        continue;
      }
      if (!cols) {
        out.push(whole);
        continue;
      }
      const byCol = new Map<number, TextItem[]>();
      for (const it of line) {
        const c = colOf(it.x);
        byCol.set(c, [...(byCol.get(c) ?? []), it]);
      }
      const first = byCol.get(0);
      if (first) {
        const rank = joinPieces(first);
        flush();
        if (!RANK.test(rank)) {
          out.push(whole); // 표 안의 일반 글(예: "-- 이 하 여 백 --")
          continue;
        }
        row = cols.map((_, i) => (i === 0 ? rank : joinPieces(byCol.get(i) ?? [])));
      } else if (row) {
        // 접힌 칸의 다음 줄: 같은 칸에 띄어쓰기 없이 잇는다 ("다가구" + "주택", "금360,000," + "000원")
        for (const [c, pieces] of byCol) row[c] = row[c] + joinPieces(pieces);
      } else {
        out.push(whole);
      }
    }
  }
  flush();
  return out.join("\n");
}

export interface PdfTextResult {
  text: string;
  pages: number;
  /** 글자가 거의 없으면 사진 · 스캔 PDF라 읽을 수 없다 */
  hasText: boolean;
}

/** pdf.js 모듈을 넘겨받아 PDF에서 글자를 뽑는다(브라우저 · 테스트에서 같은 함수를 쓰려고 모듈을 주입). */
export async function extractPdfText(
  data: ArrayBuffer | Uint8Array,
  pdfjs: { getDocument: (src: { data: Uint8Array }) => { promise: Promise<PdfDoc> } },
): Promise<PdfTextResult> {
  const doc = await pdfjs.getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data) }).promise;
  const pages: TextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((i): i is PdfItem => "str" in i)
        .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width })),
    );
  }
  const text = pagesToText(pages);
  return { text, pages: doc.numPages, hasText: text.replace(/\s/g, "").length >= 20 };
}

interface PdfItem {
  str: string;
  transform: number[];
  width: number;
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: (PdfItem | object)[] }> }>;
}
