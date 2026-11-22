// 포스터용 앱 화면 캡처: 배포된 홈체크를 휴대폰 크기(390px, 3배 해상도)로 열어 방 추가 → 주의 샘플 점검 → 결과 · 다음 할 일 · 방 화면을 찍는다.
// shortcut: playwright-core는 이 저장소 의존성에 넣지 않았다(포스터 때 한 번 씀). 다른 폴더에 설치한 뒤 NODE_PATH로 알려 준다.
// 실행: NODE_PATH=/설치폴더/node_modules CHROME_PATH=/경로/chrome node scripts/poster-shots.mjs [주소]
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.NODE_PATH + "/")("playwright-core");

const U = process.argv[2] ?? "https://home-checkapp.netlify.app";
const OUT = "poster/img";
const W = 390, H = 780;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const ctx = await b.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "ko-KR" });
await ctx.route(/\.netlify\/scripts\/hud/, (r) => r.abort()); // 무료 요금제가 붙이는 'Powered by Netlify' 배지
const p = await ctx.newPage();
const from = async (name, loc, pad) => {
  await p.waitForTimeout(1200);
  const bb = await loc.boundingBox();
  const y = Math.max(0, bb.y + (await p.evaluate(() => scrollY)) - pad);
  await p.screenshot({ path: `${OUT}/screen-${name}.png`, fullPage: true, clip: { x: 0, y, width: W, height: H } });
  console.log("찍음", name);
};

await p.goto(U + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500); // 로비 등장 효과가 끝날 때까지
await p.screenshot({ path: `${OUT}/screen-lobby.png`, clip: { x: 0, y: 110, width: W, height: H - 120 } });

await p.goto(U + "/rooms/new", { waitUntil: "networkidle" });
await p.fill("input[placeholder^='예: OO동']", "마포구 서교동 123-4");
await p.fill("input[placeholder='예: 1000']", "1000");
await p.fill("input[placeholder='전세면 비워 두세요']", "60");
await p.fill("input[placeholder^='직방 링크']", "정문 앞 원룸");
await p.getByRole("button", { name: /저장하고/ }).click();
await p.waitForURL(/room\?id=/);
const roomUrl = p.url();
await p.waitForTimeout(2000);
await p.getByText("등기부등본 올려서 점검하기").click();
await p.waitForURL(/check/);
await p.waitForTimeout(2000);
await p.getByRole("button", { name: "주의 샘플" }).click(); // 샘플은 지어낸 가짜 서류
await p.getByRole("button", { name: "점검하기" }).click();
await p.waitForTimeout(1500);
// 포스터에서 1m 거리로 읽히도록 핵심만 크게 자른 것(zoom-*): 신호등 판정 + 3줄 요약, 집주인에게 물어볼 말
const box = async (loc) => { const b = await loc.boundingBox(); const y = await p.evaluate(() => scrollY); return { top: b.y + y, bottom: b.y + y + b.height }; };
const zoom = async (name, top, bottom) => {
  await p.screenshot({ path: `${OUT}/zoom-${name}.png`, fullPage: true, clip: { x: 8, y: top, width: W - 16, height: bottom - top } });
  console.log("찍음 zoom", name);
};
const verdict = await box(p.locator("h2,h3", { hasText: "계약 전에 확인할 것이" }).first());
const nextLabel = await box(p.getByText("확인할 것", { exact: true }).first());
await zoom("verdict", verdict.top - 56, nextLabel.top - 10);
const ask = await box(p.locator("h2,h3", { hasText: "이렇게 물어보세요" }).first());
const doNext = await box(p.locator("h2,h3", { hasText: "이렇게 하세요" }).first());
await zoom("ask", ask.top - 22, doNext.top - 30);

await p.goto(roomUrl, { waitUntil: "networkidle" });
await p.waitForTimeout(3000); // 동네 시세 응답 기다림
await p.screenshot({ path: `${OUT}/screen-room.png`, fullPage: true, clip: { x: 0, y: 0, width: W, height: H + 200 } });
console.log("찍음 room");
await b.close();
