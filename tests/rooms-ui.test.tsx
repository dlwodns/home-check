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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
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
    label: "주의 샘플",
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
const asRealDoc = () => {
  const box = screen.getByLabelText(/내용을 그대로 붙여 넣어 주세요/) as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: box.value + "\n" } });
};
beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  at("");
});
afterEach(cleanup);

describe("홈 = 내 후보 방", () => {
  it("방이 없으면 '아직 담은 방이 없어요'와 추가 버튼, 방 없이 둘러보는 길도 있다", async () => {
    render(<RoomsHome />);
    expect(await screen.findByText("아직 담은 방이 없어요")).toBeTruthy();
    expect(screen.getByRole("link", { name: /후보 방 추가/ }).getAttribute("href")).toBe("/rooms/new");
    expect(screen.getByRole("link", { name: /계약 과정 미리 보기/ }).getAttribute("href")).toBe("/guide");
  });

  it("담은 방은 카드로: 이름 · 금액 · 점검 전 · 지금 3단계(방을 찾았으니 1 · 2단계는 건너뜀)", async () => {
    seedRooms(baseRoom);
    render(<RoomsHome />);
    const card = await screen.findByRole("link", { name: /정문 원룸.*보증금/ });
    expect(card.getAttribute("href")).toBe("/room?id=r1");
    expect(card.textContent).toContain("보증금 500 · 월세 50");
    expect(card.textContent).toContain("점검 전");
    expect(card.textContent).toContain("지금 3단계");
  });
});

describe("후보 방 추가", () => {
  it("세 칸을 채우고 저장하면 방이 생기고 그 방 화면으로 간다", async () => {
    const user = userEvent.setup();
    render(<RoomAddClient />);
    await user.type(screen.getByLabelText("주소"), "OO동 123-4");
    await user.type(screen.getByLabelText("보증금 (만 원)"), "1,000");
    await user.type(screen.getByLabelText("월세 (만 원)"), "50");
    await user.type(screen.getByLabelText(/매물 링크 · 메모/), "정문 원룸 https://example.com/r/1");
    await user.click(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    const [r] = savedRooms().rooms;
    expect(r).toMatchObject({ label: "정문 원룸", address: "OO동 123-4", deposit: 1000, rent: 50, link: "https://example.com/r/1" });
    expect(push).toHaveBeenCalledWith(`/room?id=${r.id}`);
  });

  it("빈 칸으로 저장하면 칸마다 고칠 말이 나오고 저장되지 않는다", async () => {
    const user = userEvent.setup();
    render(<RoomAddClient />);
    await user.click(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toMatch(/주소를 적어.*보증금을 적어/);
    expect(screen.getByLabelText("주소").getAttribute("aria-invalid")).toBe("true");
    expect(savedRooms()).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("방 상세", () => {
  it("점검 전이면 '등기부등본 올려서 점검하기'가 이 방 주소로 이어진다", async () => {
    seedRooms(baseRoom);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect(await screen.findByRole("heading", { name: "정문 원룸" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "등기부등본 올려서 점검하기" }).getAttribute("href")).toBe("/check?room=r1");
    expect(screen.getByRole("link", { name: "3단계 할 일 보기" }).getAttribute("href")).toBe("/steps/3?room=r1");
    expect(screen.getByText(/계약 완료 · 보증금 지키기/)).toBeTruthy();
  });

  it("없는 방이면 '찾을 수 없어요'와 돌아가는 길", async () => {
    at("room?id=nope");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect(await screen.findByText("이 방을 찾을 수 없어요")).toBeTruthy();
  });

  it("직거래를 고르면 이 방에만 저장되고 본인 확인 안내가 나온다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom, { ...baseRoom, id: "r2", label: "후문" });
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    await user.click(await screen.findByRole("radio", { name: /직거래/ }));
    expect(screen.getByText(/집주인 본인 확인/)).toBeTruthy();
    const rooms = savedRooms().rooms;
    expect(rooms.find((r: { id: string }) => r.id === "r1").branch).toBe("direct");
    expect(rooms.find((r: { id: string }) => r.id === "r2").branch).toBeNull();
    expect(JSON.parse(localStorage.getItem(PROGRESS) ?? "{}").branch ?? null).toBeNull();
  });

  it("매물 링크는 새 창 · noopener로 연다", async () => {
    seedRooms({ ...baseRoom, link: "https://example.com/r/1" });
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    const a = await screen.findByRole("link", { name: "매물 링크 열기" });
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
    expect(await screen.findByText(/방을 점검해요/)).toBeTruthy();
    expect((screen.getByLabelText("내 보증금 (만 원)") as HTMLInputElement).value).toBe("500");

    await user.click(screen.getByRole("button", { name: "주의 샘플" }));
    asRealDoc();
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    expect(screen.getByText(/에 저장했어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /이 방으로 돌아가 계약 방법 보기/ }).getAttribute("href")).toBe("/room?id=r1");

    const raw = localStorage.getItem(ROOMS)!;
    const r = JSON.parse(raw).rooms[0];
    expect(r.check).toMatchObject({ verdict: "caution", flags: caution.expected.flags, ratio: caution.expected.ratio });
    expect(raw).not.toContain(caution.inputs.contract_party);
    expect(raw).not.toContain("【 갑 구 】");
  });

  it("저장된 결과가 방 상세에 신호등 · 다음 행동으로 보인다", async () => {
    const user = userEvent.setup();
    seedRooms(baseRoom);
    at("check?room=r1");
    render(<CheckClient samples={samples} />);
    await user.click(await screen.findByRole("button", { name: "주의 샘플" }));
    asRealDoc();
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    cleanup();

    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect((await screen.findAllByText("주의")).length).toBeGreaterThan(0);
    expect(screen.getByText("계약 전에 확인할 것이 1가지 있어요")).toBeTruthy();
    expect(screen.getByText(/계약 상대가 등기부등본의 지금 집주인이에요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "다시 점검하기" }).getAttribute("href")).toBe("/check?room=r1");
  });
});

describe("방에서 샘플로 해 보기 (11/23 리뷰 R1)", () => {
  it("샘플을 눌러도 내 방 보증금은 그대로이고, 샘플 결과는 내 방에 저장하지 않는다", async () => {
    const user = userEvent.setup();
    seedRooms({ ...baseRoom, deposit: 1000 });
    at("check?room=r1");
    render(<CheckClient samples={samples} />);
    expect(await screen.findByText(/방을 점검해요/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "주의 샘플" }));
    expect((screen.getByLabelText("내 보증금 (만 원)") as HTMLInputElement).value).toBe("1000");
    await user.click(screen.getByRole("button", { name: "점검하기" }));

    expect(screen.getByText(/샘플로 해 본 결과라 이 방에는 저장하지 않았어요/)).toBeTruthy();
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
    render(<StepClient step={step} total={steps.length} branches={branches} />);
    const first = (await screen.findAllByRole("checkbox"))[0];
    await user.click(first);
    const rooms = savedRooms().rooms;
    expect(Object.keys(rooms[0].checked)).toHaveLength(1);
    expect(rooms[1].checked).toEqual({});
    expect(JSON.parse(localStorage.getItem(PROGRESS) ?? "{}").checked ?? {}).toEqual({});
    expect(screen.getByRole("link", { name: /다음 단계/ }).getAttribute("href")).toBe("/steps/2?room=r1");
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
    await user.type(screen.getByLabelText("보증금 (만 원)"), "1000");
    await user.type(screen.getByLabelText("월세 (만 원)"), "60");
    await user.click(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    expect(savedRooms().rooms[0].region).toEqual({ sgg: "11680", dong: "신사동" });
  });

  it("동네를 못 찾아도 저장은 되고, 시세 없이 저장된다고 알려 준다", async () => {
    const user = userEvent.setup();
    render(<RoomAddClient />);
    await user.type(screen.getByLabelText("주소"), "가상시 새내동 202-7");
    expect(await screen.findByText(/동네\(법정동\)를 못 찾았어요/)).toBeTruthy();
    await user.type(screen.getByLabelText("보증금 (만 원)"), "500");
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

  it("방 상세: 이 방 월세가 동네 중간값보다 높으면 그렇게 알려 주고, 범위와 출처를 보여 준다", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(rentStats(12))));
    seedRooms(withRegion);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect(await screen.findByText("월세가 동네 중간값보다 높은 편이에요")).toBeTruthy();
    expect(screen.getByText(/월세: 45–55만 원 \(중간 50\)/)).toBeTruthy();
    expect(screen.getByText(/서교동 단독 · 다가구 월세 신고 거래 12건, 최근 6개월/)).toBeTruthy();
    expect(String(f.mock.calls[0][0])).toBe("/api/rent?sgg=11440&dong=%EC%84%9C%EA%B5%90%EB%8F%99");
    f.mockRestore();
  });

  it("거래가 적으면 비교하지 않고 '거래 기록이 적어요'", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(rentStats(2))));
    seedRooms(withRegion);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect(await screen.findByText(/거래 기록이 적어요 \(2건\)/)).toBeTruthy();
    expect(screen.queryByText(/높은 편|비슷해요|낮은 편/)).toBeNull();
    f.mockRestore();
  });

  it("불러오지 못하면 실거래가 공개시스템 링크로 안내", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 502 }));
    seedRooms(withRegion);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
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
    await user.type(screen.getByLabelText("보증금 (만 원)"), "500");
    await user.dblClick(screen.getByRole("button", { name: "저장하고 이 방 보기" }));
    expect(savedRooms().rooms).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("로비(입구)", () => {
  it("처음 온 사람에게는 로비를, 문을 누르면 '들어온 사람'으로 기억한다", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    const user = userEvent.setup();
    render(<HomeGate />);
    expect(await screen.findByRole("heading", { level: 1, name: /이 방,\s*계약해도 될까\?/ })).toBeTruthy();
    expect(screen.getByText(/법령 원문으로 확인한 근거 \d+개/)).toBeTruthy();
    const doors = screen.getAllByRole("link", { name: "관심 있는 방 담고 시작하기" });
    expect(doors[0].getAttribute("href")).toBe("/rooms/new");
    await user.click(doors[0]);
    expect(localStorage.getItem("homecheck.entered.v1")).toBe("1");
  });

  it("한 번 들어온 사람은 로비 없이 바로 '내 후보 방'", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    localStorage.setItem("homecheck.entered.v1", "1");
    render(<HomeGate />);
    expect(await screen.findByText("아직 담은 방이 없어요")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "관심 있는 방 담고 시작하기" })).toBeNull();
    expect(screen.getByRole("link", { name: "홈체크 소개" }).getAttribute("href")).toBe("/welcome");
  });

  it("방을 담아 둔 사람도 바로 '내 후보 방' (예전 사용자)", async () => {
    const { default: HomeGate } = await import("@/app/HomeGate");
    seedRooms(baseRoom);
    render(<HomeGate />);
    expect(await screen.findByRole("link", { name: /정문 원룸.*보증금/ })).toBeTruthy();
  });
});

describe("홈 버튼", () => {
  it("하위 화면 위쪽에 '홈으로' 로고 버튼이 있고 홈(/)으로 간다", async () => {
    seedRooms(baseRoom);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect((await screen.findByRole("link", { name: "홈으로" })).getAttribute("href")).toBe("/");
    cleanup();
    render(<RoomAddClient />);
    expect(screen.getByRole("link", { name: "홈으로" }).getAttribute("href")).toBe("/");
  });
});

describe("홈: 이어하기 · 다음 할 일", () => {
  it("맨 위 '이어하기'는 지난번 본 방의 다음 할 일로 가고, 방 카드에도 다음 할 일이 보인다", async () => {
    seedRooms(baseRoom, { ...baseRoom, id: "r2", label: "후문 원룸" });
    localStorage.setItem("homecheck.lastRoom.v1", "r2");
    render(<RoomsHome />);
    const cont = await screen.findByRole("link", { name: /지난번 본 방 · 후문 원룸/ });
    expect(cont.getAttribute("href")).toBe("/check?room=r2");
    expect(cont.textContent).toContain("등기부등본 올려서 점검하기");
    const card = screen.getByRole("link", { name: /정문 원룸.*보증금/ });
    expect(card.textContent).toContain("다음 할 일: 등기부등본 올려서 점검하기");
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
  it("막히면 물어볼 공공 상담 창구가 전화 링크로 있다 (번호는 공식 확인한 것)", async () => {
    seedRooms(baseRoom);
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect((await screen.findByRole("link", { name: /대한법률구조공단 법률상담 132 전화하기/ })).getAttribute("href")).toBe("tel:132");
    expect(screen.getByRole("link", { name: /HUG 전세피해 및 예방지원센터 1533-8119 전화하기/ }).getAttribute("href")).toBe("tel:1533-8119");
  });

  it("단계 화면 끝에 '다음은 N단계' 미리보기, 마지막 단계는 끝이라고 알려 준다", () => {
    render(<StepClient step={steps[2]} total={steps.length} branches={branches} next={steps[3]} />);
    expect(screen.getByRole("link", { name: /다음은 4단계예요/ }).getAttribute("href")).toBe("/steps/4");
    cleanup();
    render(<StepClient step={steps[5]} total={steps.length} branches={branches} next={null} />);
    expect(screen.getByText(/계약 완료 · 보증금 지키기 끝/)).toBeTruthy();
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
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
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

  it("방에서 열고 체크하면 그 방에만 저장되고, 방 화면에 몇 개 챙겼는지 보인다", async () => {
    const { default: DocsClient } = await import("@/app/docs/DocsClient");
    const user = userEvent.setup();
    seedRooms({ ...baseRoom, branch: "direct" }, { ...baseRoom, id: "r2" });
    at("docs?room=r1");
    render(<DocsClient />);
    expect(await screen.findByRole("heading", { name: "무엇을 챙기면 되나요?" })).toBeTruthy();
    expect(screen.getByText("인터넷 열람 700원 · 발급 1,000원", { exact: false })).toBeTruthy();
    await user.click(screen.getByLabelText(/^등기부등본$/));
    const rooms = savedRooms().rooms;
    expect(rooms[0].checked["docs.registry"]).toBe(true);
    expect(rooms[1].checked["docs.registry"]).toBeUndefined();
    cleanup();
    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    const link = await screen.findByRole("link", { name: /서류 · 준비물/ });
    expect(link.getAttribute("href")).toBe("/docs?room=r1");
    expect(link.textContent).toMatch(/1\/\d+/);
  });

  it("서류를 체크해도 계약 단계 진행률은 바뀌지 않는다", async () => {
    const { roomSteps } = await import("@/app/ui/roomView");
    const a = roomSteps({ ...baseRoom, branch: null, checked: {} } as never, "first", steps, branches).stats.done;
    const b = roomSteps({ ...baseRoom, branch: null, checked: { "docs.registry": true } } as never, "first", steps, branches).stats.done;
    expect(b).toBe(a);
  });
});
