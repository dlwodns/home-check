"use client";
// /guide = '계약 과정 미리보기'. 입구에서 고른 미리보기와 같은 화면(ProcessPreview)을 쓴다(11/28: 이름 · 내용 하나로).
import BackButton from "./ui/Back";
import HomeLink from "./ui/HomeLink";
import ProcessPreview from "./ui/ProcessPreview";

export default function StartClient() {
  return (
    <main className="container welcome-preview guide">
      <nav className="topbar">
        <BackButton fallback="/" />
        <HomeLink />
      </nav>
      <ProcessPreview />
    </main>
  );
}
