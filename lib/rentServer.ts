// F6 동네 시세 서버 처리 (app/api/rent/route.ts가 부름): 브라우저 → 이 서버 → 국토부. 키(DATA_GO_KR_API_KEY)는 서버에서만 읽고 응답 · 로그에 남기지 않는다.
// 5주차 원칙: 15초 타임아웃, 429 · 5xx만 한 번 다시 시도, 같은 지역 · 같은 달은 저장해 두고 다시 쓰기(캐시).
// 받는 값은 시군구 코드 + 동 이름뿐(번지 · 등기부 내용은 받지 않음). 표에 없는 지역은 거절해 아무 주소나 대신 부르는 통로가 되지 않게.
import { isKnownRegion } from "@/lib/region";
import { monthsBack, parseRentXml, summarizeRent, type RentDeal } from "@/lib/rent";

const ENDPOINT = "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent";
const MONTHS = 6;
const TTL_MS = 12 * 3600_000;
const MAX_CACHE = 600;
const PAGE = 1000;

type Fetcher = typeof fetch;
const cache = new Map<string, { at: number; deals: RentDeal[] }>();

/** 테스트용: 캐시 비우기 */
export function _resetCache() {
  cache.clear();
}

// 요청 횟수 제한: 남이 계속 불러 공공데이터 키의 하루 한도를 다 쓰지 못하게, 같은 IP는 1분에 RATE_MAX번까지.
// shortcut: 서버 인스턴스마다 따로 세는 메모리 카운터라 여러 대로 나뉘면 느슨해진다. 실제 서비스면 Netlify 속도 제한 규칙이나 공용 저장소(예: Redis)로.
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { start: number; n: number }>();

/** 이 IP의 요청을 받아도 되면 0, 아니면 다시 시도까지 남은 초 */
export function rateLimit(ip: string, nowMs = Date.now()): number {
  const h = hits.get(ip);
  if (!h || nowMs - h.start >= RATE_WINDOW_MS) {
    if (hits.size >= 5000) hits.clear(); // 메모리가 끝없이 늘지 않게
    hits.set(ip, { start: nowMs, n: 1 });
    return 0;
  }
  if (h.n >= RATE_MAX) return Math.ceil((h.start + RATE_WINDOW_MS - nowMs) / 1000);
  h.n++;
  return 0;
}

/** 테스트용 */
export function _resetRate() {
  hits.clear();
}

class UpstreamError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

async function call(f: Fetcher, url: URL): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await f(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    } catch {
      if (attempt === 0) continue; // 시간 초과 · 연결 끊김은 한 번만 다시
      throw new UpstreamError("network");
    }
    if (res.ok) return res.text();
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    throw new UpstreamError(`http_${res.status}`);
  }
  throw new UpstreamError("retry");
}

async function monthDeals(f: Fetcher, key: string, sgg: string, ym: string): Promise<RentDeal[]> {
  const ck = `${sgg}|${ym}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.deals;
  const deals: RentDeal[] = [];
  for (let page = 1; page <= 3; page++) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("serviceKey", key);
    url.searchParams.set("LAWD_CD", sgg);
    url.searchParams.set("DEAL_YMD", ym);
    url.searchParams.set("numOfRows", String(PAGE));
    url.searchParams.set("pageNo", String(page));
    const parsed = parseRentXml(await call(f, url));
    if (!parsed.ok) throw new UpstreamError(`code_${parsed.code}`);
    deals.push(...parsed.deals);
    if (page * PAGE >= parsed.total) break;
  }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(ck, { at: Date.now(), deals });
  return deals;
}

export async function handleRent(params: URLSearchParams, env: Record<string, string | undefined>, f: Fetcher, now = new Date()): Promise<Response> {
  const sgg = params.get("sgg") ?? "";
  const dong = (params.get("dong") ?? "").trim();
  if (!/^\d{5}$/.test(sgg) || !dong || dong.length > 20 || !isKnownRegion(sgg, dong)) {
    return Response.json({ error: "bad_region" }, { status: 400 });
  }
  const key = env.DATA_GO_KR_API_KEY;
  if (!key) return Response.json({ error: "unavailable" }, { status: 503 });

  const months = monthsBack(MONTHS, now);
  try {
    const all = await Promise.all(months.map((ym) => monthDeals(f, key, sgg, ym)));
    const stats = summarizeRent(all.flat(), dong, months);
    return Response.json(stats, { headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" } });
  } catch (e) {
    // 주소(키가 들어 있음)는 남기지 않고 이유만 남긴다
    console.error("rent upstream failed:", e instanceof UpstreamError ? e.reason : "unknown");
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}

