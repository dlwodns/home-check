"use client";
// 홈 오른쪽 위: 로그인 안 했으면 '로그인', 했으면 '내 계정'. 키가 없으면(로그인 준비 전) 아무것도 안 보인다.
import Link from "next/link";
import { useAuth } from "./useAuth";

export default function AccountLink() {
  const { user, loaded, enabled } = useAuth();
  if (!loaded || !enabled) return null;
  return (
    <Link href={user ? "/account" : "/login"} className="account-link">
      {user ? "내 계정" : "로그인"}
    </Link>
  );
}
