// F2 규칙 기반 읽기 테스트.
// 1) 샘플 3종이 정답표(samples/expected.json)의 read와 똑같이 읽히는지
// 2) 실제 서류에서 생길 수 있는 경우(띄어쓰기 · 줄바꿈 · 말소 · 변경 · 공유 · 빠진 구역)를 지어내지 않고 처리하는지
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import expected from "@/samples/expected.json";
import { readRegistry } from "@/lib/registry/read";
import type { RegistryRead } from "@/lib/registry/types";

const samples = expected.samples as { file: string; read: RegistryRead }[];
const load = (file: string) => readFileSync(`samples/${file}`, "utf8");

describe("샘플 3종 읽기", () => {
  it.each(samples)("$file: 정답표 read와 같다", ({ file, read }) => {
    const result = readRegistry(load(file));
    expect(result.read).toEqual(read);
    expect(result.warnings).toEqual([]);
  });
});

describe("실제 서류에서 생길 수 있는 경우", () => {
  const B = load("B_caution.txt");

  it("윈도우 줄바꿈(CRLF)과 전각 공백이 섞여도 같은 결과", () => {
    const messy = B.replace(/\n/g, "\r\n").replace(/【 갑 구 】/, "【　갑　구　】");
    expect(readRegistry(messy).read).toEqual(readRegistry(B).read);
  });

  it("구역 표시에 띄어쓰기가 없어도(【갑구】) 읽는다", () => {
    const tight = B.replace("【 갑 구 】", "【갑구】").replace("【 을 구 】", "【을구】");
    expect(readRegistry(tight).read).toEqual(readRegistry(B).read);
  });

  it("한 기록이 여러 줄로 나뉘어도 이어 붙여 읽는다", () => {
    const wrapped = B.replace("채무자 김도윤 근저당권자 다라저축은행", "채무자 김도윤\n근저당권자 다라저축은행");
    expect(readRegistry(wrapped).read.active_mortgages).toEqual([
      { max_claim: 360000000, creditor: "가나은행" },
      { max_claim: 125000000, creditor: "다라저축은행" },
    ]);
  });

  it("근저당 금액이 변경(부기등기)되면 바뀐 금액으로 읽는다", () => {
    const changed = B.replace(
      "-- 이 하 여 백 --",
      "1-1 | 1번근저당권변경 | 2024년1월5일 제5003호 | 2024년1월5일 변경계약 | 채권최고액 금300,000,000원\n\n-- 이 하 여 백 --",
    );
    expect(readRegistry(changed).read.active_mortgages[0]).toEqual({ max_claim: 300000000, creditor: "가나은행" });
  });

  it("가압류가 말소되면 가압류 목록에서 빠진다", () => {
    const C = load("C_danger.txt");
    const cleared = C.replace(
      "【 을 구 】",
      "4 | 3번가압류등기말소 | 2026년11월1일 제6004호 | 2026년10월30일 해제 | \n\n【 을 구 】",
    );
    expect(readRegistry(load("C_danger.txt")).read.seizures).toHaveLength(1);
    expect(readRegistry(cleared).read.seizures).toEqual([]);
  });

  it("세금 압류(청구금액 없음)도 압류로 읽는다", () => {
    const A = load("A_safe.txt");
    const taxed = A.replace(
      "【 을 구 】",
      "2 | 압류 | 2026년10월2일 제1002호 | 2026년10월1일 압류(세무과-1234) | 권리자 가상시\n\n【 을 구 】",
    );
    expect(readRegistry(taxed).read.seizures).toEqual([
      { type: "압류", amount: 0, creditor: "가상시", date: "2026-10-02" },
    ]);
  });

  it("공동 소유(공유자)면 이름을 모두 읽는다", () => {
    const shared = load("A_safe.txt").replace(
      "소유자 이하늘 850101-******* 가상시 한빛구 새내동 101-1",
      "공유자 지분 2분의 1 이하늘 850101-******* 공유자 지분 2분의 1 이바다 870202-*******",
    );
    // 이름 앞에 오는 "지분 2분의 1"을 이름으로 잘못 읽지 않아야 한다
    expect(readRegistry(shared).read.current_owner).toBe("이하늘, 이바다");
  });

  it("을구가 없으면(빚 기록이 한 번도 없던 집) 근저당 0건, 경고 없음", () => {
    const noEul = load("A_safe.txt").split("【 을 구 】")[0];
    const r = readRegistry(noEul);
    expect(r.read.active_mortgages).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("갑구가 없으면 집주인 이름을 지어내지 않고 경고한다", () => {
    const noGap = load("B_caution.txt").replace(/【 갑 구 】[\s\S]*?(?=【 을 구 】)/, "");
    const r = readRegistry(noGap);
    expect(r.read.current_owner).toBe("");
    expect(r.warnings.some((w) => w.includes("갑구"))).toBe(true);
  });

  it("등기부등본이 아닌 글이면 형식 경고를 준다", () => {
    const r = readRegistry("안녕하세요 원룸 계약 문의드립니다");
    expect(r.warnings[0]).toContain("등기부등본 형식");
    expect(r.read.active_mortgages).toEqual([]);
  });
});

describe("위험 기록 읽기 (SOURCES S12 · S13 · S14)", () => {
  const A = load("A_safe.txt");
  const addGap = (row: string) => A.replace("【 을 구 】", `${row}\n\n【 을 구 】`);
  const addEul = (row: string) => A.replace("-- 이 하 여 백 --", `${row}\n\n-- 이 하 여 백 --`);

  it("신탁: 소유자가 신탁회사로 바뀌고, 원래 집주인은 예전 소유자가 된다", () => {
    const r = readRegistry(
      addGap("2 | 소유권이전 | 2026년7월1일 제1002호 | 2026년7월1일 신탁 | 수탁자 가상부동산신탁 신탁원부 제2026-12호"),
    ).read;
    expect(r.current_owner).toBe("가상부동산신탁");
    expect(r.previous_owners).toEqual(["이하늘"]);
    expect(r.risk_records).toEqual([{ type: "신탁", date: "2026-07-01" }]);
  });

  it("가등기는 소유권이전이 아니다 (소유자가 바뀌지 않음)", () => {
    const r = readRegistry(
      addGap("2 | 소유권이전청구권가등기 | 2026년8월3일 제1003호 | 2026년8월2일 매매예약 | 가등기권자 박가상"),
    ).read;
    expect(r.current_owner).toBe("이하늘");
    expect(r.last_ownership_transfer).toBeNull();
    expect(r.risk_records).toEqual([{ type: "가등기", date: "2026-08-03" }]);
  });

  it("경매개시결정 · 가처분을 읽고, 압류로 잘못 읽지 않는다", () => {
    const r = readRegistry(
      addGap(
        "2 | 임의경매개시결정 | 2026년9월9일 제1004호 | 2026년9월8일 가상지방법원의 임의경매개시결정(2026타경77) | 채권자 가나은행\n" +
          "3 | 처분금지가처분 | 2026년9월10일 제1005호 | 2026년9월9일 가상지방법원의 가처분결정 | 채권자 홍가상",
      ),
    ).read;
    expect(r.risk_records.map((x) => x.type)).toEqual(["경매개시결정", "가처분"]);
    expect(r.seizures).toEqual([]);
  });

  it("을구의 임차권등기가 남아 있으면 위험 기록, 말소되면 말소 목록으로", () => {
    const lease = "3 | 주택임차권 | 2025년4월1일 제3004호 | 2025년3월20일 가상지방법원의 임차권등기명령(2025카임12) | 임차보증금 금50,000,000원 임차권자 정가상";
    const kept = readRegistry(addEul(lease)).read;
    expect(kept.risk_records).toEqual([{ type: "임차권등기", date: "2025-04-01" }]);

    const gone = readRegistry(addEul(`${lease}\n4 | 3번임차권등기말소 | 2025년9월1일 제3005호 | 2025년8월30일 해제 |`)).read;
    expect(gone.risk_records).toEqual([]);
    expect(gone.erased_risk_records).toEqual([{ type: "임차권등기", date: "2025-04-01" }]);
    // 임차권등기 말소가 근저당 말소 목록을 건드리지 않는다
    expect(gone.erased_mortgages).toEqual(kept.erased_mortgages);
  });
});
