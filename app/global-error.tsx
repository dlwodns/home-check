"use client";
// 맨 바깥(layout)까지 깨졌을 때의 마지막 화면. 스타일 파일이 없을 수 있어 최소한의 글자만.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, lineHeight: 1.6 }}>
        <h1>홈체크를 여는 중에 문제가 생겼어요</h1>
        <p>담아 둔 후보 방은 이 기기에 그대로 있어요.</p>
        <button type="button" onClick={reset}>
          다시 시도
        </button>{" "}
        <a href="/">처음 화면으로</a>
      </body>
    </html>
  );
}
