import type { Metadata, Viewport } from "next";
import "./globals.css";
import CloudSync from "./ui/CloudSync";
import { NavTrack } from "./ui/Back";

// 공유 미리보기 이미지 주소의 기준. 직접 정한 값 → Vercel이 넣어 주는 운영 주소(https 없이 옴) → Netlify의 URL → 내 컴퓨터
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? (vercel ? `https://${vercel}` : undefined) ?? process.env.URL ?? "http://localhost:3000";
// 배포본과 저장소가 같은 버전인지 채점자가 맞춰 볼 수 있게 (Vercel이 빌드 때 넣어 줌)
const commit = process.env.VERCEL_GIT_COMMIT_SHA;
const description = "이 방, 계약해도 될까? 등기부등본으로 위험부터 확인하고, 그 방에 맞는 계약 방법까지 알려 드려요.";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "홈체크 · 이 방, 계약해도 될까?",
  description,
  applicationName: "홈체크",
  appleWebApp: { capable: true, title: "홈체크", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "홈체크",
    title: "홈체크 · 이 방, 계약해도 될까?",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "홈체크 · 이 방, 계약해도 될까?" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#1F7A4D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <footer className="disclaimer site-foot">
          <a href="https://github.com/dlwodns/home-check">소스 코드(GitHub)</a>
          {commit ? ` · 버전 ${commit.slice(0, 7)}` : ""}
        </footer>
        <CloudSync />
        <NavTrack />
      </body>
    </html>
  );
}
