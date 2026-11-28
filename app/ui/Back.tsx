"use client";
// 맨 위 왼쪽 ←: 브라우저 '뒤로'처럼 방금 보던 화면으로 그대로 돌아간다(11/28 사용자: 정해 둔 화면으로 새로 가면 헷갈린다).
// 앱 안에서 이동해 온 기록이 있을 때만 history.back(), 링크로 바로 들어와 돌아갈 곳이 없으면 fallback 주소로 간다.
// 기록은 이 탭의 sessionStorage에 주소 목록으로 둔다(NavTrack이 화면이 바뀔 때마다 갱신: 새 화면이면 쌓고, 뒤로 간 것이면 뺀다).
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const KEY = "homecheck.nav.v1";
const here = () => location.pathname + location.search;

function load(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(-50) : [];
  } catch {
    return [];
  }
}
function save(stack: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-50)));
  } catch {
    /* 막혀 있으면 ←는 fallback 주소로만 간다 */
  }
}

/** 이동 기록 갱신. app/layout에 한 번 둔다 */
export function NavTrack() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  useEffect(() => {
    const url = here();
    const stack = load();
    if (stack[stack.length - 1] === url) return;
    if (stack[stack.length - 2] === url) stack.pop(); // 뒤로 온 것
    else stack.push(url);
    save(stack);
  }, [pathname, search]);
  return null;
}

export const canGoBack = () => load().length > 1;

export default function BackButton({ fallback }: { fallback: string }) {
  return (
    <a
      href={fallback}
      className="back"
      aria-label="뒤로"
      onClick={(e) => {
        if (!canGoBack()) return; // 돌아갈 화면이 없으면 fallback 주소로
        e.preventDefault();
        history.back();
      }}
    >
      ←
    </a>
  );
}
