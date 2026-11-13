import type { Metadata } from "next";
import { branches, steps } from "@/lib/content";
import StepsClient from "./StepsClient";

export const metadata: Metadata = { title: "내 계약 진행 · 홈체크" };

export default function StepsPage() {
  return <StepsClient steps={steps} branches={branches} />;
}
