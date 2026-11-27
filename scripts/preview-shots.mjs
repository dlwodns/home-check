// '계약 과정 미리보기' 화면 5장(public/preview/*.jpg)을 배포본에서 다시 찍는다. 화면을 크게 바꾸면 다시 돌린다.
// 실행: NODE_PATH=/설치폴더/node_modules CHROME_PATH=/경로/chrome node scripts/preview-shots.mjs [주소]
// 이모지(🔒)가 네모로 나오면 NotoColorEmoji 글꼴을 FONTCONFIG_FILE로 알려 준다. 예시 서류만 쓰고, 동네 시세 요청은 막는다.
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.NODE_PATH + "/")("playwright-core");
const U = process.argv[2] ?? "https://home-check-pi.vercel.app", OUT = "public/preview";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\/rent/, (r) => r.abort());
const p = await ctx.newPage();
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.jpg`, type: "jpeg", quality: 72 });
const top = async (loc) => { await loc.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -12)); };
await p.goto(U + "/rooms/new", { waitUntil: "networkidle" });
await p.fill("input[placeholder^='예: OO동']", "마포구 서교동 123-4");
await p.fill("input[placeholder='예: 10,000,000']", "10000000");
await p.fill("input[placeholder='전세면 비워 두세요']", "500000");
await shot("1-room");
await p.getByRole("button", { name: /저장하고/ }).click(); await p.waitForURL(/room\?id=/);
await p.getByText("등기부등본 올려서 점검하기").click(); await p.waitForURL(/check/); await p.waitForTimeout(500);
await shot("2-doc");
await p.getByText(/예시 서류로 먼저 보기/).click();
await p.getByRole("button", { name: "주의 샘플" }).click();
await p.getByRole("button", { name: "점검하기" }).click(); await p.waitForTimeout(1500);
await top(p.locator(".result")); await shot("3-result");
await top(p.getByText("다음에 할 일").first()); await shot("4-next");
await p.goBack(); await p.waitForURL(/room\?id=/); await p.waitForTimeout(600);
await top(p.getByRole("heading", { name: "계약 과정" })); await shot("5-steps");
await b.close();
