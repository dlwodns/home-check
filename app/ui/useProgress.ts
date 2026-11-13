"use client";
// F1 진행 상황을 화면에서 쓰는 훅. 첫 화면은 빈 상태로 그리고(서버 화면과 맞추려고), 브라우저에서 저장된 값을 불러온다.
import { useCallback, useEffect, useState } from "react";
import { EMPTY_PROGRESS, localProgressStore, type Progress } from "@/lib/store/progress";

function store() {
  return localProgressStore(typeof window === "undefined" ? null : window.localStorage);
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProgress(store().load());
    setLoaded(true);
  }, []);

  const update = useCallback((change: (p: Progress) => Progress) => {
    setProgress((prev) => {
      const next = change(prev);
      store().save(next);
      return next;
    });
  }, []);

  return { progress, update, loaded };
}
