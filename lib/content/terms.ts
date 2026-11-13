// 문장 안의 어려운 용어를 찾아 나눈다. 화면은 용어 조각에 점선 밑줄 + 한 줄 설명을 붙인다.
// 긴 말부터 찾는다: "가압류"를 "압류"로, "근저당권"을 "근저당"으로 잘못 자르지 않게.
import { terms, type Term } from "./index";

export type Segment = { text: string; term?: Term };

const WORDS = terms
  .flatMap((t) => [t.term, ...t.aliases].map((w) => ({ w, t })))
  .sort((a, b) => b.w.length - a.w.length);

/**
 * @param seen 이미 설명한 용어 id. 같은 화면에서 같은 용어에 밑줄을 반복하지 않으려고 쓴다(첫 번째만 밑줄).
 */
export function splitByTerms(text: string, seen: Set<string> = new Set()): Segment[] {
  const out: Segment[] = [];
  let buf = "";
  let i = 0;
  while (i < text.length) {
    const hit = WORDS.find(({ w }) => text.startsWith(w, i));
    if (hit && !seen.has(hit.t.id)) {
      if (buf) out.push({ text: buf });
      buf = "";
      out.push({ text: hit.w, term: hit.t });
      seen.add(hit.t.id);
      i += hit.w.length;
    } else if (hit) {
      buf += hit.w; // 이미 설명한 용어는 밑줄 없이, 하지만 더 짧은 용어로 쪼개지도 않게 통째로 넘김
      i += hit.w.length;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  if (buf) out.push({ text: buf });
  return out;
}

/**
 * 한 화면에 나오는 문장들을 순서대로 나눈다. 같은 용어는 그 화면에서 처음 나올 때만 밑줄을 긋는다.
 * 렌더링 중에 Set을 바꾸지 않도록(React가 두 번 그려도 결과가 같게) 여기서 한 번에 계산한다.
 */
export function splitAll(texts: string[]): Segment[][] {
  const seen = new Set<string>();
  return texts.map((t) => splitByTerms(t, seen));
}
