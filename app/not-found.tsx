// 없는 주소로 들어왔을 때. 막히지 않게 갈 곳을 두 개만 보여 준다.
import Link from "next/link";
import BrandMark from "./ui/BrandMark";

export default function NotFound() {
  return (
    <main className="container check">
      <p className="brand">
        <BrandMark />
        홈체크
      </p>
      <h1 className="title">찾는 화면이 없어요</h1>
      <p className="muted">주소가 바뀌었거나 잘못 입력됐을 수 있어요.</p>
      <Link href="/" className="cta">
        내 후보 방으로
      </Link>
      <Link href="/check" className="cta cta-soft">
        등기부등본 점검하기
      </Link>
    </main>
  );
}
