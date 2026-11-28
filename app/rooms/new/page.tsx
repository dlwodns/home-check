import type { Metadata } from "next";
import RoomAddClient from "./RoomAddClient";

export const metadata: Metadata = { title: "방 담기 · 홈체크" };

export default function RoomAddPage() {
  return <RoomAddClient />;
}
