import type { Metadata } from "next";
import { branchQuestion } from "@/lib/content";
import WhereClient from "./WhereClient";

export const metadata: Metadata = { title: "어디서 찾았어요? · 홈체크" };

export default function WherePage() {
  return <WhereClient question={branchQuestion} />;
}
