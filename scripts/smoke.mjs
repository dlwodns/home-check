// 배포본 점검(E2E): 배포된 홈체크를 휴대폰 크기 브라우저로 처음부터 끝까지 눌러 보고, 하나라도 다르면 실패(종료 코드 1).
// 단위 테스트(npm test)는 내 컴퓨터 안 시험이라, 배포 설정 · 환경 변수 · 실제 API까지 붙은 모습은 이것으로 본다.
// shortcut: playwright-core는 저장소 의존성에 넣지 않았다(poster-shots.mjs와 같음). CI에 넣으려면 devDependency로 올린다.
// 실행: NODE_PATH=/설치폴더/node_modules CHROME_PATH=/경로/chrome node scripts/smoke.mjs [주소]
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.NODE_PATH + "/")("playwright-core");

const U = process.argv[2] ?? "https://home-check-pi.vercel.app";
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(["✓", name]);
  } catch (e) {
    results.push(["✗", name, String(e.message ?? e).split("\n")[0]]);
  }
};
const expectText = async (p, re, timeout = 8000) => p.getByText(re).first().waitFor({ timeout });

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ko-KR" });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));

await step("https로 열리고 처음 온 사람에게 입구(로고 + 시작하기)가 보인다", async () => {
  const res = await p.goto(U + "/", { waitUntil: "networkidle" });
  if (!res.ok() || !p.url().startsWith("https://")) throw new Error(`상태 ${res.status()} · ${p.url()}`);
  await p.getByRole("button", { name: "시작하기" }).waitFor({ timeout: 8000 });
});

await step("방을 담으면 그 방(길)으로 가고, 3단계에 동네 시세가 나온다(공공데이터 키 · /api/rent)", async () => {
  await p.goto(U + "/rooms/new", { waitUntil: "networkidle" });
  await p.fill("input[placeholder^='예: OO동']", "마포구 서교동 123-4");
  await p.fill("input[placeholder='예: 10,000,000']", "10000000");
  await p.fill("input[placeholder='전세면 비워 두세요']", "600000");
  await p.fill("input[placeholder^='직방 링크']", "점검용 방");
  await p.getByRole("button", { name: /저장하고/ }).click();
  await p.waitForURL(/room\?id=/);
  await expectText(p, "지금 할 일 · 3 / 6"); // 방 = 한 길: 방을 찾았으니 3단계부터
  await p.getByRole("link", { name: "이 단계 시작하기 →" }).click();
  await p.waitForURL(/steps\/3/);
  await expectText(p, /월세 신고 거래 \d+건/, 20000);
});

await step("샘플로 해 보면 판정은 나오지만 방에는 저장하지 않는다", async () => {
  await p.getByRole("link", { name: /다음: 계약 전 서류 확인/ }).click(); // 3단계 → 4단계(한 길)
  await p.waitForURL(/steps\/4/);
  // 4단계는 서류 하나씩: 어떤 집 · 계약 방법 → 등기부등본 → 점검하기
  await p.getByRole("radio", { name: /원룸 건물/ }).click();
  await p.getByRole("radio", { name: "공인중개사를 통해서" }).click();
  await p.locator(".action-bar").getByRole("link", { name: "다음: 등기부등본 →" }).click();
  await p.waitForURL(/doc=registry/);
  await p.locator(".action-bar").getByRole("link", { name: /PDF 올려서 점검하기/ }).click();
  await p.waitForURL(/check/);
  // 방에서 점검할 때는 예시 서류가 접혀 있다 → 펼치고 누른다
  if (!(await p.getByRole("button", { name: "예시 서류 2" }).isVisible())) await p.getByText(/예시 서류로 먼저 보기/).click();
  await p.getByRole("button", { name: "예시 서류 2" }).click();
  await p.getByRole("button", { name: "점검하기" }).click();
  await expectText(p, "계약 전에 확인할 것이 1가지 있어요");
  await expectText(p, /예시 서류로 해 본 결과라 이 방에는 저장하지 않았어요/);
});

await step("서류를 올린 것처럼 점검하면 방에 저장되고 홈 카드에 신호등이 보인다", async () => {
  await p.getByRole("button", { name: "← 이전: 내 계약 정보" }).click(); // 점검 뒤 접힌 입력 칸 펼치기
  await p.getByRole("button", { name: /이전: 서류 넣기/ }).click(); // 한 화면에 카드 하나: 서류 카드로
  const box = p.getByLabel(/내용을 그대로 붙여 넣어 주세요/);
  await box.fill((await box.inputValue()) + "\n");
  await p.getByRole("button", { name: /다음: 내 계약 정보/ }).click();
  await p.getByRole("button", { name: "점검하기" }).click();
  await expectText(p, /점검용 방.*에 저장했어요|에 저장했어요/);
  await p.getByRole("link", { name: "다음: 결과에 맞춘 할 일 →" }).click(); // 점검 뒤에는 4단계로 돌아간다
  await p.waitForURL(/steps\/4/);
  await expectText(p, "계약 전에 확인할 것이 1가지 있어요");
  await p.goto(U + "/", { waitUntil: "networkidle" });
  await expectText(p, "점검용 방");
  await expectText(p, "주의");
});

await step("로그인 화면이 열린다(Supabase 환경 변수)", async () => {
  await p.goto(U + "/login", { waitUntil: "networkidle" });
  const notReady = await p.getByText(/로그인은 아직 준비 중이에요/).count();
  if (notReady) throw new Error("Supabase 환경 변수가 배포에 없음");
});

await step("없는 주소는 한글 안내(404)", async () => {
  const res = await p.goto(U + "/없는-주소", { waitUntil: "networkidle" });
  if (res.status() !== 404) throw new Error(`상태 ${res.status()}`);
});

await step("화면에서 자바스크립트 오류가 없다", async () => {
  if (errors.length) throw new Error(errors.join(" / "));
});

await b.close();
for (const r of results) console.log(r.join(" "));
const failed = results.filter((r) => r[0] === "✗").length;
console.log(failed ? `실패 ${failed}개` : `모두 통과 (${results.length}개)`);
process.exit(failed ? 1 : 0);
