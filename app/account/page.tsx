import type { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = { title: "내 계정 · 홈체크" };

export default function AccountPage() {
  return <AccountClient />;
}
