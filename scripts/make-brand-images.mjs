// 앱 아이콘(PWA · 홈 화면) · 공유 미리보기 이미지(OG)를 만든다. 결과 PNG는 저장소에 커밋하고, 글꼴 파일은 커밋하지 않는다.
// 한글은 글꼴의 글자 모양(path)을 SVG로 바꿔 그리므로 서버에 한글 글꼴이 설치돼 있지 않아도 된다.
// 실행: FONT_PATH=/경로/NanumGothic-Regular.ttf node scripts/make-brand-images.mjs
import { readFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import fontkit from "@pdf-lib/fontkit";

const GREEN = "#1F7A4D";
const INK = "#191F28";

// 집 + 체크 표시 (24 단위 좌표)
const mark = (stroke = "#FFFFFF", width = 2.4) =>
  `<path d="M3 11l9-7 9 7" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M6 10v9h12v-9" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M9 13.6l2.2 2.2 4-4.2" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** 둥근 네모 아이콘. maskable은 가장자리까지 색을 채우고 그림을 안쪽 60%에 둔다(안드로이드가 모양을 잘라도 안전하게). */
function iconSvg(size, maskable = false) {
  const inner = maskable ? 0.6 : 0.72;
  const s = (size * inner) / 24;
  const off = (size - 24 * s) / 2;
  const bg = maskable
    ? `<rect width="${size}" height="${size}" fill="${GREEN}"/>`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${GREEN}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg}<g transform="translate(${off} ${off}) scale(${s})">${mark()}</g></svg>`;
}

/** 글자를 글꼴의 path로 바꾼다. (x, baseline) 위치, px 크기. 굵게 보이려면 같은 색 외곽선을 덧그린다. */
function textPath(font, text, x, baseline, px, fill, bold = 0) {
  const run = font.layout(text);
  const scale = px / font.unitsPerEm;
  let cx = 0;
  let d = "";
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const path = g.path.toSVG();
    if (path) d += `<path transform="translate(${x + (cx + pos.xOffset) * scale} ${baseline}) scale(${scale} ${-scale})" d="${path}"/>`;
    cx += pos.xAdvance;
  });
  const stroke = bold ? ` stroke="${fill}" stroke-width="${bold / scale}" stroke-linejoin="round"` : "";
  return { svg: `<g fill="${fill}"${stroke}>${d}</g>`, width: cx * scale };
}

function ogSvg(font) {
  const W = 1200;
  const H = 630;
  const title = textPath(font, "홈체크", 228, 250, 92, INK, 3);
  const l1 = textPath(font, "이 방, 계약해도 될까?", 96, 390, 56, INK, 1.6);
  const l2 = textPath(font, "위험부터 확인하고, 그 방에 맞는 계약 방법까지", 96, 470, 38, "#4E5968", 0.6);
  const l3 = textPath(font, "전월세 계약 전 등기부등본 점검 · 참고용 안내", 96, 560, 28, "#6B7684");
  const icon = `<g transform="translate(96 160)"><rect width="110" height="110" rx="26" fill="${GREEN}"/><g transform="translate(16 16) scale(3.25)">${mark()}</g></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#FFFFFF"/><rect y="${H - 16}" width="${W}" height="16" fill="${GREEN}"/>${icon}${title.svg}${l1.svg}${l2.svg}${l3.svg}</svg>`;
}

const png = (svg, out) => sharp(Buffer.from(svg)).png().toFile(out);

mkdirSync("public", { recursive: true });
await png(iconSvg(192), "public/icon-192.png");
await png(iconSvg(512), "public/icon-512.png");
await png(iconSvg(512, true), "public/icon-maskable-512.png");
await png(iconSvg(180, true), "app/apple-icon.png");
await png(iconSvg(64), "app/icon.png");

const fontPath = process.env.FONT_PATH;
if (!fontPath) {
  console.log("FONT_PATH가 없어 공유 미리보기(og.png)는 건너뜀");
} else {
  const font = fontkit.create(readFileSync(fontPath));
  await png(ogSvg(font), "public/og.png");
}
console.log("완료");
