// 로비를 지나 한 번 들어온 사람인지 (이 기기에만 저장). 들어온 사람은 다음부터 바로 '내 후보 방'으로 간다.
const KEY = "homecheck.entered.v1";

export function hasEntered(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markEntered() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* 저장이 막혀 있으면 다음에도 로비가 보일 뿐 */
  }
}

// 앱을 새로 열 때마다(탭마다 한 번) 입구 화면(로고 + 시작하기)을 보여 준다. 같은 탭에서 홈으로 돌아올 때는 바로 '내 후보 방'.
const OPENED = "homecheck.opened.v1";

/** 이 탭에서 처음 여는 것이면 true(그리고 기억). 저장이 막힌 환경이면 false(입구 없이 바로) */
export function firstOpenInTab(): boolean {
  try {
    if (sessionStorage.getItem(OPENED)) return false;
    sessionStorage.setItem(OPENED, "1");
    return true;
  } catch {
    return false;
  }
}

/** 왼쪽 위 홈체크 로고: 처음 열 때처럼 입구 화면부터 다시 보이게 */
export function replayEntry() {
  try {
    sessionStorage.removeItem(OPENED);
  } catch {
    /* 막혀 있으면 새로고침만 된다 */
  }
}
