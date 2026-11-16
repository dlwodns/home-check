import type { Metadata } from "next";
import RoomAddClient from "./RoomAddClient";

export const metadata: Metadata = { title: "후보 방 추가 · 홈체크" };

export default function RoomAddPage() {
  return <RoomAddClient />;
}
