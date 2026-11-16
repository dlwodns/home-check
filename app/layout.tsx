import type { Metadata, Viewport } from "next";
import "./globals.css";
import CloudSync from "./ui/CloudSync";

// 공유 미리보기 이미지 주소의 기준. Netlify는 배포 주소를 URL 환경 변수로 넣어 준다.
const site = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const description = "관심 있는 방, 계약해도 될까? 등기부등본으로 위험부터 확인하고, 그 방에 맞는 계약 방법까지 알려 드려요.";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "홈체크 · 전월세 계약 전 점검",
  description,
  applicationName: "홈체크",
  appleWebApp: { capable: true, title: "홈체크", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "홈체크",
    title: "홈체크 · 관심 있는 방, 계약해도 될까?",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "홈체크: 관심 있는 방, 계약해도 될까?" }],
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
        <CloudSync />
      </body>
    </html>
  );
}
