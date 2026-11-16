// GET /api/rent?sgg=시군구코드&dong=동이름 → 최근 6개월 같은 동 단독 · 다가구 전월세 분포 (처리는 lib/rentServer.ts)
import { handleRent } from "@/lib/rentServer";

export async function GET(req: Request) {
  return handleRent(new URL(req.url).searchParams, process.env, fetch);
}
