import type { Metadata } from "next";
import DocsClient from "./DocsClient";

export const metadata: Metadata = { title: "서류 · 준비물 · 홈체크" };

export default function DocsPage() {
  return <DocsClient />;
}
