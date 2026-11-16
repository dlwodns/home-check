// 이 기기 저장값이 바뀌었다는 신호. 로그인 중이면 CloudSync가 받아서 계정에도 저장한다.
export const SAVED_EVENT = "homecheck:saved";

export function notifySaved() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SAVED_EVENT));
}
