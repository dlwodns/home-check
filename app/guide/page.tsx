// 계약 과정 미리보기 (입구의 미리보기와 같은 화면).
import type { Metadata } from "next";
import StartClient from "../StartClient";

export const metadata: Metadata = { title: "계약 과정 미리보기 · 홈체크" };

export default function GuidePage() {
  return <StartClient />;
}
