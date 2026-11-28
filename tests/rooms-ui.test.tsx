// @vitest-environment jsdom
// F4 내 후보 방을 사용자처럼 눌러 보는 테스트: 추가 → 방 화면 → 점검(결과가 방에 저장) → 단계 체크(방마다 따로) → 지우기.
import { readFileSync } from "node:fs";
import type { AnchorHTMLAttributes } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import expected from "@/samples/expected.json";
import { branches, steps } from "@/lib/content";
import RoomsHome from "@/app/RoomsHome";
import RoomAddClient from "@/app/rooms/new/RoomAddClient";
import RoomDetailClient from "@/app/room/RoomDetailClient";
import CheckClient, { type Sample } from "@/app/check/CheckClient";
import StepClient from "@/app/steps/[no]/StepClient";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => location.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/check/readPdf", () => ({ MAX_PDF_BYTES: 10 * 1024 * 1024, readPdfFile: vi.fn() }));

const ROOMS = "homecheck.rooms.v1";
const PROGRESS = "homecheck.progress.v1";
const savedRooms = () => JSON.parse(localStorage.getItem(ROOMS) ?? "null");
const baseRoom = { id: "r1", label: "정문 원룸", address: "OO동 123-4", deposit: 500, rent: 50, link: "", memo: "정문 원룸", branch: null, checked: {}, check: null, createdAt: "2026-11-17" };
const seedRooms = (...rooms: object[]) => localStorage.setItem(ROOMS, JSON.stringify({ v: 1, rooms }));
const at = (search: string) => window.history.replaceState(null, "", `/${search}`);

const caution = expected.samples.find((s) => s.expected.verdict === "caution")!;
const samples: Sample[] = [
  {
    label: "예시 서류 2",
    text: readFileSync(`samples/${caution.file}`, "utf8"),
    form: {
      myDeposit: String(caution.inputs.my_deposit / 10_000),
      priorDeposits: String(caution.inputs.prior_deposits! / 10_000),
      marketPrice: String(caution.inputs.market_price! / 10_000),
      contractParty: caution.inputs.contract_party,
    },
  },
];


// 샘플 결과는 방에 저장하지 않으므로(R1), '실제 서류' 흐름은 샘플로 칸을 채운 뒤 서류 글자를 살짝 바꿔 실제 서류처럼 만든다
// 샘플 글자를 살짝 바꿔 '올린 서류'처럼(샘플 결과는 방에 저장하지 않으므로). 서류 카드로 돌아가 고치고 다시 '다음'
const asRealDoc = () => {
  fireEvent.click(screen.getByRole("button", { name: /이전: 서류 넣기/ }));
  const box = screen.getByLabelText(/내용을 그대로 붙여 넣어 주세요/) as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: box.value + "\n" } });
  fireEvent.click(screen.getByRole("button", { name: /다음: 내 계약 정보/ }));
};
beforeEach(() => {
  replace.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  push.mockClear();
  at("");
});
afterEach(cleanup);

describe("홈 = 내 후보 방", () => {
  it("방이 없으면 '아직 담은 방이 없어요'와 추가 버튼, 방 없이 둘러보는 길도 있다", async () => {
    render(<RoomsHome />);
    expect(await screen.findByText("아직 담은 방이 없어요")).toBeTruthy();
    expect(screen.getByRole("link", { name: /방 담기 · 주소와 보증금만/ }).getAttribute("href")).toBe("/rooms/new");
    expect(screen.getByRole("link", { name: "계약 과정 미리보기" }).getAttribute("href")).toBe("/guide");
  });

  it("담은 방은 카드로: 이름 · 금액 · 점검 전 · 지금 3단계(방을 찾았으니 1 · 2단계는 건너뜀)", async () => {
    seedRooms(baseRoom);
    render(<RoomsHome />);
    const card = await screen.findByRole("link", { name: /정문 원룸.*보증금/ });
    expect(card.getAttribute("href")).toBe("/room?id=r1");
    expect(card.textContent).toContain("보증금 500만 원 · 월세 50만 원");
    expect(card.textContent).toContain("점검 전");
    expect(card.textContent).toContain("지금 3단계");
  });
});

describe("후보 방 추가", () => {
  it("세 칸을 채우고 저장하면 방이 생기고 그 방 화면으로 간다", async () => {
    const user = userEvent.setup();
    render(<RoomAddClient />);
    await user.type(screen.getByLabelText("주소"), "OO동 123-4");
    await user.type(screen.getByLabelText("보증금 (원)"), "10,000,000");
    await user.type(screen.getByLabelText("월세 (원)"), "500000");
    await user.type(screen.getByLabelText(/매물 링크 · 메모/), "정문 원룸 https://example.com/r/1");
    await user.click(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    const [r] = savedRooms().rooms;
    expect(r).toMatchObject({ label: "정문 원룸", address: "OO동 123-4", deposit: 1000, rent: 50, link: "https://example.com/r/1" });
    expect(replace).toHaveBeenCalledWith(`/room?id=${r.id}`); // 저장한 입력 화면은 ← 기록에서 뺀다
  });

  it("빈 칸으로 저장하면 칸마다 고칠 말이 나오고 저장되지 않는다", async () => {
    const user = userEvent.setup();
    render(<RoomAddClient />);
    await user.click(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toMatch(/주소를 적어.*보증금을 적어/);
    expect(screen.getByLabelText("주소").getAttribute("aria-invalid")).toBe("true");
    expect(savedRooms()).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("방 상세", () => {
  it("한 길: 새 방은 1 · 2단계를 건너뛰고, 3단계 '지금 할 일' 버튼 하나, 뒤 단계는 잠겨 있다", async () => {
    seedRooms(baseRoom);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect(await screen.findByRole("heading", { name: "정문 원룸" })).toBeTruthy();
    const path = screen.getByRole("list", { name: "계약까지 가는 길" });
    expect(within(path).getByText(/준비 · 집 찾기 · 방을 찾았으니 끝났어요/)).toBeTruthy();
    expect(within(path).getByRole("heading", { name: "3단계 · 집 보러 가기" })).toBeTruthy();
    expect(within(path).getByRole("link", { name: "다음: 집 보러 가기 →" }).getAttribute("href")).toBe("/steps/3?room=r1");
    // 아직 안 온 단계는 링크가 아니다(앞 단계부터 차례대로)
    expect(within(path).getByText("4. 계약 전 서류 확인").closest("a")).toBeNull();
    expect(within(path).getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("이 방 전부 보기")).toBeNull();
  });

  it("없는 방이면 '찾을 수 없어요'와 돌아가는 길", async () => {
    at("room?id=nope");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect(await screen.findByText("이 방을 찾을 수 없어요")).toBeTruthy();
  });

  it("4단계에서 '이 방, 어떻게 계약해요?'를 고르면 이 방에만 저장되고 직거래 할 일이 붙는다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom, { ...baseRoom, id: "r2", label: "후문" });
    at("steps/4?room=r1");
    render(<StepClient step={steps[3]} total={steps.length} branches={branches} steps={steps} />);
    await user.click(await screen.findByRole("radio", { name: /직거래/ }));
    expect(screen.getByRole("heading", { name: "직거래라서 꼭 할 것" })).toBeTruthy();
    const rooms = savedRooms().rooms;
    expect(rooms.find((r: { id: string }) => r.id === "r1").branch).toBe("direct");
    expect(rooms.find((r: { id: string }) => r.id === "r2").branch).toBeNull();
    expect(JSON.parse(localStorage.getItem(PROGRESS) ?? "{}").branch ?? null).toBeNull();
  });

  it("매물 링크는 새 창 · noopener로 연다", async () => {
    seedRooms({ ...baseRoom, link: "https://example.com/r/1" });
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    const a = await screen.findByRole("link", { name: /매물 링크 열기/ });
    expect(a.getAttribute("href")).toBe("https://example.com/r/1");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("지우기는 한 번 더 확인한 뒤 지우고 홈으로 간다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    await user.click(await screen.findByRole("button", { name: "이 방 지우기" }));
    expect(savedRooms().rooms).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "지우기" }));
    expect(savedRooms().rooms).toHaveLength(0);
    expect(push).toHaveBeenCalledWith("/");
  });
});

describe("방에서 점검하기", () => {
  it("보증금이 미리 채워지고, 점검 결과 요약이 그 방에 저장된다 (집주인 이름 · 서류 원문은 저장 안 함)", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom);
    at("check?room=r1");
    render(<CheckClient samples={samples} />);
    expect(await screen.findByText(/이 방엔 판정 요약만 저장/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    asRealDoc();
    // 방에서 점검하면 내 보증금은 방에 적어 둔 값 그대로(샘플 값으로 덮지 않음)
    expect((screen.getByLabelText("내 보증금 (원)") as HTMLInputElement).value).toBe("5,000,000");
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.getByText(/에 저장했어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "뒤로" }).getAttribute("href")).toBe("/steps/4?room=r1"); // 맨 위 ←
    expect(screen.getByRole("link", { name: "다음: 결과에 맞춘 할 일 →" }).getAttribute("href")).toBe("/steps/4?room=r1#next-title");

    const raw = localStorage.getItem(ROOMS)!;
    const r = JSON.parse(raw).rooms[0];
    expect(r.check).toMatchObject({ verdict: "caution", flags: caution.expected.flags, ratio: caution.expected.ratio });
    expect(raw).not.toContain(caution.inputs.contract_party);
    expect(raw).not.toContain("【 갑 구 】");
  });

  it("실제 서류로 점검하면 4단계 '등기부등본 점검하기'도 이 방에서 한 일로 체크된다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom);
    at("check?room=r1");
    render(<CheckClient samples={samples} />);
    await user.click(await screen.findByRole("button", { name: "예시 서류 2" }));
    asRealDoc();
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(JSON.parse(localStorage.getItem(ROOMS)!).rooms[0].checked["documents.registry"]).toBe(true);
    // 단계 데이터의 id가 바뀌면 여기서 알 수 있게
    expect(steps.find((x) => x.id === "documents")?.items.some((i) => i.id === "registry")).toBe(true);
  });

  it("저장된 결과가 4단계에 신호등 · 다음 행동으로 보이고, 방(길)에도 한 줄로 보인다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom);
    at("check?room=r1");
    render(<CheckClient samples={samples} />);
    await user.click(await screen.findByRole("button", { name: "예시 서류 2" }));
    asRealDoc();
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    cleanup();

    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect(await screen.findByText(/등기부 주의 · 계약 전에 확인할 것이 1가지 있어요/)).toBeTruthy();
    cleanup();

    at("steps/4?room=r1");
    render(<StepClient step={steps[3]} total={steps.length} branches={branches} steps={steps} />);
    expect(await screen.findByText("계약 전에 확인할 것이 1가지 있어요")).toBeTruthy();
    expect(screen.getByRole("link", { name: "← 이전: 집 보러 가기" }).getAttribute("href")).toBe("/steps/3?room=r1");
    expect(screen.getByRole("link", { name: "뒤로" }).getAttribute("href")).toBe("/room?id=r1");
    expect(screen.getByRole("link", { name: "다시 점검하기" }).getAttribute("href")).toBe("/check?room=r1");

    // 알아낸 것 적기(10번): 할 일 옆에 적고 저장하면 방에 남고, 그 옆에서 바로 다시 점검하러 간다
    await user.click(screen.getAllByRole("button", { name: "✎ 알아낸 것 적기" })[0]);
    await user.type(screen.getByLabelText(/알아낸 것 \(예:/), "근저당 일부 갚겠다고 함");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByText("✎ 알아낸 것: 근저당 일부 갚겠다고 함")).toBeTruthy();
    const noteRow = screen.getByText("✎ 알아낸 것: 근저당 일부 갚겠다고 함").closest(".note-row") as HTMLElement;
    expect(within(noteRow).getByRole("link", { name: "다시 점검하기" }).getAttribute("href")).toBe("/check?room=r1");
    expect(Object.values(JSON.parse(localStorage.getItem(ROOMS)!).rooms[0].notes)).toEqual(["근저당 일부 갚겠다고 함"]);
  });
});

describe("오늘은 여기까지 · 그날 만나요", () => {
  it("지금 단계의 날짜를 정하면 방에 저장되고 'OO에 만나요' · 캘린더 버튼이 나온다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    await user.click(await screen.findByRole("button", { name: "📅 오늘은 여기까지 · 그날 정하기" })); // 처음엔 한 줄로 접혀 있다
    expect(screen.getByText("오늘은 여기까지 해도 괜찮아요")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "3단계 · 집 보러 가기" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/집 보러 가는 날/), { target: { value: "2099-12-01" } });
    await user.click(screen.getByRole("button", { name: "이날로 정하기" }));
    expect(screen.getByText(/12월 1일\(.\)에 만나요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /휴대폰 캘린더에 추가/ })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(ROOMS)!).rooms[0].dates).toEqual({ visit: "2099-12-01" });
  });
});

describe("방에서 샘플로 해 보기 (11/23 리뷰 R1)", () => {
  it("샘플을 눌러도 내 방 보증금은 그대로이고, 샘플 결과는 내 방에 저장하지 않는다", async () => {
    const user = userEvent.setup();
    seedRooms({ ...baseRoom, deposit: 1000 });
    at("check?room=r1");
    render(<CheckClient samples={samples} />);
    expect(await screen.findByText(/이 방엔 판정 요약만 저장/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "예시 서류 2" }));
    expect((screen.getByLabelText("내 보증금 (원)") as HTMLInputElement).value).toBe("10,000,000");
    await user.click(screen.getByRole("button", { name: "점검하기" }));

    expect(screen.getByText(/예시 서류로 해 본 결과라 이 방에는 저장하지 않았어요/)).toBeTruthy();
    expect(screen.queryByText(/에 저장했어요/)).toBeNull();
    expect(JSON.parse(localStorage.getItem(ROOMS)!).rooms[0].check).toBeNull();
  });
});

describe("단계 체크는 방마다 따로", () => {
  it("방 안에서 체크하면 그 방에만 저장되고, 링크에 ?room= 이 이어진다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom, { ...baseRoom, id: "r2" });
    at("steps/1?room=r1");
    const step = steps[0];
    render(<StepClient step={step} total={steps.length} branches={branches} steps={steps} />);
    const first = (await screen.findAllByRole("checkbox"))[0];
    await user.click(first);
    const rooms = savedRooms().rooms;
    expect(Object.keys(rooms[0].checked)).toHaveLength(1);
    expect(rooms[1].checked).toEqual({});
    expect(JSON.parse(localStorage.getItem(PROGRESS) ?? "{}").checked ?? {}).toEqual({});
    expect(screen.getByRole("link", { name: /다음: 집 찾기/ }).getAttribute("href")).toBe("/steps/2?room=r1");
  });
});

describe("동네 시세 (F6)", () => {
  it("주소에 같은 이름 동이 여러 곳이면 고르게 하고, 고른 동네가 방에 저장된다", async () => {
    const user = userEvent.setup();
    render(<RoomAddClient />);
    await user.type(screen.getByLabelText("주소"), "신사동 12");
    const group = await screen.findByRole("radiogroup", { name: "어느 동네인가요?" });
    await user.click(within(group).getByRole("radio", { name: /강남구 신사동/ }));
    expect(screen.getByText(/강남구 신사동 · 이 동네 시세를 찾아 드려요/)).toBeTruthy();
    await user.type(screen.getByLabelText("보증금 (원)"), "10000000");
    await user.type(screen.getByLabelText("월세 (원)"), "600000");
    await user.click(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    expect(savedRooms().rooms[0].region).toEqual({ sgg: "11680", dong: "신사동" });
  });

  it("동네를 못 찾아도 저장은 되고, 시세 없이 저장된다고 알려 준다", async () => {
    const user = userEvent.setup();
    render(<RoomAddClient />);
    await user.type(screen.getByLabelText("주소"), "가상시 새내동 202-7");
    expect(await screen.findByText(/동 이름을 못 찾았어요.*예: 신촌 → 창천동/)).toBeTruthy();
    await user.type(screen.getByLabelText("보증금 (원)"), "5000000");
    await user.click(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    expect(savedRooms().rooms[0].region).toBeNull();
  });

  const rentStats = (count: number) => ({
    dong: "서교동",
    months: ["202611", "202610", "202609", "202608", "202607", "202606"],
    monthly: { count, deposit: { p25: 300, mid: 500, p75: 1000 }, rent: { p25: 45, mid: 50, p75: 55 } },
    jeonse: null,
  });
  const withRegion = { ...baseRoom, deposit: 500, rent: 70, region: { sgg: "11440", dong: "서교동" } };

  it("3단계(집 보러 가기): 이 방 월세가 동네 중간값보다 높으면 그렇게 알려 주고, 범위와 출처를 보여 준다", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(rentStats(12))));
    seedRooms(withRegion);
    at("steps/3?room=r1");
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} steps={steps} />);
    expect(await screen.findByText("월세가 동네 중간값보다 높은 편이에요")).toBeTruthy();
    expect(screen.getByText(/월세: 45–55만 원 \(중간 50\)/)).toBeTruthy();
    expect(screen.getByText(/서교동 단독 · 다가구 월세 신고 거래 12건, 최근 6개월/)).toBeTruthy();
    expect(String(f.mock.calls[0][0])).toBe("/api/rent?sgg=11440&dong=%EC%84%9C%EA%B5%90%EB%8F%99");
    f.mockRestore();
  });

  it("받아 온 주택 종류를 그대로 밝힌다(한 종류가 장애면 '지금 받아 온 종류만')", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...rentStats(12), types: ["연립 · 다세대", "오피스텔"] })));
    seedRooms(withRegion);
    at("steps/3?room=r1");
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} steps={steps} />);
    expect(await screen.findByText(/서교동 연립 · 다세대 · 오피스텔 월세 신고 거래 12건.*지금 받아 온 종류만/)).toBeTruthy();
    f.mockRestore();
  });

  it("거래가 적으면 비교하지 않고 '거래 기록이 적어요'", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(rentStats(2))));
    seedRooms(withRegion);
    at("steps/3?room=r1");
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} steps={steps} />);
    expect(await screen.findByText(/거래 기록이 적어요 \(2건\)/)).toBeTruthy();
    expect(screen.queryByText(/높은 편|비슷해요|낮은 편/)).toBeNull();
    f.mockRestore();
  });

  it("국토부가 응답하지 않으면(502) 제공 기관 쪽 장애이고 점검 · 판정과는 상관없다고 알린다", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "upstream" }), { status: 502 }));
    seedRooms(withRegion);
    at("steps/3?room=r1");
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} steps={steps} />);
    expect(await screen.findByText(/국토교통부 실거래가 서버가 지금 응답하지 않아\(제공 기관 쪽 장애\).*등기부 점검 · 판정과는 상관없어요/)).toBeTruthy();
    f.mockRestore();
  });

  it("불러오지 못하면 실거래가 공개시스템 링크로 안내", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 502 }));
    seedRooms(withRegion);
    at("steps/3?room=r1");
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} steps={steps} />);
    expect((await screen.findByRole("link", { name: "국토부 실거래가 공개시스템" })).getAttribute("rel")).toContain("noopener");
    f.mockRestore();
  });
});

describe("개인정보 안내 · 기록 지우기", () => {
  it("한 번 더 확인한 뒤 homecheck. 기록만 지우고, 다른 저장값은 남긴다", async () => {
    const { default: ClearData } = await import("@/app/privacy/ClearData");
    const user = userEvent.setup();
    seedRooms(baseRoom);
    localStorage.setItem(PROGRESS, "{}");
    localStorage.setItem("other.app", "keep");
    render(<ClearData />);
    await user.click(screen.getByRole("button", { name: "이 기기의 홈체크 기록 모두 지우기" }));
    expect(localStorage.getItem(ROOMS)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "모두 지우기" }));
    expect(localStorage.getItem(ROOMS)).toBeNull();
    expect(localStorage.getItem(PROGRESS)).toBeNull();
    expect(localStorage.getItem("other.app")).toBe("keep");
    expect(screen.getByRole("status").textContent).toContain("지웠어요");
  });

  it("홈 아래에 개인정보 안내 링크가 있다", async () => {
    render(<RoomsHome />);
    expect((await screen.findByRole("link", { name: "개인정보 · 데이터 안내" })).getAttribute("href")).toBe("/privacy");
  });
});

describe("이상한 입력 (7주차 점검표 ⑤)", () => {
  it("저장 버튼을 빠르게 두 번 눌러도 방은 하나만 생긴다", async () => {
    const user = userEvent.setup();
    render(<RoomAddClient />);
    await user.type(screen.getByLabelText("주소"), "OO동 1");
    await user.type(screen.getByLabelText("보증금 (원)"), "5000000");
    await user.dblClick(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    expect(savedRooms().rooms).toHaveLength(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe("처음 온 사람 입구 (로고 + 시작하기 → 해 본 적 있어요? → 하나씩)", () => {
  it("첫 화면은 로고 · 제목 · [시작하기] 하나와 작은 '등기부등본만 바로 점검' 링크뿐", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    render(<HomeGate />);
    expect(await screen.findByRole("heading", { level: 1, name: /이 방,\s*계약해도 될까\?/ })).toBeTruthy();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["시작하기"]);
    expect(screen.getByRole("link", { name: "등기부등본만 바로 점검" }).getAttribute("href")).toBe("/check");
    expect(screen.getByRole("link", { name: "홈체크 소개" }).getAttribute("href")).toBe("/welcome");
  });

  it("해 봤어요 · 건너뛰기 → '해 봤어요'로 기억하고 바로 방 담기로", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    const user = userEvent.setup();
    render(<HomeGate />);
    await user.click(await screen.findByRole("button", { name: "시작하기" }));
    expect(screen.getByRole("heading", { name: "계약 과정, 먼저 볼까요?" })).toBeTruthy();
    expect(screen.getByText(/처음이라면 먼저 보는 걸 추천해요/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "해 봤어요 · 바로 방 담기" }));
    expect(push).toHaveBeenCalledWith("/rooms/new");
    expect(localStorage.getItem("homecheck.entered.v1")).toBe("1");
    expect(JSON.parse(localStorage.getItem("homecheck.progress.v1")!).mode).toBe("experienced");
  });

  it("처음이에요 → 과정 미리보기 → '이제 방 담고 시작하기'", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    const user = userEvent.setup();
    render(<HomeGate />);
    await user.click(await screen.findByRole("button", { name: "시작하기" }));
    await user.click(screen.getByRole("button", { name: "처음이에요 · 계약 과정 미리보기" }));
    expect(screen.getByRole("region", { name: "집 계약 과정 미리보기" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("homecheck.progress.v1")!).mode).toBe("first");
    const go = screen.getByRole("link", { name: "다음: 방 담기 →" });
    expect(go.getAttribute("href")).toBe("/rooms/new");
    await user.click(go);
    expect(localStorage.getItem("homecheck.entered.v1")).toBe("1");
  });

  it("처음이에요 → 미리보기 끝에서 방이 없으면 '다음: 방 찾기부터 →'로 1단계에, 2단계 다음은 방 담기", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    const user = userEvent.setup();
    render(<HomeGate />);
    await user.click(await screen.findByRole("button", { name: "시작하기" }));
    await user.click(screen.getByRole("button", { name: "처음이에요 · 계약 과정 미리보기" }));
    expect(screen.getByRole("link", { name: "다음: 방 찾기부터 →" }).getAttribute("href")).toBe("/steps/1");
    expect(screen.queryByText(/6단계 미리 보기/)).toBeNull();
    cleanup();
    render(<StepClient step={steps[1]} total={steps.length} branches={branches} steps={steps} />);
    expect(screen.getByRole("link", { name: "다음: 방 담기 →" }).getAttribute("href")).toBe("/rooms/new");
  });

  it("다시 온 사람도 앱을 새로 열면 입구(로고 + 시작하기)가 떠 있다 → 건너뛰기 → '내 후보 방', 같은 탭에서는 바로 '내 후보 방'", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    const user = userEvent.setup();
    localStorage.setItem("homecheck.entered.v1", "1");
    render(<HomeGate />);
    await user.click(await screen.findByRole("button", { name: "시작하기" }));
    expect(screen.getByRole("heading", { name: "계약 과정, 다시 볼까요?" })).toBeTruthy();
    expect(screen.getByText("건너뛰면 홈으로 가요. 관심 있는 방을 바로 담을 수 있어요.")).toBeTruthy(); // 담은 방이 없을 때
    await user.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(await screen.findByText("아직 담은 방이 없어요")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("homecheck.progress.v1") ?? "{}").mode ?? null).toBeNull();
    cleanup();
    render(<HomeGate />);
    expect(await screen.findByText("아직 담은 방이 없어요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "시작하기" })).toBeNull();
    expect(screen.getByRole("link", { name: "홈체크 소개" }).getAttribute("href")).toBe("/welcome");
  });

  it("다시 온 사람: 계약 과정 미리보기 → 미리보기 → '내 후보 방으로'", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    const user = userEvent.setup();
    localStorage.setItem("homecheck.entered.v1", "1");
    render(<HomeGate />);
    await user.click(await screen.findByRole("button", { name: "시작하기" }));
    await user.click(screen.getByRole("button", { name: "계약 과정 미리보기" }));
    expect(screen.getByRole("region", { name: "집 계약 과정 미리보기" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "다음: 홈 →" }));
    expect(await screen.findByText("아직 담은 방이 없어요")).toBeTruthy();
  });

  it("왼쪽 위 홈체크 로고를 누르면 입구부터 다시(탭 기억을 지움)", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    localStorage.setItem("homecheck.entered.v1", "1");
    sessionStorage.setItem("homecheck.opened.v1", "1");
    render(<HomeGate />);
    const logo = await screen.findByRole("link", { name: "홈체크 · 새로고침" });
    logo.addEventListener("click", (e) => e.preventDefault()); // jsdom은 페이지 이동을 못 함
    logo.click();
    expect(sessionStorage.getItem("homecheck.opened.v1")).toBeNull();
  });

  it("방을 담아 둔 사람이 새로 열면: '건너뛰면 담아 둔 방으로 바로 가요' → 건너뛰기 → 방 목록", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    const user = userEvent.setup();
    seedRooms(baseRoom);
    render(<HomeGate />);
    await user.click(await screen.findByRole("button", { name: "시작하기" }));
    expect(screen.getByText("건너뛰면 담아 둔 방으로 바로 가요.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(await screen.findByRole("link", { name: /정문 원룸.*보증금/ })).toBeTruthy();
  });

  it("방을 담아 둔 사람도 바로 '내 후보 방' (예전 사용자)", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    seedRooms(baseRoom);
    sessionStorage.setItem("homecheck.opened.v1", "1");
    render(<HomeGate />);
    expect(await screen.findByRole("link", { name: /정문 원룸.*보증금/ })).toBeTruthy();
  });
});

describe("홈 버튼", () => {
  it("하위 화면은 왼쪽 위 ← 바로 옆에 홈체크 로고(홈 · 새로고침)가 있고, 오른쪽 위에는 아무것도 없다", async () => {
    seedRooms(baseRoom);
    at("room?id=r1");
    const { container } = render(<RoomDetailClient steps={steps} branches={branches} />);
    const logo = await screen.findByRole("link", { name: "홈체크 처음으로 (새로고침)" });
    expect(logo.getAttribute("href")).toBe("/");
    const bar = container.querySelector(".topbar")!;
    expect([...bar.children].map((c) => c.className || c.tagName)).toEqual(["back", "home-link", "SPAN"]);
    cleanup();
    render(<RoomAddClient />);
    expect(screen.getByRole("link", { name: "홈체크 처음으로 (새로고침)" }).getAttribute("href")).toBe("/");
  });
});

describe("홈: 이어하기 · 다음 할 일", () => {
  it("맨 위 '이어하기'는 지난번 본 방(길)으로 가고, 방 카드에도 다음 할 일이 보인다", async () => {
    seedRooms(baseRoom, { ...baseRoom, id: "r2", label: "후문 원룸" });
    localStorage.setItem("homecheck.lastRoom.v1", "r2");
    render(<RoomsHome />);
    const cont = await screen.findByRole("link", { name: /지난번 본 방 · 후문 원룸/ });
    expect(cont.getAttribute("href")).toBe("/room?id=r2");
    expect(cont.textContent).toContain("3단계 · 집 보러 가기");
    const card = screen.getByRole("link", { name: /정문 원룸.*보증금/ });
    expect(card.textContent).toContain("다음 할 일: 3단계 · 집 보러 가기");
  });

  it("방 화면을 열면 '지난번 본 방'으로 기억한다", async () => {
    seedRooms(baseRoom);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    await screen.findByRole("heading", { name: "정문 원룸" });
    expect(localStorage.getItem("homecheck.lastRoom.v1")).toBe("r1");
  });

  it("새로 들어왔을 때만 입장 효과(이번 탭에서 두 번째부터는 없음)", async () => {
    sessionStorage.clear();
    seedRooms(baseRoom);
    const { container } = render(<RoomsHome />);
    await screen.findByRole("link", { name: /정문 원룸.*보증금/ });
    expect(container.querySelector("main")!.className).toContain("enter");
    cleanup();
    const again = render(<RoomsHome />);
    await screen.findByRole("link", { name: /정문 원룸.*보증금/ });
    expect(again.container.querySelector("main")!.className).not.toContain("enter");
  });
});

describe("다음 행동 · 계약 과정 (벤치마킹 7 · 8 · 9)", () => {
  it("막히면 물어볼 공공 상담 창구가 5단계(계약하는 날)에 전화 링크로 있다 (번호는 공식 확인한 것)", async () => {
    seedRooms(baseRoom);
    at("steps/5?room=r1");
    render(<StepClient step={steps[4]} total={steps.length} branches={branches} steps={steps} />);
    expect((await screen.findByRole("link", { name: /대한법률구조공단 법률상담 132 전화하기/ })).getAttribute("href")).toBe("tel:132");
    expect(screen.getByRole("link", { name: /HUG 전세피해 및 예방지원센터 1533-8119 전화하기/ }).getAttribute("href")).toBe("tel:1533-8119");
  });

  it("단계 화면 끝 버튼에 다음 단계 이름이 보이고, 마지막 단계는 끝이라고 알려 준다", () => {
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} steps={steps} />);
    expect(screen.getByRole("link", { name: "다음: 계약 전 서류 확인 →" }).getAttribute("href")).toBe("/steps/4");
    cleanup();
    render(<StepClient step={steps[5]} total={steps.length} branches={branches} steps={steps} />);
    expect(screen.getByText(/마지막 단계예요 · 여기까지 하면 계약 완료/)).toBeTruthy();
  });

  it("모든 단계를 다 체크하면 '계약 완료까지 다 챙겼어요'가 한 번 보인다", async () => {
    const checked: Record<string, boolean> = {};
    for (const s of steps) for (const i of s.items) checked[`${s.id}.${i.id}`] = true;
    const direct = branches.find((b) => b.id === "direct")!;
    for (const i of direct.items) checked[`${direct.id}.${i.id}`] = true;
    seedRooms({ ...baseRoom, branch: "direct", checked });
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect(await screen.findByText("계약 완료까지 다 챙겼어요")).toBeTruthy();
  });

  it("동네 시세를 불러오는 동안 회색 틀(로딩)을 보여 준다", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    seedRooms({ ...baseRoom, region: { sgg: "11440", dong: "서교동" } });
    at("steps/3?room=r1");
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} steps={steps} />);
    expect(await screen.findByRole("status", { name: "서교동 시세를 찾는 중이에요" })).toBeTruthy();
    f.mockRestore();
  });
});

describe("서류 · 준비물 (10)", () => {
  it("방에 맞는 것만: 직거래면 중개 서류는 빼고, 아파트처럼 앞선 보증금이 해당 없으면 뺀다", async () => {
    const { visibleDocs } = await import("@/app/docs/DocsClient");
    const ids = (b: string | null, u: string[] | null) => visibleDocs(b, u).map((d) => d.item.id);
    expect(ids("direct", ["tax"])).not.toContain("explanation_doc");
    expect(ids("direct", ["tax"])).not.toContain("prior_deposits");
    expect(ids("broker", ["prior_deposits"])).toEqual(expect.arrayContaining(["explanation_doc", "guarantee_cert", "prior_deposits"]));
    const unknown = visibleDocs(null, null);
    expect(unknown.find((d) => d.item.id === "explanation_doc")!.conditional).toBe(true);
  });

  it("모든 서류의 근거 번호가 근거 목록에 있다", async () => {
    const docs = (await import("@/data/documents.json")).default;
    const { findSource } = await import("@/lib/content");
    for (const it of docs.items) for (const s of it.sources) expect(findSource(s), `${it.id}: ${s}`).toBeTruthy();
  });

  it("방에서 열고 체크하면 그 방에만 저장되고, 4단계 안에서도 같은 체크로 보인다", async () => {
    const { default: DocsClient } = await import("@/app/docs/DocsClient");
    const user = userEvent.setup();
    seedRooms({ ...baseRoom, branch: "direct" }, { ...baseRoom, id: "r2" });
    at("docs?room=r1");
    render(<DocsClient />);
    expect(await screen.findByRole("heading", { name: "무엇을 챙기면 되나요?" })).toBeTruthy();
    expect(screen.getByText("인터넷 열람 1,100원 · 발급 1,400원", { exact: false })).toBeTruthy();
    await user.click(screen.getByLabelText(/^등기부등본$/));
    const rooms = savedRooms().rooms;
    expect(rooms[0].checked["docs.registry"]).toBe(true);
    expect(rooms[1].checked["docs.registry"]).toBeUndefined();
    cleanup();
    // 한 길: 받을 서류는 4단계 안에서도 같은 체크로 보인다
    at("steps/4?room=r1");
    render(<StepClient step={steps[3]} total={steps.length} branches={branches} steps={steps} />);
    expect(await screen.findByRole("heading", { name: "집주인 · 중개사에게 받거나 확인할 것" })).toBeTruthy();
    await user.click(screen.getByLabelText(/집주인 신분증 확인/));
    expect(savedRooms().rooms[0].checked["docs.owner_id"]).toBe(true);
  });
  it("서류를 체크해도 계약 단계 진행률은 바뀌지 않는다", async () => {
    const { roomSteps } = await import("@/app/ui/roomView");
    const a = roomSteps({ ...baseRoom, branch: null, checked: {} } as never, "first", steps, branches).stats.done;
    const b = roomSteps({ ...baseRoom, branch: null, checked: { "docs.registry": true } } as never, "first", steps, branches).stats.done;
    expect(b).toBe(a);
  });
});

describe("한 길: 돌아가기 · 이어 가기 (11/28)", () => {
  it("방 안 단계 화면의 ←(뒤로)는 돌아갈 기록이 없으면 방(길)으로, 마지막 단계의 다음은 '완료 · 방으로'", async () => {
    seedRooms(baseRoom);
    at("steps/6?room=r1");
    render(<StepClient step={steps[5]} total={steps.length} branches={branches} steps={steps} />);
    expect((await screen.findByRole("link", { name: "뒤로" })).getAttribute("href")).toBe("/room?id=r1");
    expect(screen.getByRole("link", { name: "다음: 계약까지 가는 길 →" }).getAttribute("href")).toBe("/room?id=r1");
    expect(screen.getByRole("link", { name: "← 이전: 계약하는 날" }).getAttribute("href")).toBe("/steps/5?room=r1");
  });

  it("해 봤어요여도 방 안 3단계의 이전은 '← 방으로'(1 · 2단계는 방을 찾았으니 끝남), 4단계의 이전은 3단계", async () => {
    localStorage.setItem(PROGRESS, JSON.stringify({ v: 1, mode: "experienced", branch: null, checked: {} }));
    seedRooms(baseRoom);
    at("steps/3?room=r1");
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} steps={steps} />);
    expect((await screen.findByRole("link", { name: "← 이전: 계약까지 가는 길" })).getAttribute("href")).toBe("/room?id=r1");
    cleanup();
    at("steps/4?room=r1");
    render(<StepClient step={steps[3]} total={steps.length} branches={branches} steps={steps} />);
    expect((await screen.findByRole("link", { name: "← 이전: 집 보러 가기" })).getAttribute("href")).toBe("/steps/3?room=r1");
  });

  it("방 안에서 6단계 목록을 열면 방(길)으로 보낸다", async () => {
    const { default: StepsClient } = await import("@/app/steps/StepsClient");
    seedRooms(baseRoom);
    at("steps?room=r1");
    replace.mockClear();
    render(<StepsClient steps={steps} branches={branches} />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/room?id=r1"));
  });

  it("방에서 점검: ←와 결과 뒤 '다음'은 4단계로, 위험이면 '이 방 그만 보기' 갈래가 나온다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom);
    at("check?room=r1");
    const danger = expected.samples.find((x) => x.expected.verdict === "danger")!;
    const dangerSample: Sample = {
      label: "예시 서류 3",
      text: readFileSync(`samples/${danger.file}`, "utf8"),
      form: { myDeposit: "1000", priorDeposits: String(danger.inputs.prior_deposits! / 10_000), marketPrice: String(danger.inputs.market_price! / 10_000), contractParty: danger.inputs.contract_party },
    };
    render(<CheckClient samples={[dangerSample]} />);
    expect((await screen.findByRole("link", { name: "뒤로" })).getAttribute("href")).toBe("/steps/4?room=r1");
    await user.click(screen.getByRole("button", { name: "예시 서류 3" }));
    asRealDoc();
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.getByRole("link", { name: "다음: 결과에 맞춘 할 일 →" }).getAttribute("href")).toBe("/steps/4?room=r1#next-title");
    expect(screen.getByRole("link", { name: "이 방 그만 보기 · 다른 방 담기" }).getAttribute("href")).toBe("/rooms/new");
  });
});


describe("맨 위 ←는 방금 보던 화면으로 (11/28)", () => {
  it("앱 안에서 이동해 왔으면 history.back(), 링크로 바로 들어왔으면 fallback 주소로 간다", async () => {
    const { default: BackButton } = await import("@/app/ui/Back");
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    sessionStorage.setItem("homecheck.nav.v1", JSON.stringify(["/room?id=r1"]));
    render(<BackButton fallback="/room?id=r1" />);
    const a = screen.getByRole("link", { name: "뒤로" });
    const first = new MouseEvent("click", { bubbles: true, cancelable: true });
    a.dispatchEvent(first);
    expect(back).not.toHaveBeenCalled(); // 기록이 하나뿐 → 기본 이동(fallback)
    expect(first.defaultPrevented).toBe(false);
    sessionStorage.setItem("homecheck.nav.v1", JSON.stringify(["/room?id=r1", "/steps/4?room=r1"]));
    const second = new MouseEvent("click", { bubbles: true, cancelable: true });
    a.dispatchEvent(second);
    expect(back).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(true);
    back.mockRestore();
  });

  it("화면이 바뀔 때마다 기록을 쌓고, 뒤로 온 것이면 뺀다", async () => {
    const { NavTrack } = await import("@/app/ui/Back");
    const nav = () => JSON.parse(sessionStorage.getItem("homecheck.nav.v1") ?? "[]");
    at("room?id=r1");
    render(<NavTrack />);
    cleanup();
    at("steps/3?room=r1");
    render(<NavTrack />);
    expect(nav()).toEqual(["/room?id=r1", "/steps/3?room=r1"]);
    cleanup();
    at("room?id=r1");
    render(<NavTrack />);
    expect(nav()).toEqual(["/room?id=r1"]);
  });
});

describe("집 모양 로고는 화면마다 하나 (11/28)", () => {
  it("계약 과정 미리보기(/guide)도 집 모양 로고는 하나(← 옆)이고 처음으로(새로고침) 간다", async () => {
    const { default: StartClient } = await import("@/app/StartClient");
    const { container } = render(<StartClient />);
    expect(container.querySelectorAll(".home-link, .brand").length).toBe(1);
    expect(screen.getByRole("link", { name: "홈체크 처음으로 (새로고침)" }).getAttribute("href")).toBe("/");
  });
});

describe("앞뒤 맥락 (11/28)", () => {
  it("4단계에서 요청 목록에 담은 것이 5단계(계약하는 날)에 그대로 이어진다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom);
    at("check?room=r1");
    render(<CheckClient samples={samples} />);
    await user.click(await screen.findByRole("button", { name: "예시 서류 2" }));
    asRealDoc();
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.queryByRole("region", { name: "결과에 맞춘 할 일" })).toBeNull(); // 방에서는 4단계에서 한 번만
    cleanup();
    at("steps/4?room=r1");
    render(<StepClient step={steps[3]} total={steps.length} branches={branches} steps={steps} />);
    await user.click((await screen.findAllByRole("button", { name: /요청 목록에 담기/ }))[0]);
    cleanup();
    at("steps/5?room=r1");
    render(<StepClient step={steps[4]} total={steps.length} branches={branches} steps={steps} />);
    const card = (await screen.findByText("4단계에서 담은 요청 목록")).closest(".request") as HTMLElement;
    expect(within(card).getByText(/계약서 특약 · 설명에 들어갔는지/)).toBeTruthy();
    expect(card.querySelector("pre")!.textContent).toMatch(/\[계약 전에 확인하고 싶은 것\]/);
  });
});
