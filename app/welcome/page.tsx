// 로비 다시 보기 (홈 아래 '홈체크 소개')
import type { Metadata } from "next";
import Lobby from "../Lobby";

export const metadata: Metadata = { title: "홈체크 소개 · 이 방, 계약해도 될까?" };

export default function WelcomePage() {
  return <Lobby />;
}
