// 방 없이 계약 과정만 미리 보기 (아직 방을 못 찾았거나, 순서부터 알고 싶은 사람).
import type { Metadata } from "next";
import StartClient from "../StartClient";

export const metadata: Metadata = { title: "계약 과정 미리 보기 · 홈체크" };

export default function GuidePage() {
  return <StartClient />;
}
