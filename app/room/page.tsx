import type { Metadata } from "next";
import { branches, steps } from "@/lib/content";
import RoomDetailClient from "./RoomDetailClient";

export const metadata: Metadata = { title: "후보 방 · 홈체크" };

export default function RoomPage() {
  return <RoomDetailClient steps={steps} branches={branches} />;
}
