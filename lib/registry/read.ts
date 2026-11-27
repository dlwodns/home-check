// F2 등기부등본 규칙 기반 읽기.
// 등기사항전부증명서의 정해진 구조(표제부 · 갑구 · 을구)를 패턴으로 읽어 RegistryRead를 만든다.
// 외부 AI를 쓰지 않고, 브라우저 안에서도 그대로 돌아가도록 순수 함수로만 만든다.
//
// 읽는 규칙
// - 구역은 【 표 제 부 】, 【 갑 구 】, 【 을 구 】 표시로 나눈다 (글자 사이 띄어쓰기는 있어도 없어도 됨).
// - 한 구역 안에서 줄 맨 앞에 순위번호(예: 1, 2, 1-1)가 오면 새 기록이 시작되고, 그렇지 않은 줄은 앞 기록에 이어 붙인다.
// - 말소 기록("1번근저당권설정등기말소")은 해당 순위번호의 기록을 지운 것으로 처리한다.
// - 못 읽은 것은 지어내지 않고 warnings에 남겨, 화면에서 사용자가 직접 입력하게 한다.
// - 실제 열람본은 칸이 여러 줄로 나뉘고(등기목적 "1번근저당권설 / 정등기말소"), 쪽이 바뀌면 머리글 · 쪽 번호가 끼어든다.
//   그래서 등기목적은 띄어쓰기를 지운 글로 보고, 쪽 머리글 줄은 버리고, 사람은 '이름 + 주민 · 법인등록번호' 모양으로 찾는다.
//   (11/17 블라인드 시험 서류 10건에서 찾은 문제를 고침)
import type { Jeonse, Mortgage, ReadResult, RegistryRead, RiskRecord, RiskType, Seizure } from "./types";

const SECTION = {
  title: /【\s*표\s*제\s*부\s*】/,
  gap: /【\s*갑\s*구\s*】/,
  eul: /【\s*을\s*구\s*】/,
} as const;

const BUILDING_TYPES = [
  "다가구주택",
  "다세대주택",
  "단독주택",
  "연립주택",
  "다중주택",
  "아파트",
  "오피스텔",
  "근린생활시설",
];

interface Entry {
  /** 순위번호. 부기등기는 "1-1"처럼 붙는다 */
  rank: string;
  /**
   * 등기목적 칸. 줄바꿈으로 나뉜 조각은 이어 붙이고("가압 / 류" → "가압류"), 한 순위번호 안에 등기가 더 있으면
   * 따로 넣는다(예: "소유권이전" + "3번신탁등기말소", 가등기 + 본등기 "소유권이전"). 띄어쓰기는 지운다.
   */
  purposes: string[];
  /** 그 순위번호의 모든 글자(권리자 · 금액 등을 찾는 데 씀) */
  text: string;
  /** 순위번호만 있는 줄 다음이라 첫 줄이 등기목적이어야 함(칸마다 한 줄씩 나오는 형식) */
  waitingPurpose: boolean;
}

/** 줄바꿈 · 전각 공백 · 표 구분선을 정리한다. */
function normalize(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    // 박스 문자로 그린 표(│ ├ ┼ …)는 칸 구분만 지우고 내용은 남긴다
    .replace(/[│┃║]/g, " ")
    .replace(/^[\s├┼┤┌┐└┘┬┴─━═+|-]+$/gm, "")
    .replace(/[　 ]/g, " ");
}


/** 전체 글에서 한 구역의 본문만 잘라 낸다. 같은 구역 머리글이 쪽 경계에서 다시 나오면 이어서 읽고,
 *  다른 【 … 】 구역(공동담보목록 등)이나 "이 하 여 백"에서 끝난다. */
function sliceSection(text: string, start: RegExp): string | null {
  const m = start.exec(text);
  if (!m) return null;
  const same = compact(m[0]);
  let rest = text.slice(m.index + m[0].length);
  let body = "";
  for (;;) {
    const marker = /【[^】]*】/.exec(rest);
    const end = /이\s*하\s*여\s*백/.exec(rest);
    if (marker && (!end || marker.index < end.index) && compact(marker[0]) === same) {
      body += rest.slice(0, marker.index) + "\n";
      rest = rest.slice(marker.index + marker[0].length);
      continue;
    }
    const stops = [marker?.index, end?.index].filter((i): i is number => i !== undefined);
    return body + rest.slice(0, stops.length ? Math.min(...stops) : undefined);
  }
}

/** 쪽이 바뀔 때 끼어드는 줄: 열람용 표시, 발행번호, 열람일시 · 쪽 번호, 다시 나오는 주소 머리글 등 */
const PAGE_NOISE =
  /^(열\s*람\s*용|발행번호|열람일시|발급일시|\[\s*(건물|집합건물|토지)\s*\]|고유번호|등기사항전부증명서|관할등기소|\*|문서\s*끝|-+\s*이\s*하)|^\d+\s*\/\s*\d+$/;

const compact = (text: string) => text.replace(/\s+/g, "");

/** 등기목적이 끝난 모양인지 (아니면 다음 줄 앞 조각을 이어 붙인다) */
function purposeComplete(p: string): boolean {
  if (/^\d+(-\d+)?번/.test(p)) return /(말소|변경|이전|경정|회복)$/.test(p) || (/지분/.test(p) && /설정$/.test(p));
  return /(보존|이전|설정|말소|변경|경정|가등기|압류|가처분|결정|임차권|전세권|신탁|귀속|해지|등기|회복)$/.test(p);
}

/** 한 순위번호 안에 따로 들어가는 등기목적(같은 순위의 본등기 · 말소 · 신탁 등)으로 보이는 첫 조각 */
const EXTRA_PURPOSE = /^(소유권(보존|이전|일부이전)|\d+(-\d+)?번\S*(말소|이전|변경)|신탁|공유자전원지분전부이전)$/;

/** 구역 본문을 순위번호 기준 기록 목록으로 나눈다. 머리글 줄(순위번호 | 등기목적 …)과 쪽 머리글은 버린다. */
function splitEntries(section: string): Entry[] {
  const entries: Entry[] = [];
  const last = () => entries[entries.length - 1];
  for (const raw of section.split("\n")) {
    const t = raw.trim();
    if (!t || /^\(.*\)$/.test(t) || /^(순위번호|표시번호)/.test(t) || PAGE_NOISE.test(t)) continue;

    // 탭으로 나뉜 표: 순위번호 \t 등기목적 \t …, 이어지는 줄은 첫 칸이 비어 있음
    if (raw.includes("\t")) {
      const cells = raw.split("\t").map((c) => c.trim());
      if (/^\d+(-\d+)?$/.test(cells[0])) {
        entries.push({ rank: cells[0], purposes: cells[1] ? [compact(cells[1])] : [], text: cells.slice(1).join(" "), waitingPurpose: !cells[1] });
        continue;
      }
      const e = last();
      if (!e) continue;
      if (cells[0] === "" && cells[1]) {
        const p = compact(cells[1]);
        const lp = e.purposes[e.purposes.length - 1];
        if (lp && !purposeComplete(lp) && /^[가-힣]{1,8}$/.test(p)) e.purposes[e.purposes.length - 1] = lp + p;
        else if (EXTRA_PURPOSE.test(p) || purposeComplete(p)) e.purposes.push(p);
      }
      e.text += " " + cells.join(" ");
      continue;
    }

    const rankOnly = /^(\d+(?:-\d+)?)$/.exec(t);
    if (rankOnly) {
      entries.push({ rank: rankOnly[1], purposes: [], text: "", waitingPurpose: true });
      continue;
    }
    const m = /^(\d+(?:-\d+)?)(?:\s*\|\s*|\s+)(.*)$/.exec(t);
    // "2020년…"처럼 날짜로 시작하는 줄은 순위번호가 아니다
    if (m && !/^\d{4}\s*년/.test(t) && !/^\d{1,3}(,\d{3})+/.test(t)) {
      const first = m[2].split(/[\s|]+/)[0] ?? "";
      entries.push({ rank: m[1], purposes: first ? [compact(first)] : [], text: m[2], waitingPurpose: !first });
      continue;
    }
    const e = last();
    if (!e) continue;
    const first = compact(t.split(/[\s|]+/)[0] ?? "");
    if (e.waitingPurpose) {
      e.purposes.push(first);
      e.waitingPurpose = false;
    } else {
      const lp = e.purposes[e.purposes.length - 1];
      if (lp && !purposeComplete(lp) && /^[가-힣]{1,8}$/.test(first)) e.purposes[e.purposes.length - 1] = lp + first;
      else if (EXTRA_PURPOSE.test(first)) e.purposes.push(first);
    }
    e.text += " " + t;
  }
  return entries;
}

/** "2026년9월1일" → "2026-09-01". 기록 안에서 처음 나오는 날짜(=접수일). "2015년3월17 / 일"처럼 '일'이 다음 줄로 밀려도 읽는다. */
function firstDate(text: string): string | null {
  const m = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})(?!\d)/.exec(text);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** "채권최고액 금360,000,000원" → 360000000. 칸이 나뉘어 금액이 몇 칸 뒤에 와도 찾는다(접수번호 · 원인 칸이 끼는 경우). */
function amountAfter(label: string, text: string): number | null {
  const m = new RegExp(`${label}[^금]{0,40}?금\\s*([\\d,]+)\\s*원`).exec(text);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/** "근저당권자 가나은행" → "가나은행". PDF에서 그 자리에서 줄이 접히면 띄어쓰기가 사라져 "근저당권자가나은행"이 되기도 한다 */
function wordAfter(label: string, text: string): string | null {
  const m = new RegExp(`${label}\\s*([^\\s|]+)`).exec(text);
  return m ? m[1] : null;
}

/** 등기목적이 "3번가압류등기말소"처럼 앞 기록을 지운 것이면 그 순위번호 */
function erasedRankOf(purpose: string): string | null {
  const m = /^(\d+(?:-\d+)?)번/.exec(purpose);
  return m && /말소$/.test(purpose) && !/말소회복/.test(purpose) ? m[1] : null;
}

/** 이름 바로 뒤에 주민등록번호(900101-*******) · 법인등록번호가 오는 사람 · 회사를 순서대로 찾는다. */
function holdersIn(text: string): string[] {
  // 숫자 바로 뒤 글자("제91833호"의 "호")는 이름이 아니다
  return [...text.matchAll(/(?<![\d가-힣A-Za-z()·])([가-힣A-Za-z()·]{2,})\s*\d{6}-[\d*]{7}/g)]
    .map((m) => m[1].replace(/^(소유자|공유자|수탁자|전세권자|가등기권자)/, ""))
    .filter((n) => n.length > 0);
}

function readTitle(section: string | null, whole: string, warnings: string[]) {
  const address =
    /\[\s*(?:건물|집합건물)\s*\]\s*([^\n]+)/.exec(whole)?.[1].trim() ??
    (section ? splitEntries(section)[0]?.text.split("|")[2]?.trim() : undefined) ??
    "";
  if (!address) warnings.push("주소를 읽지 못했어요. 직접 입력해 주세요.");

  const building_type = BUILDING_TYPES.find((t) => section?.includes(t) ?? whole.includes(t)) ?? "";
  if (!building_type) warnings.push("건물 종류를 읽지 못했어요.");
  return { address, building_type };
}

/** 말소되면 지울 수 있게 순위번호별로 위험 기록을 모은다. */
class RiskBook {
  private active = new Map<string, RiskRecord>();
  readonly erased: RiskRecord[] = [];
  add(rank: string, type: RiskType, text: string) {
    this.active.set(rank, { type, date: firstDate(text) ?? "" });
  }
  /** 이 순위번호가 위험 기록이었으면 말소 목록으로 옮기고 true */
  erase(rank: string): boolean {
    const r = this.active.get(rank);
    if (!r) return false;
    this.erased.push(r);
    this.active.delete(rank);
    return true;
  }
  get list() {
    return [...this.active.values()];
  }
}

function readGap(section: string | null, warnings: string[]) {
  // 지금 소유자들(공동 소유면 여러 명). 소유권이 넘어가거나 지분을 다 넘긴 사람은 previous_owners로
  let owners: string[] = [];
  const previous_owners: string[] = [];
  let last_ownership_transfer: string | null = null;
  const seizures = new Map<string, Seizure>();
  const risks = new RiskBook();

  const retire = (name: string) => {
    if (!previous_owners.includes(name)) previous_owners.push(name);
  };
  const replaceAll = (next: string[]) => {
    for (const o of owners) if (!next.includes(o)) retire(o);
    owners = next;
  };
  const addOwners = (more: string[]) => {
    for (const n of more) if (!owners.includes(n)) owners.push(n);
  };
  /** 옛 형식: "소유자 김도윤 …" / "공유자 지분 2분의 1 이하늘 …" (등록번호가 없을 때) */
  const namesByLabel = (text: string) =>
    [...text.matchAll(/(?:소유자|공유자)\s+(?:지분\s*\d+\s*분의\s*\d+\s+)?([가-힣A-Za-z()]+)/g)].map((m) => m[1]);
  const peopleIn = (text: string) => {
    const h = holdersIn(text);
    return h.length ? h : namesByLabel(text);
  };

  if (!section) {
    warnings.push("갑구(소유자 기록)를 찾지 못했어요. 집주인 이름을 직접 입력해 주세요.");
    return { current_owner: "", previous_owners, last_ownership_transfer, seizures: [] as Seizure[], risks };
  }

  for (const e of splitEntries(section)) {
    const [main = ""] = e.purposes;
    // 신탁: 등기목적 칸의 "신탁", 또는 한 줄 형식에서 등기원인 "신탁" · 수탁자 표시 ("신탁재산귀속" · "3번신탁등기말소"는 신탁이 끝난 것)
    const isTrust = e.purposes.some((p) => /^신탁$|^소유권이전.*신탁$/.test(p)) || /수탁자|(^|[\s|])신탁([\s|]|$)/.test(e.text);

    // 같은 순위 안의 말소(예: 소유권이전 + "3번신탁등기말소")
    for (const p of e.purposes) {
      const gone = erasedRankOf(p);
      if (gone && !risks.erase(gone)) seizures.delete(gone);
    }
    if (erasedRankOf(main)) continue;

    // 개명 · 주소 변경: "3번등기명의인표시변경 … 탁은영의 성명(명칭) 탁서윤"
    if (/등기명의인표시변경|등기명의인표시경정/.test(main)) {
      const rn = /([가-힣A-Za-z()]+)의\s*성명\s*\(?\s*명칭\s*\)?\s*([가-힣A-Za-z()]+)/.exec(e.text);
      if (rn) owners = owners.map((o) => (o === rn[1] ? rn[2] : o));
      continue;
    }

    if (/가등기$/.test(main)) {
      // 같은 순위에 본등기(소유권이전)가 있으면: 가등기권자에게 소유권이 넘어가고 가등기는 더 이상 따로 남은 위험이 아니다
      const main2 = e.purposes.slice(1).find((p) => /^소유권이전/.test(p));
      if (main2) {
        const after = e.text.slice(Math.max(0, e.text.lastIndexOf("소유권이전")));
        const who = peopleIn(after);
        if (who.length) replaceAll([who[who.length - 1]]);
        last_ownership_transfer = firstDate(after) ?? last_ownership_transfer;
        risks.add(e.rank, "가등기", e.text);
        risks.erase(e.rank);
      } else {
        risks.add(e.rank, "가등기", e.text);
      }
      continue;
    }

    const share = /^(\d+)번([가-힣A-Za-z()]+?)지분(전부|일부)이전$/.exec(main);
    if (/^소유권(보존|이전|일부이전)/.test(main) || share || /^공유자전원지분전부이전$/.test(main)) {
      const found = peopleIn(e.text);
      if (isTrust) {
        // 신탁: 등기부상 소유자가 신탁회사(수탁자)로 바뀐다 (SOURCES S13)
        const trustee = found.length ? found : [wordAfter("수탁자", e.text)].filter((x): x is string => Boolean(x));
        if (trustee.length) replaceAll(trustee);
        risks.add(e.rank, "신탁", e.text);
      } else if (share) {
        if (share[3] === "전부") {
          owners = owners.filter((o) => o !== share[2]);
          retire(share[2]);
        }
        addOwners(found);
      } else if (/^소유권일부이전$/.test(main)) {
        addOwners(found);
      } else if (found.length) {
        replaceAll(found); // 소유권보존 · 소유권이전 · 공유자전원지분전부이전
      }
      if (!/^소유권보존/.test(main)) last_ownership_transfer = firstDate(e.text);
      continue;
    }
    if (/경매개시결정$/.test(main)) {
      risks.add(e.rank, "경매개시결정", e.text);
      continue;
    }
    if (/가처분$/.test(main)) {
      risks.add(e.rank, "가처분", e.text);
      continue;
    }
    if (/임차권$/.test(main)) {
      risks.add(e.rank, "임차권등기", e.text);
      continue;
    }
    const type = /^가압류$/.test(main) ? "가압류" : /^압류$/.test(main) ? "압류" : null;
    if (type) {
      seizures.set(e.rank, {
        type,
        amount: amountAfter("청구금액", e.text) ?? 0,
        creditor: wordAfter("채권자", e.text) ?? wordAfter("권리자", e.text) ?? "",
        date: firstDate(e.text) ?? "",
      });
    }
  }

  const current_owner = owners.join(", ");
  if (!current_owner) warnings.push("현재 집주인 이름을 읽지 못했어요. 직접 입력해 주세요.");
  return {
    current_owner,
    previous_owners: previous_owners.filter((p) => !owners.includes(p)),
    last_ownership_transfer,
    seizures: [...seizures.values()],
    risks,
  };
}

function readEul(section: string | null, warnings: string[], noEulMarked = false) {
  const active = new Map<string, Mortgage>();
  const erased: Mortgage[] = [];
  const jeonses = new Map<string, Jeonse>();
  const risks = new RiskBook();
  if (!section) {
    // 을구가 아예 없는 등기부도 정상이다(빚 기록이 한 번도 없던 집). 다만 쪽이 빠진 것과 구분할 수 없으니,
    // 요약 쪽의 '기록사항 없음' 표시가 없으면 사용자가 원본을 확인하기 전에는 '안전'을 막는다.
    if (!noEulMarked) warnings.push("을구(빚 기록) 부분이 보이지 않아요. 빚 기록이 없는 집이면 원래 없지만, 쪽이 빠졌을 수도 있어요. 원본 마지막 쪽까지 들어갔는지 확인해 주세요.");
    return { active_mortgages: [] as Mortgage[], erased_mortgages: erased, jeonses: [] as Jeonse[], risks };
  }

  for (const e of splitEntries(section)) {
    const [main = ""] = e.purposes;
    let handled = false;
    for (const p of e.purposes) {
      const gone = erasedRankOf(p);
      if (!gone) continue;
      handled = p === main || handled;
      if (risks.erase(gone)) continue;
      const m = active.get(gone);
      if (m) {
        erased.push(m);
        active.delete(gone);
      }
      jeonses.delete(gone);
    }
    if (handled) continue;

    // 전세권: 전세권자는 뒤에 들어온 사람보다 전세금을 먼저 돌려받는다(민법 제303조, SOURCES S25)
    if (/전세권설정$/.test(main)) {
      const amount = amountAfter("전세금", e.text);
      if (amount === null) {
        warnings.push(`을구 ${e.rank}번 전세권의 전세금을 읽지 못했어요. 직접 확인해 주세요.`);
        continue;
      }
      jeonses.set(e.rank, { amount, holder: holdersIn(e.text)[0] ?? wordAfter("전세권자", e.text) ?? "", date: firstDate(e.text) ?? "" });
      continue;
    }
    // 근저당권설정 · "4번서동훈지분전부근저당권설정"
    if (/근저당권설정$/.test(main) && !/^\d+번근저당권/.test(main)) {
      const max_claim = amountAfter("채권최고액", e.text);
      if (max_claim === null) {
        warnings.push(`을구 ${e.rank}번 근저당의 채권최고액을 읽지 못했어요. 직접 입력해 주세요.`);
        continue;
      }
      active.set(e.rank, { max_claim, creditor: wordAfter("근저당권자", e.text) ?? "" });
      continue;
    }
    // "1-1 | 1번근저당권변경 | … 채권최고액 금…원": 금액이 바뀐 경우 원래 기록을 고친다.
    const changed = /^(\d+)번근저당권변경$/.exec(main);
    if (changed) {
      const m = active.get(changed[1]);
      const max_claim = amountAfter("채권최고액", e.text);
      if (m && max_claim !== null) m.max_claim = max_claim;
      continue;
    }
    if (/임차권$/.test(main)) risks.add(e.rank, "임차권등기", e.text);
  }
  return { active_mortgages: [...active.values()], erased_mortgages: erased, jeonses: [...jeonses.values()], risks };
}

/** 등기부등본 글자를 읽어 값과 경고를 돌려준다. */
export function readRegistry(raw: string): ReadResult {
  const text = normalize(raw);
  const warnings: string[] = [];

  if (!SECTION.title.test(text) && !SECTION.gap.test(text) && !SECTION.eul.test(text)) {
    warnings.push("등기부등본 형식을 찾지 못했어요. 등기사항전부증명서 내용을 그대로 붙여 넣어 주세요.");
  }

  const title = readTitle(sliceSection(text, SECTION.title), text, warnings);
  const gap = readGap(sliceSection(text, SECTION.gap), warnings);
  const eul = readEul(sliceSection(text, SECTION.eul), warnings, /을\s*구[\s\S]{0,20}기록\s*사항\s*없음/.test(text));

  const read: RegistryRead = {
    ...title,
    current_owner: gap.current_owner,
    previous_owners: gap.previous_owners,
    active_mortgages: eul.active_mortgages,
    erased_mortgages: eul.erased_mortgages,
    jeonses: eul.jeonses,
    seizures: gap.seizures,
    risk_records: [...gap.risks.list, ...eul.risks.list],
    erased_risk_records: [...gap.risks.erased, ...eul.risks.erased],
    last_ownership_transfer: gap.last_ownership_transfer,
  };
  return { read, warnings };
}
