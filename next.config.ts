import type { NextConfig } from "next";

// 보안 헤더. CSP(이 사이트가 불러와도 되는 것)는 배포용에만 건다 — 개발 서버는 eval을 쓰기 때문.
// - 스크립트 · 글꼴 · 이미지 · 연결은 이 사이트 안에서만 (외부 분석 · 광고 없음)
// - 다른 사이트가 홈체크를 틀(iframe) 안에 넣지 못하게 (가짜 화면 겹치기 방지)
// - Next.js가 페이지에 넣는 작은 인라인 스크립트 · 스타일 때문에 'unsafe-inline'은 남겨 둔다
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  // 상위 폴더의 package-lock.json을 루트로 오인하지 않도록 고정
  turbopack: { root: __dirname },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
