// 주소 글자 → 법정동(시군구 코드 5자리 + 동 이름). 국토부 실거래 API는 시군구 코드로 묻고 동 이름으로 거른다.
// 표: data/regions.json (행정표준코드관리시스템 법정동코드 전체자료에서 지금 존재하는 읍 · 면 · 동만). 외부 호출 없음.
import data from "@/data/regions.json";

export interface Region {
  sgg: string;
  sggName: string;
  dong: string;
}

const SGG = data.sgg as Record<string, string>;
const DONGS = data.dongs as [string, string][];

/** "서울특별시" → "서울", "경기도" → "경기" (줄여 쓴 주소도 알아보게) */
const short = (w: string) => w.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, "");

export const regionLabel = (r: Region) => `${r.sggName} ${r.dong}`;

export function isKnownRegion(sgg: string, dong: string): boolean {
  return Boolean(SGG[sgg]) && DONGS.some(([c, d]) => c === sgg && d === dong);
}

export function regionOf(sgg: string, dong: string): Region | null {
  return isKnownRegion(sgg, dong) ? { sgg, sggName: SGG[sgg], dong } : null;
}

/**
 * 동 이름이 따로 떨어진 낱말로 들어 있는지. "신사동" 안의 "사동", "새내동" 안의 "내동", "중동로" 안의 "중동"은 아니다.
 * 앞: 맨 앞 · 띄어쓰기 · 숫자 · 괄호, 또는 붙여 쓴 시 · 군 · 구 뒤("마포구서교동"). 뒤: 끝 · 띄어쓰기 · 숫자 · 쉼표 · 괄호 · 하이픈.
 */
function containsWord(text: string, word: string): boolean {
  for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + 1)) {
    const before = text[i - 1];
    const after = text[i + word.length];
    const leftOk = before === undefined || /[\s\d,(]/.test(before) || /[시군구]/.test(before);
    const rightOk = after === undefined || /[\s\d,()-]/.test(after);
    if (leftOk && rightOk) return true;
  }
  return false;
}

/**
 * 주소에 들어 있는 동 이름으로 후보를 찾고, 시 · 구 이름이 같이 적혀 있으면 그 지역을 앞으로 올린다.
 * 같은 동 이름이 여러 지역에 있으면(예: 신사동) 후보를 여러 개 돌려주고, 사용자가 고른다.
 */
export function findRegions(input: string, limit = 6): Region[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length < 2) return [];
  const scored: { r: Region; score: number }[] = [];
  for (const [code, dong] of DONGS) {
    if (dong.length < 2 || !containsWord(text, dong)) continue;
    const sggName = SGG[code];
    const parts = sggName.split(" ");
    const sggHits = parts.filter((p) => text.includes(p) || (short(p).length >= 2 && text.includes(short(p)))).length;
    scored.push({ r: { sgg: code, sggName, dong }, score: sggHits * 3 + dong.length / 10 });
  }
  scored.sort((a, b) => b.score - a.score || regionLabel(a.r).localeCompare(regionLabel(b.r), "ko"));
  const best = scored[0]?.score ?? 0;
  // 시 · 구까지 맞은 후보가 있으면 덜 맞은 후보는 빼서 고르기 쉽게
  return scored.filter((s) => best < 3 || s.score >= best - 1).slice(0, limit).map((s) => s.r);
}
