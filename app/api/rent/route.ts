// GET /api/rent?sgg=시군구코드&dong=동이름 → 최근 6개월 같은 동 단독 · 다가구 전월세 분포 (처리는 lib/rentServer.ts)
import { handleRent, rateLimit } from "@/lib/rentServer";

export async function GET(req: Request) {
  // 배포 플랫폼이 넣어 주는 실제 접속 IP(Vercel: x-real-ip, Netlify: x-nf-client-connection-ip), 없으면 프록시 헤더의 첫 값
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-nf-client-connection-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  const wait = rateLimit(ip);
  if (wait > 0) return Response.json({ error: "too_many" }, { status: 429, headers: { "Retry-After": String(wait) } });
  return handleRent(new URL(req.url).searchParams, process.env, fetch);
}
