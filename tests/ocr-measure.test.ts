// OCR 정확도 측정(평소엔 건너뜀): OCR_IMG_DIR=그림 폴더 npx vitest run tests/ocr-measure.test.ts
// 그림은 가상 등기부 20건을 문서처럼 그린 것. 결과 표는 OCR_OUT 파일로 남긴다.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { createWorker } from "tesseract.js";
import { readRegistry } from "@/lib/registry/read";
import { ocrFix } from "@/lib/registry/ocrFix";
import type { RegistryRead } from "@/lib/registry/types";

const DIR = process.env.OCR_IMG_DIR;
const RISK: Record<string, string> = { 가처분: "provisional_disposition", 가등기: "provisional_registration", 경매개시결정: "auction", 신탁: "trust", 임차권등기: "lease_registration" };
type A = { file: string; current_owners: { name: string }[]; previous_owners: string[]; last_ownership_transfer: string | null; mortgage_total_won: number; active_risks: string[]; erased_risks: string[] };
const facts = (r: RegistryRead) => ({
  owners: r.current_owner.split(/,\s*/).filter(Boolean).sort(),
  previous: r.previous_owners,
  lastTransfer: r.last_ownership_transfer,
  mortgageTotal: r.active_mortgages.reduce((s, m) => s + m.max_claim, 0),
  risks: [...new Set([...(r.seizures.length ? ["seizure"] : []), ...(r.jeonses.length ? ["jeonse"] : []), ...r.risk_records.map((x) => RISK[x.type])])].sort(),
  erasedLease: r.erased_risk_records.some((x) => x.type === "임차권등기"),
});
const want = (a: A) => ({ owners: a.current_owners.map((o) => o.name).sort(), previous: a.previous_owners, lastTransfer: a.last_ownership_transfer, mortgageTotal: a.mortgage_total_won, risks: [...a.active_risks].sort(), erasedLease: a.erased_risks.includes("lease_registration") });

describe.skipIf(!DIR)("OCR 정확도 측정", () => {
  it("가상 등기부 20건", async () => {
    const w = await createWorker("kor", 1, { langPath: path.resolve("node_modules/@tesseract.js-data/kor/4.0.0_best_int"), gzip: true, cachePath: process.env.TMPDIR });
    const rows: string[] = []; let ok = 0, all = 0;
    for (const set of ["blind", "blind2"]) {
      for (const a of JSON.parse(readFileSync(`samples/${set}/answers.json`, "utf8")) as A[]) {
        // OCR_FROM_TEXT=1이면 앞서 저장한 OCR 글자(OCR_TEXT_DIR)를 다시 써서 읽기 규칙만 빠르게 재본다
        const data = process.env.OCR_FROM_TEXT ? { text: readFileSync(path.join(process.env.OCR_TEXT_DIR!, a.file), "utf8") } : (await w.recognize(path.join(DIR!, a.file.replace(".txt", ".png")))).data;
        const got = facts(readRegistry(process.env.OCR_RAW ? data.text : ocrFix(data.text)).read), exp = want(a);
        const keys = Object.keys(exp) as (keyof typeof exp)[];
        const miss = keys.filter((k) => JSON.stringify(got[k]) !== JSON.stringify(exp[k]));
        ok += keys.length - miss.length; all += keys.length;
        rows.push(`${a.file}\t${keys.length - miss.length}/${keys.length}\t${miss.map((k) => `${k}: ${JSON.stringify(got[k])} ≠ ${JSON.stringify(exp[k])}`).join(" | ")}`);
        if (process.env.OCR_TEXT_DIR && !process.env.OCR_FROM_TEXT) writeFileSync(path.join(process.env.OCR_TEXT_DIR, a.file), data.text);
      }
    }
    await w.terminate();
    rows.push(`합계\t${ok}/${all}`);
    writeFileSync(process.env.OCR_OUT ?? "/dev/stdout", rows.join("\n") + "\n");
  }, 600_000);
});
