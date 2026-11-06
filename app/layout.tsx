import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "홈체크",
  description: "전월세 계약 전에 등기부등본 위험 신호를 쉽게 점검해 줍니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
