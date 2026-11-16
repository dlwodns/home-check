// PWA: 휴대폰 홈 화면에 아이콘으로 추가하면 앱처럼 열린다. (오프라인 저장 · 서비스 워커는 쓰지 않음: 오래된 화면이 남지 않게)
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "홈체크 · 전월세 계약 전 점검",
    short_name: "홈체크",
    description: "관심 있는 방, 계약해도 될까? 위험부터 확인하고, 그 방에 맞는 계약 방법까지.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1F7A4D",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
