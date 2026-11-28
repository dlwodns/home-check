// 글자 예산 재기: 휴대폰 크기(390×844) 첫 화면에 보이는 글자 수(공백 빼고)를 화면마다 센다.
// 11/28 사용자 피드백 "읽으려 하면 피곤함이 먼저 온다" → 고치기 전후를 같은 방법으로 비교하려고 만들었다(결과는 README '써 보고 고친 기록').
// 문장 길이 규칙 자체는 tests/content.test.ts의 '글자 예산'이 CI에서 막는다. 이 스크립트는 화면 전체를 재는 보조 도구.
// 실행: U=http://localhost:3000 NODE_PATH=/설치폴더/node_modules CHROME_PATH=/경로/chrome node scripts/text-budget.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.NODE_PATH + "/")("playwright-core");
const U = process.env.U ?? "https://home-check-pi.vercel.app";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: "ko-KR" });
const p = await ctx.newPage();
await p.goto(U + "/"); await p.evaluate(() => { localStorage.setItem("homecheck.entered.v1","1"); sessionStorage.setItem("homecheck.opened.v1","1"); });
const dump = () => p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const el = w.currentNode.parentElement; const t = w.currentNode.textContent.trim(); if (!t || !el || !el.checkVisibility?.()) continue; const r = el.getBoundingClientRect(); if (r.width <= 1 || r.bottom < 0 || r.top > 844) continue; out.push(t); } return out.join(" | "); });
const paths = (process.env.P ?? "/,/guide,/rooms/new,/steps,/steps/1,/steps/2,/steps/3,/steps/4,/steps/5,/steps/6,/docs,/check,/where").split(",");
for (const path of paths) { await p.goto(U + path); await p.waitForTimeout(900); const t = await dump(); console.log(`\n## ${path} (${t.replace(/[\s|]/g,"").length}자)\n${t}`); }
if (!process.env.P) {
await p.goto(U + "/check"); await p.getByText(/예시 서류로 먼저 보기/).click(); await p.getByRole("button", { name: "예시 서류 3" }).click(); await p.waitForTimeout(500);
let t = await dump(); console.log(`\n## info (${t.replace(/[\s|]/g,"").length}자)\n${t}`);
await p.getByRole("button", { name: "점검하기" }).click(); await p.waitForTimeout(1200); await p.evaluate(() => scrollTo(0, 0));
t = await dump(); console.log(`\n## result (${t.replace(/[\s|]/g,"").length}자)\n${t}`);
}
await b.close();
