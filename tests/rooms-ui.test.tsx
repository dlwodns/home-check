// @vitest-environment jsdom
// F4 내 후보 방을 사용자처럼 눌러 보는 테스트: 추가 → 방 화면 → 점검(결과가 방에 저장) → 단계 체크(방마다 따로) → 지우기.
import { readFileSync } from "node:fs";
import type { AnchorHTMLAttributes } from "react";
import { cleanup, render, screen } from "@testing-library/react";
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

  it("담은 방은 카드로: 이름 · 금액 · 점검 전 · 지금 1단계", async () => {
    seedRooms(baseRoom);
    render(<RoomsHome />);
    const card = await screen.findByRole("link", { name: /정문 원룸/ });
    expect(card.getAttribute("href")).toBe("/room?id=r1");
    expect(card.textContent).toContain("보증금 500 · 월세 50");
    expect(card.textContent).toContain("점검 전");
    expect(card.textContent).toContain("지금 1단계");
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
    expect(screen.getByRole("link", { name: "1단계 할 일 보기" }).getAttribute("href")).toBe("/steps/1?room=r1");
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
    await user.click(screen.getByRole("button", { name: "점검하기" }));
    cleanup();

    at("room?id=r1");
    render(<RoomDetailClient steps={steps} branches={branches} />);
    expect((await screen.findAllByText("주의")).length).toBeGreaterThan(0);
    expect(screen.getByText("확인할 것 1가지")).toBeTruthy();
    expect(screen.getByRole("link", { name: "다시 점검하기" }).getAttribute("href")).toBe("/check?room=r1");
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
