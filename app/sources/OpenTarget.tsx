"use client";
// 앱에서 근거 번호(S11 등)를 눌러 들어오면 그 항목의 '자세히'를 펼쳐 둔다(접힌 채로 오면 무엇을 보라는지 모름)
import { useEffect } from "react";

export default function OpenTarget() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      el?.querySelector("details")?.setAttribute("open", "");
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
