// F2 등기부등본 규칙 기반 읽기.
// 등기사항전부증명서의 정해진 구조(표제부 · 갑구 · 을구)를 패턴으로 읽어 RegistryRead를 만든다.
// 외부 AI를 쓰지 않고, 브라우저 안에서도 그대로 돌아가도록 순수 함수로만 만든다.
//
// 읽는 규칙
// - 구역은 【 표 제 부 】, 【 갑 구 】, 【 을 구 】 표시로 나눈다 (글자 사이 띄어쓰기는 있어도 없어도 됨).
// - 한 구역 안에서 줄 맨 앞에 순위번호(예: 1, 2, 1-1)가 오면 새 기록이 시작되고, 그렇지 않은 줄은 앞 기록에 이어 붙인다.
// - 말소 기록("1번근저당권설정등기말소")은 해당 순위번호의 기록을 지운 것으로 처리한다.
// - 못 읽은 것은 지어내지 않고 warnings에 남겨, 화면에서 사용자가 직접 입력하게 한다.
import type { Mortgage, ReadResult, RegistryRead, RiskRecord, RiskType, Seizure } from "./types";

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
  "아파트",
  "오피스텔",
  "근린생활시설",
];

interface Entry {
  /** 순위번호. 부기등기는 "1-1"처럼 붙는다 */
  rank: string;
  text: string;
}

/** 줄바꿈 · 전각 공백 · 표 구분선을 정리한다. */
function normalize(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[　 ]/g, " ");
}

/** 전체 글에서 한 구역의 본문만 잘라 낸다. 다음 구역 표시나 "이 하 여 백"에서 끝난다. */
function sliceSection(text: string, start: RegExp): string | null {
  const m = start.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const ends = [SECTION.title, SECTION.gap, SECTION.eul, /이\s*하\s*여\s*백/]
    .map((re) => re.exec(rest)?.index)
    .filter((i): i is number => i !== undefined);
  return rest.slice(0, ends.length ? Math.min(...ends) : undefined);
}

/** 구역 본문을 순위번호 기준 기록 목록으로 나눈다. 머리글 줄(순위번호 | 등기목적 …)은 버린다. */
function splitEntries(section: string): Entry[] {
  const entries: Entry[] = [];
  for (const line of section.split("\n")) {
    const t = line.trim();
    if (!t || /^\(.*\)$/.test(t) || /^(순위번호|표시번호)/.test(t)) continue;
    const m = /^(\d+(?:-\d+)?)(?:\s*\||\s+)(.*)$/.exec(t);
    if (m) entries.push({ rank: m[1], text: m[2] });
    else if (entries.length) entries[entries.length - 1].text += " " + t;
  }
  return entries;
}

/** "2026년9월1일" → "2026-09-01". 기록 안에서 처음 나오는 날짜(=접수일)를 쓴다. */
function firstDate(text: string): string | null {
  const m = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(text);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** "금360,000,000원" → 360000000 */
function amountAfter(label: string, text: string): number | null {
  const m = new RegExp(`${label}\\s*금?\\s*([\\d,]+)\\s*원`).exec(text);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/** "근저당권자 가나은행" → "가나은행" */
function wordAfter(label: string, text: string): string | null {
  const m = new RegExp(`${label}\\s+([^\\s|]+)`).exec(text);
  return m ? m[1] : null;
}

/** "1번근저당권설정등기말소" · "3번가압류등기말소"처럼 지운 기록의 순위번호를 돌려준다. */
function erasedRank(text: string): string | null {
  const m = /(\d+(?:-\d+)?)\s*번\s*\S*?등기\s*말소/.exec(text);
  return m ? m[1] : null;
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

/** 임차권등기는 보통 을구에 오지만, 을구가 없으면 갑구에 오기도 한다. */
const LEASE = /임차권/;

function readGap(section: string | null, warnings: string[]) {
  let current_owner = "";
  const previous_owners: string[] = [];
  let last_ownership_transfer: string | null = null;
  const seizures = new Map<string, Seizure>();
  const risks = new RiskBook();

  const setOwner = (name: string) => {
    if (current_owner && current_owner !== name) previous_owners.push(current_owner);
    current_owner = name;
  };

  if (!section) {
    warnings.push("갑구(소유자 기록)를 찾지 못했어요. 집주인 이름을 직접 입력해 주세요.");
    return { current_owner, previous_owners, last_ownership_transfer, seizures: [] as Seizure[], risks };
  }

  for (const e of splitEntries(section)) {
    const erased = erasedRank(e.text);
    if (erased) {
      if (!risks.erase(erased)) seizures.delete(erased);
      continue;
    }
    // 순서가 중요하다: "소유권이전청구권가등기"는 소유권이전이 아니라 가등기, "가압류"는 "압류"를 포함한다.
    if (/가등기/.test(e.text)) {
      risks.add(e.rank, "가등기", e.text);
      continue;
    }
    if (/소유권(보존|이전)/.test(e.text)) {
      if (/신탁/.test(e.text)) {
        // 신탁: 등기부상 소유자가 신탁회사(수탁자)로 바뀐다 (SOURCES S13)
        const trustee = wordAfter("수탁자", e.text);
        if (trustee) setOwner(trustee);
        risks.add(e.rank, "신탁", e.text);
      } else {
        // "소유자 김도윤 …" / "공유자 지분 2분의 1 이하늘 …" (공동 소유는 이름 앞에 지분이 온다)
        const owners = [
          ...e.text.matchAll(/(?:소유자|공유자)\s+(?:지분\s*\d+\s*분의\s*\d+\s+)?([가-힣A-Za-z()]+)/g),
        ].map((m) => m[1]);
        if (owners.length) setOwner(owners.join(", "));
      }
      if (/소유권이전/.test(e.text)) last_ownership_transfer = firstDate(e.text);
      continue;
    }
    if (/경매개시결정/.test(e.text)) {
      risks.add(e.rank, "경매개시결정", e.text);
      continue;
    }
    if (/가처분/.test(e.text)) {
      risks.add(e.rank, "가처분", e.text);
      continue;
    }
    if (LEASE.test(e.text)) {
      risks.add(e.rank, "임차권등기", e.text);
      continue;
    }
    const type = /가압류/.test(e.text) ? "가압류" : /압류/.test(e.text) ? "압류" : null;
    if (type && !/해제/.test(e.text)) {
      seizures.set(e.rank, {
        type,
        amount: amountAfter("청구금액", e.text) ?? 0,
        creditor: wordAfter("채권자", e.text) ?? wordAfter("권리자", e.text) ?? "",
        date: firstDate(e.text) ?? "",
      });
    }
  }

  if (!current_owner) warnings.push("현재 집주인 이름을 읽지 못했어요. 직접 입력해 주세요.");
  return { current_owner, previous_owners, last_ownership_transfer, seizures: [...seizures.values()], risks };
}

function readEul(section: string | null, warnings: string[]) {
  const active = new Map<string, Mortgage>();
  const erased: Mortgage[] = [];
  const risks = new RiskBook();
  if (!section) {
    // 을구가 아예 없는 등기부도 정상이다(빚 기록이 한 번도 없던 집).
    return { active_mortgages: [] as Mortgage[], erased_mortgages: erased, risks };
  }

  for (const e of splitEntries(section)) {
    const gone = erasedRank(e.text);
    if (gone) {
      if (risks.erase(gone)) continue;
      const m = active.get(gone);
      if (m) {
        erased.push(m);
        active.delete(gone);
      }
      continue;
    }
    if (/근저당권설정/.test(e.text)) {
      const max_claim = amountAfter("채권최고액", e.text);
      if (max_claim === null) {
        warnings.push(`을구 ${e.rank}번 근저당의 채권최고액을 읽지 못했어요. 직접 입력해 주세요.`);
        continue;
      }
      active.set(e.rank, { max_claim, creditor: wordAfter("근저당권자", e.text) ?? "" });
      continue;
    }
    // "1-1 | 1번근저당권변경 | … 채권최고액 금…원": 금액이 바뀐 경우 원래 기록을 고친다.
    const changed = /(\d+)\s*번\s*근저당권변경/.exec(e.text);
    if (changed) {
      const m = active.get(changed[1]);
      const max_claim = amountAfter("채권최고액", e.text);
      if (m && max_claim !== null) m.max_claim = max_claim;
      continue;
    }
    if (LEASE.test(e.text)) risks.add(e.rank, "임차권등기", e.text);
  }
  return { active_mortgages: [...active.values()], erased_mortgages: erased, risks };
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
  const eul = readEul(sliceSection(text, SECTION.eul), warnings);

  const read: RegistryRead = {
    ...title,
    current_owner: gap.current_owner,
    previous_owners: gap.previous_owners,
    active_mortgages: eul.active_mortgages,
    erased_mortgages: eul.erased_mortgages,
    seizures: gap.seizures,
    risk_records: [...gap.risks.list, ...eul.risks.list],
    erased_risk_records: [...gap.risks.erased, ...eul.risks.erased],
    last_ownership_transfer: gap.last_ownership_transfer,
  };
  return { read, warnings };
}
