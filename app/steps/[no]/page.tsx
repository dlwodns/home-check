import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { branches, steps } from "@/lib/content";
import { Suspense } from "react";
import StepClient from "./StepClient";

export const dynamicParams = false;

export function generateStaticParams() {
  return steps.map((s) => ({ no: String(s.no) }));
}

export async function generateMetadata({ params }: { params: Promise<{ no: string }> }): Promise<Metadata> {
  const { no } = await params;
  const step = steps.find((s) => String(s.no) === no);
  return { title: step ? `${step.no}단계 ${step.title} · 홈체크` : "홈체크" };
}

export default async function StepPage({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const step = steps.find((s) => String(s.no) === no);
  if (!step) notFound();
  // 4단계는 ?doc= 로 서류를 고르므로(useSearchParams) Suspense로 감싼다
  return (
    <Suspense fallback={<main className="container check" aria-busy="true" />}>
      <StepClient step={step} total={steps.length} branches={branches} steps={steps} />
    </Suspense>
  );
}
