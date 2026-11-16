// 홈체크 표시: 앱 아이콘과 같은 '집 + 체크' 모양
export default function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-7 9 7" />
        <path d="M6 10v9h12v-9" />
        <path d="M9 13.6l2.2 2.2 4-4.2" />
      </svg>
    </span>
  );
}
