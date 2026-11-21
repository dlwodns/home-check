// A2 포스터(poster/poster.html) → PDF(인쇄용) + PNG(미리보기). 새 의존성 없이 크롬의 headless 인쇄를 쓴다.
// 실행: CHROME_PATH=/경로/chrome node scripts/make-poster.mjs
//   글꼴: Pretendard가 시스템에 없으면 FONTCONFIG_FILE로 Pretendard가 든 폴더를 알려 준다(.claude/skills/poster/SKILL.md 참고)
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const chrome = process.env.CHROME_PATH;
if (!chrome || !existsSync(chrome)) {
  console.error("CHROME_PATH에 크롬(또는 chrome-headless-shell) 실행 파일 경로를 넣어 주세요");
  process.exit(1);
}
const html = "file://" + resolve("poster/poster.html");
const pdf = resolve("poster/homecheck-poster-A2.pdf");
const png = resolve("poster/homecheck-poster-preview.png");
const base = ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--virtual-time-budget=5000"];

execFileSync(chrome, [...base, "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, html], { stdio: "ignore" });
// A2 = 420 × 594mm → 96dpi에서 1587 × 2245px
execFileSync(chrome, [...base, "--window-size=1587,2245", `--screenshot=${png}`, html], { stdio: "ignore" });

for (const f of [pdf, png]) {
  if (!existsSync(f) || statSync(f).size < 10_000) throw new Error(`만들지 못함: ${f}`);
  console.log("완료", f, Math.round(statSync(f).size / 1024) + "KB");
}
