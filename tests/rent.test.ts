// F6 동네 시세: 주소 → 법정동, XML 읽기, 분포 · 비교, 서버 처리(지역 검사 · 키 숨기기 · 다시 시도 · 캐시).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findRegions, isKnownRegion, regionLabel } from "@/lib/region";
import { compareRoom, monthSpan, monthsBack, parseRentXml, spread, summarizeRent, type RentStats } from "@/lib/rent";
import { _resetCache, _resetRate, handleRent, rateLimit } from "@/lib/rentServer";
import { parseRegion, validateRoomInput } from "@/lib/store/rooms";

const item = (dong: string, deposit: string, rent: string, type = "다가구") =>
  `<item><deposit>${deposit}</deposit><houseType>${type}</houseType><monthlyRent>${rent}</monthlyRent><sggCd>11440</sggCd><umdNm>${dong}</umdNm></item>`;
const xml = (items: string[], code = "000", total = items.length) =>
  `<?xml version="1.0"?><response><header><resultCode>${code}</resultCode><resultMsg>x</resultMsg></header><body><items>${items.join("")}</items><totalCount>${total}</totalCount></body></response>`;

describe("주소 → 법정동", () => {
  it("시 · 구 · 동이 있으면 그 동네 하나로", () => {
    const r = findRegions("서울 마포구 서교동 123-4");
    expect(r.map(regionLabel)).toEqual(["서울특별시 마포구 서교동"]);
    expect(r[0].sgg).toBe("11440");
  });

  it("같은 동 이름이 여러 곳이면 후보를 모두, 구를 적으면 그 구만", () => {
    const many = findRegions("신사동 12");
    expect(many.map((x) => x.sggName)).toEqual(expect.arrayContaining(["서울특별시 강남구", "서울특별시 은평구"]));
    expect(findRegions("강남구 신사동 12").map(regionLabel)).toEqual(["서울특별시 강남구 신사동"]);
  });

  it("없는 동 · 너무 짧은 글자는 후보 없음", () => {
    expect(findRegions("가상시 새내동 202-7")).toEqual([]);
    expect(findRegions("동")).toEqual([]);
  });

  it("표에 있는 지역만 인정 (서버 검사용)", () => {
    expect(isKnownRegion("11440", "서교동")).toBe(true);
    expect(isKnownRegion("11440", "신사동")).toBe(false);
    expect(isKnownRegion("99999", "서교동")).toBe(false);
  });

  it("후보 방에 저장되는 동네는 모양을 검사한다", () => {
    expect(parseRegion({ sgg: "11440", dong: "서교동" })).toEqual({ sgg: "11440", dong: "서교동" });
    expect(parseRegion({ sgg: "1144", dong: "서교동" })).toBeNull();
    expect(parseRegion({ sgg: "11440", dong: "<b>" })).toBeNull();
    const v = validateRoomInput({ address: "서교동 1", deposit: "500", rent: "50", note: "", region: { sgg: "11440", dong: "서교동" } });
    expect(v.ok && v.draft.region).toEqual({ sgg: "11440", dong: "서교동" });
  });
});

describe("국토부 XML 읽기", () => {
  it("쉼표 든 보증금을 숫자로, 월세 0은 전세", () => {
    const r = parseRentXml(xml([item("서교동", "2,000", "50"), item("서교동", "15,000", "0", "단독")]));
    expect(r).toEqual({
      ok: true,
      total: 2,
      deals: [
        { dong: "서교동", deposit: 2000, rent: 50, houseType: "다가구" },
        { dong: "서교동", deposit: 15000, rent: 0, houseType: "단독" },
      ],
    });
  });

  it("못 읽은 금액은 0으로 치지 않고 뺀다", () => {
    const r = parseRentXml(xml([item("서교동", " ", "50"), item("서교동", "500", "abc"), item("서교동", "500", "40")]));
    expect(r.ok && r.deals).toHaveLength(1);
  });

  it("03은 자료 없음(빈 목록), 그 밖의 코드는 실패", () => {
    expect(parseRentXml(xml([], "03"))).toEqual({ ok: true, deals: [], total: 0 });
    expect(parseRentXml(xml([], "22"))).toEqual({ ok: false, code: "22" });
    expect(parseRentXml("<OpenAPI_ServiceResponse><returnReasonCode>30</returnReasonCode></OpenAPI_ServiceResponse>")).toEqual({ ok: false, code: "30" });
  });
});

describe("분포 · 비교", () => {
  it("사분위 계산", () => {
    expect(spread([10, 20, 30, 40, 50])).toEqual({ p25: 20, mid: 30, p75: 40 });
    expect(spread([7])).toEqual({ p25: 7, mid: 7, p75: 7 });
  });

  it("같은 동만, 월세 · 전세 따로", () => {
    const s = summarizeRent(
      [
        { dong: "서교동", deposit: 500, rent: 50, houseType: "다가구" },
        { dong: "서교동", deposit: 1000, rent: 60, houseType: "다가구" },
        { dong: "서교동", deposit: 20000, rent: 0, houseType: "단독" },
        { dong: "망원동", deposit: 300, rent: 40, houseType: "다가구" },
      ],
      "서교동",
      ["202611"],
    );
    expect(s.monthly).toEqual({ count: 2, deposit: { p25: 625, mid: 750, p75: 875 }, rent: { p25: 53, mid: 55, p75: 58 } });
    expect(s.jeonse?.count).toBe(1);
  });

  const stats = (count: number, mid: number): RentStats => ({
    dong: "서교동",
    months: ["202611", "202610"],
    monthly: { count, deposit: { p25: 300, mid: 500, p75: 1000 }, rent: { p25: mid - 5, mid, p75: mid + 5 } },
    jeonse: null,
  });

  it("월세가 중간값보다 15% 넘게 높으면 '높은 편', 비슷하면 '비슷'", () => {
    expect(compareRoom({ deposit: 500, rent: 70 }, stats(10, 50)).level).toBe("high");
    expect(compareRoom({ deposit: 500, rent: 52 }, stats(10, 50))).toMatchObject({ level: "similar", text: "월세가 동네 중간값과 비슷해요" });
    expect(compareRoom({ deposit: 500, rent: 30 }, stats(10, 50)).level).toBe("low");
  });

  it("거래가 적으면 비교하지 않고 '거래 기록이 적어요', 없으면 없다고", () => {
    expect(compareRoom({ deposit: 500, rent: 70 }, stats(3, 50))).toMatchObject({ level: "few", text: expect.stringContaining("거래 기록이 적어요 (3건)") });
    expect(compareRoom({ deposit: 20000, rent: null }, stats(10, 50))).toMatchObject({ level: "none", text: expect.stringContaining("전세 신고 거래가 없어요") });
  });

  it("최근 n개월 (해 넘어감 포함, 한국 시간)", () => {
    expect(monthsBack(3, new Date("2026-02-10T00:00:00Z"))).toEqual(["202602", "202601", "202512"]);
    expect(monthsBack(1, new Date("2026-10-31T16:00:00Z"))).toEqual(["202611"]); // 한국은 이미 11월 1일
  });
});

describe("서버 처리 /api/rent", () => {
  const KEY = "TEST-SECRET-KEY-123";
  const env = { DATA_GO_KR_API_KEY: KEY };
  const now = new Date("2026-11-17T03:00:00Z");
  const q = (sgg: string, dong: string) => new URLSearchParams({ sgg, dong });
  let logs: string[];

  beforeEach(() => {
    _resetCache();
    logs = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void logs.push(a.join(" ")));
  });
  afterEach(() => vi.restoreAllMocks());

  it("표에 없는 지역 · 이상한 값은 국토부를 부르지 않고 400", async () => {
    const f = vi.fn();
    for (const [s, d] of [["11440", "신사동"], ["abc", "서교동"], ["11440", ""], ["11440", "서교동".repeat(10)]]) {
      expect((await handleRent(q(s, d), env, f as unknown as typeof fetch, now)).status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("키가 없으면 503", async () => {
    expect((await handleRent(q("11440", "서교동"), {}, vi.fn() as unknown as typeof fetch, now)).status).toBe(503);
  });

  it("최근 6개월 × 세 종류(단독 · 다가구, 연립 · 다세대, 오피스텔)를 묻고 같은 동만 모아 돌려준다, 응답에 키가 없다", async () => {
    const f = vi.fn(async () => new Response(xml([item("서교동", "500", "50"), item("망원동", "300", "40")])));
    const res = await handleRent(q("11440", "서교동"), env, f as unknown as typeof fetch, now);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({ dong: "서교동", months: ["202611", "202610", "202609", "202608", "202607", "202606"], monthly: { count: 18 }, types: ["단독 · 다가구", "연립 · 다세대", "오피스텔"] });
    expect(body).not.toContain(KEY);
    expect(f).toHaveBeenCalledTimes(18);
    const paths = f.mock.calls.map((c) => new URL(String((c as unknown[])[0])).pathname.split("/")[2]);
    expect([...new Set(paths)].sort()).toEqual(["RTMSDataSvcOffiRent", "RTMSDataSvcRHRent", "RTMSDataSvcSHRent"]);
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("LAWD_CD=11440");
    expect(url).not.toContain("%25"); // 키를 두 번 인코딩하지 않음
  });

  it("같은 지역 · 같은 달은 다시 부르지 않는다 (캐시)", async () => {
    const f = vi.fn(async () => new Response(xml([item("서교동", "500", "50")])));
    await handleRent(q("11440", "서교동"), env, f as unknown as typeof fetch, now);
    await handleRent(q("11440", "망원동"), env, f as unknown as typeof fetch, now);
    expect(f).toHaveBeenCalledTimes(18);
  });

  it("503 · 429는 한 번 다시 시도해서 성공하면 그대로", async () => {
    let n = 0;
    const f = vi.fn(async () => (n++ === 0 ? new Response("busy", { status: 503 }) : new Response(xml([item("서교동", "500", "50")]))));
    const res = await handleRent(q("11440", "서교동"), env, f as unknown as typeof fetch, now);
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(19);
  });

  it("400 같은 오류는 다시 시도하지 않고, 실패해도 로그에 키가 남지 않는다", async () => {
    const f = vi.fn(async () => new Response("bad", { status: 400 }));
    const res = await handleRent(q("11440", "서교동"), env, f as unknown as typeof fetch, now);
    expect(res.status).toBe(502);
    expect(f.mock.calls.length).toBeLessThanOrEqual(18);
    expect(logs.join(" ")).not.toContain(KEY);
    expect(logs.join(" ")).toContain("http_400");
  });

  it("한 종류가 장애(04)여도 나머지 종류로 보여 주고, 어떤 종류를 썼는지 알린다(11/28 단독 · 다가구 장애)", async () => {
    const f = vi.fn(async (u: URL | string) =>
      String(u).includes("SHRent") ? new Response(xml([], "04")) : new Response(xml([item("서교동", "1,000", "60", "다세대")])),
    );
    const res = await handleRent(q("11440", "서교동"), env, f as unknown as typeof fetch, now);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ monthly: { count: 12 }, types: ["연립 · 다세대", "오피스텔"] });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=600"); // 일부만 받았으면 CDN에 짧게
    expect(logs.join(" ")).toContain("RTMSDataSvcSHRent");
  });

  it("한도 초과(22) 같은 오류 코드는 실패로 알린다", async () => {
    const f = vi.fn(async () => new Response(xml([], "22")));
    const res = await handleRent(q("11440", "서교동"), env, f as unknown as typeof fetch, now);
    expect(res.status).toBe(502);
    expect(logs.join(" ")).toContain("code_22");
  });
});

describe("동 이름 경계", () => {
  it("다른 동 이름 안에 든 짧은 동 이름은 잡지 않는다", () => {
    expect(findRegions("강남구 신사동 12").some((r) => r.dong === "사동")).toBe(false);
    expect(findRegions("중동로 15").some((r) => r.dong === "중동")).toBe(false);
  });
  it("붙여 써도(마포구서교동) · 번지가 붙어도(서교동123) 찾는다", () => {
    expect(findRegions("마포구서교동").map(regionLabel)).toContain("서울특별시 마포구 서교동");
    expect(findRegions("마포구 서교동123-4").map(regionLabel)).toEqual(["서울특별시 마포구 서교동"]);
  });
});

describe("시세 API 요청 횟수 제한 (R4)", () => {
  it("같은 IP는 1분에 20번까지, 넘으면 남은 초를 알려 주고, 1분 뒤에는 다시 받는다 · 다른 IP는 따로 센다", () => {
    _resetRate();
    const t = 1_000_000;
    for (let i = 0; i < 20; i++) expect(rateLimit("1.1.1.1", t + i)).toBe(0);
    expect(rateLimit("1.1.1.1", t + 30_000)).toBe(30);
    expect(rateLimit("2.2.2.2", t + 30_000)).toBe(0);
    expect(rateLimit("1.1.1.1", t + 60_000)).toBe(0);
  });
});

describe("시세 카드의 기준 기간", () => {
  it.each([
    [["202611", "202606", "202607"], "2026년 6월–11월"],
    [["202512", "202601"], "2025년 12월–2026년 1월"],
    [["202611"], "2026년 11월"],
    [[], ""],
  ])("%j → %s", (months, text) => {
    expect(monthSpan(months)).toBe(text);
  });
});
