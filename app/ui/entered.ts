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
