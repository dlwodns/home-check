// 그림 등기부(OCR)로 읽은 결과를 사람이 빨리 확인하도록 돕는다.
// 판정에 쓰는 값마다 원본 그림에서 그 글자가 있는 자리(좌표)를 찾고, OCR 확신도가 낮으면 표시한다.
import { ocrFix } from "./ocrFix";
import type { RegistryRead } from "./types";

export interface OcrBox {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface OcrWord {
  text: string;
  /** OCR 확신도 0–100 */
  conf: number;
  bbox: Omit<OcrBox, "page">;
}
export interface OcrLine {
  page: number;
  words: OcrWord[];
}

export interface Evidence {
  label: string;
  value: string;
  /** 원본 그림에서 찾은 자리. 못 찾으면 null(사용자가 직접 찾아봐야 함) */
  box: OcrBox | null;
  /** OCR 확신도가 낮거나 자리를 못 찾음 → 더 꼼꼼히 볼 것 */
  doubtful: boolean;
}

// shortcut: 확신도 기준 80은 가상 서류 그림에서 정상 글자가 대부분 90 이상이라 정한 값. 실제 스캔 측정(R2-d) 뒤 조정
const LOW_CONF = 80;
const compact = (s: string) => ocrFix(s).replace(/[\s|]+/g, "");

/** OCR 줄들에서 needle 글자들을 모두 담는 가장 짧은 단어 묶음의 자리 */
export function locate(lines: OcrLine[], needles: string[]): { box: OcrBox; conf: number } | null {
  const want = needles.map(compact).filter(Boolean);
  if (!want.length) return null;
  let best: { box: OcrBox; conf: number; n: number } | null = null;
  for (const line of lines) {
    const ws = line.words;
    for (let i = 0; i < ws.length; i++) {
      let joined = "";
      for (let j = i; j < ws.length; j++) {
        joined += compact(ws[j].text);
        if (!want.every((w) => joined.includes(w))) continue;
        const span = ws.slice(i, j + 1);
        if (!best || span.length < best.n) {
          best = {
            n: span.length,
            conf: Math.min(...span.map((w) => w.conf)),
            box: {
              page: line.page,
              x0: Math.min(...span.map((w) => w.bbox.x0)),
              y0: Math.min(...span.map((w) => w.bbox.y0)),
              x1: Math.max(...span.map((w) => w.bbox.x1)),
              y1: Math.max(...span.map((w) => w.bbox.y1)),
            },
          };
        }
        break;
      }
    }
  }
  return best && { box: best.box, conf: best.conf };
}

const dateKo = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${y}년${m}월${day}일`;
};
const won = (n: number) => n.toLocaleString("en-US");

/** 판정에 바로 쓰이는 값들만(집주인 · 근저당 · 압류 · 전세권 · 위험 기록 · 마지막 이전일) 원본 자리와 함께 */
export function evidenceFor(read: RegistryRead, lines: OcrLine[]): Evidence[] {
  const items: { label: string; value: string; needles: string[] }[] = [
    ...read.current_owner
      .split(/,\s*/)
      .filter(Boolean)
      .map((name) => ({ label: "지금 집주인", value: name, needles: [name] })),
    ...(read.last_ownership_transfer
      ? [{ label: "마지막 소유권 이전", value: dateKo(read.last_ownership_transfer), needles: [dateKo(read.last_ownership_transfer)] }]
      : []),
    ...read.active_mortgages.map((m) => ({ label: "근저당 채권최고액", value: `${won(m.max_claim)}원`, needles: [won(m.max_claim)] })),
    ...read.jeonses.map((j) => ({ label: "전세권 전세금", value: `${won(j.amount)}원`, needles: [won(j.amount)] })),
    ...read.seizures.map((s) => ({ label: s.type, value: s.date && dateKo(s.date), needles: [s.type, ...(s.date ? [dateKo(s.date)] : [])] })),
    ...read.risk_records.map((r) => ({ label: r.type, value: r.date && dateKo(r.date), needles: [r.type, ...(r.date ? [dateKo(r.date)] : [])] })),
  ];
  return items.map(({ label, value, needles }) => {
    // 날짜까지 같이 못 찾으면 종류 이름만으로라도 자리를 보여 준다
    const hit = locate(lines, needles) ?? (needles.length > 1 ? locate(lines, needles.slice(0, 1)) : null);
    return { label, value, box: hit?.box ?? null, doubtful: !hit || hit.conf < LOW_CONF };
  });
}

/** 순위번호 바로 뒤(등기목적 칸)에 나온 기록 수와 읽은 기록 수를 견줘, 놓쳤을 수 있는 기록을 알린다(OCR이 표 줄을 깨뜨린 경우).
 *  맨 뒤 '주요 등기사항 요약' · 공동담보목록은 같은 기록을 되풀이하므로 세지 않는다. */
export function missedEntries(ocrText: string, read: RegistryRead): string[] {
  const t = ocrFix(ocrText).split(/주\s*요\s*등\s*기\s*사\s*항\s*요\s*약|【\s*공\s*동\s*담\s*보/)[0];
  // '임의경매개시결정' · '소유권이전청구권가등기'처럼 앞말이 붙는 것만 앞 글자를 허용('가압류'가 '압류'로 세지지 않게)
  const prefix = (word: string) => (/^(경매개시결정|가등기)$/.test(word) ? "[가-힣]*" : "");
  const rows = (word: string) => [...t.matchAll(new RegExp(`^\\d+(?:-\\d+)?(?!\\d*번)\\s*\\|?\\s*${prefix(word)}${word}`, "gm"))].length;
  // "3번가처분등기 … 말소"처럼 '말소'가 다음 줄로 밀려도 세도록, 순위번호 뒤 "N번○○"으로 센다
  const erased = (word: string) => [...t.matchAll(new RegExp(`^\\d+(?:-\\d+)?\\s*\\|?\\s*\\d+번${prefix(word)}${word}`, "gm"))].length;
  const out: string[] = [];
  const mortgages = rows("근저당권설정");
  const readMortgages = read.active_mortgages.length + read.erased_mortgages.length;
  if (mortgages > readMortgages) out.push(`근저당이 원본엔 ${mortgages}개, 읽은 건 ${readMortgages}개예요. 을구를 확인해 주세요.`);
  const readCount: Record<string, number> = {
    가압류: read.seizures.filter((x) => x.type === "가압류").length,
    압류: read.seizures.filter((x) => x.type === "압류").length,
    전세권설정: read.jeonses.length,
  };
  // 소유권 이전을 놓치면 '지금 집주인'이 예전 소유자로 읽힌다(11/28 그림 예시에서 OCR이 '3 소유권이전' 첫 줄을 통째로 빠뜨림).
  // 매매 이전에는 갑구에 '거래가액'이 남으므로, 갑구의 거래가액 수가 읽은 이전 수보다 많으면 알린다.
  const gap = t.split(/【\s*갑\s*구\s*】/)[1]?.split(/【\s*을\s*구\s*】/)[0] ?? "";
  const prices = [...gap.matchAll(/거\s*래\s*가\s*액/g)].length;
  if (prices > read.previous_owners.length)
    out.push(`갑구에 소유권 이전(거래가액)이 ${prices}번 보이는데 읽은 건 ${read.previous_owners.length}번이에요. 지금 집주인이 맞는지 원본 갑구 끝을 확인해 주세요.`);
  for (const r of read.risk_records) readCount[r.type] = (readCount[r.type] ?? 0) + 1;
  for (const w of ["가압류", "압류", "가처분", "경매개시결정", "가등기", "임차권등기", "전세권설정"]) {
    // 가등기에 의한 본등기가 되면 그 가등기는 끝난 것(읽기 규칙도 위험으로 치지 않음)
    if (w === "가등기" && /가등기에\s*의한\s*본등기/.test(t)) continue;
    const alive = rows(w) - erased(w);
    if (alive > (readCount[w] ?? 0)) out.push(`원본에 '${w}' 기록이 보이는데 못 읽었어요. 확인해 주세요.`);
  }
  return out;
}

/** tesseract.js 결과(blocks → paragraphs → lines → words)를 쪽 번호가 붙은 줄 목록으로 */
export function linesFromBlocks(
  blocks: { paragraphs: { lines: { words: { text: string; confidence: number; bbox: OcrWord["bbox"] }[] }[] }[] }[] | null,
  page: number,
): OcrLine[] {
  return (blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) => p.lines.map((l) => ({ page, words: l.words.map((w) => ({ text: w.text, conf: w.confidence, bbox: w.bbox })) }))),
  );
}
