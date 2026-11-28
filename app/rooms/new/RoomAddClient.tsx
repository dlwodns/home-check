"use client";
// 후보 방 추가: 주소 · 보증금/월세 · (선택) 링크 · 메모 세 칸만. 저장하면 바로 그 방 화면으로 간다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Region } from "@/lib/region";
import { addRoom, MAX_ROOMS, newRoomId, roomHref, validateRoomInput, type RoomInput } from "@/lib/store/rooms";
import { todayKST } from "@/lib/registry/check";
import { useRooms } from "../../ui/useRooms";
import HomeLink from "../../ui/HomeLink";
import MoneyInput from "../../ui/MoneyInput";
import BackButton from "../../ui/Back";

type Field = "address" | "deposit" | "rent" | "note";
const EMPTY: RoomInput = { address: "", deposit: "", rent: "", note: "" };
type RegionModule = typeof import("@/lib/region");

export default function RoomAddClient() {
  const router = useRouter();
  const { rooms, update, loaded } = useRooms();
  const [input, setInput] = useState<RoomInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  // 주소 → 동네(법정동) 찾기. 지역 표가 커서 이 화면에서만 나중에 불러온다
  const [regionMod, setRegionMod] = useState<RegionModule | null>(null);
  const [picked, setPicked] = useState<Region | null>(null);
  useEffect(() => {
    let alive = true;
    import("@/lib/region").then((m) => alive && setRegionMod(m));
    return () => {
      alive = false;
    };
  }, []);
  const options = regionMod ? regionMod.findRegions(input.address) : [];
  const key = (r: Region) => `${r.sgg}|${r.dong}`;
  const chosen = picked && options.some((o) => key(o) === key(picked)) ? picked : options.length === 1 ? options[0] : null;
  const ids = { address: useId(), deposit: useId(), rent: useId(), note: useId() };
  const full = loaded && rooms.length >= MAX_ROOMS;

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => setInput((v) => ({ ...v, [k]: e.target.value }));

  const [saving, setSaving] = useState(false); // 두 번 눌러도 방이 하나만 생기게
  const savingRef = useRef(false);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    const v = validateRoomInput({ ...input, region: chosen ? { sgg: chosen.sgg, dong: chosen.dong } : null });
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const id = newRoomId();
    update((s) => addRoom(s, v.draft, id, todayKST()));
    router.replace(roomHref(id)); // 저장한 입력 화면은 기록에서 빼서, 방 화면의 ←가 다시 빈 입력 화면으로 가지 않게
  };

  const err = (k: Field) =>
    errors[k] ? (
      <p className="error-text" id={`${ids[k]}-err`} role="alert">
        {errors[k]}
      </p>
    ) : null;
  const described = (k: Field, hint?: string) => [errors[k] ? `${ids[k]}-err` : "", hint ?? ""].filter(Boolean).join(" ") || undefined;

  return (
    <main className="container check">
      <nav className="topbar">
        <BackButton fallback={"/"} />
        <span>후보 방 추가</span>
        <HomeLink />
      </nav>
      <h1 className="title">어떤 방인가요?</h1>
      <p className="muted">세 가지만 적으면 돼요</p>

      {full ? (
        <p className="card warn">후보 방은 {MAX_ROOMS}개까지 담을 수 있어요. 안 쓰는 방을 지운 뒤 추가해 주세요.</p>
      ) : (
        <form onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor={ids.address} data-mark="필수">주소</label>
            <input
              id={ids.address}
              aria-required="true"
              value={input.address}
              onChange={set("address")}
              placeholder="예: OO동 123-4"
              autoComplete="off"
              aria-invalid={Boolean(errors.address)}
              aria-describedby={described("address", `${ids.address}-hint`)}
            />
            <p className="hint" id={`${ids.address}-hint`}>
              동까지 적으면 동네 시세도 찾아 드려요
            </p>
            {err("address")}
            {options.length > 1 && (
              <div className="region-pick">
                <p className="small strong" id="region-q">
                  어느 동네인가요?
                </p>
                <div className="seg-choice" role="radiogroup" aria-labelledby="region-q">
                  {options.map((o) => (
                    <button
                      key={key(o)}
                      type="button"
                      role="radio"
                      aria-checked={chosen ? key(chosen) === key(o) : false}
                      className={`chip${chosen && key(chosen) === key(o) ? " chip-on" : ""}`}
                      onClick={() => setPicked(o)}
                    >
                      {o.sggName} {o.dong}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chosen && (
              <p className="hint region-ok" role="status">
                ✓ {chosen.sggName} {chosen.dong} · 이 동네 시세를 찾아 드려요
              </p>
            )}
            {regionMod && !chosen && options.length === 0 && input.address.trim().length >= 3 && (
              <p className="hint" role="status">
                동 이름을 못 찾았어요. 이대로 저장해도 되고, '창천동'처럼 주소의 동 이름을 넣으면 동네 시세도 볼 수 있어요. (예: 신촌 → 창천동 · 대현동, 홍대 앞 → 서교동)
              </p>
            )}
          </div>

          <div className="row-2">
            <div className="field">
              <label htmlFor={ids.deposit} data-mark="필수">보증금 (원)</label>
              <MoneyInput
                id={ids.deposit}
                aria-required="true"
                hintId={`${ids.deposit}-h`}
                value={input.deposit}
                onChange={(v) => setInput((x) => ({ ...x, deposit: v }))}
                placeholder="예: 10,000,000"
                aria-invalid={Boolean(errors.deposit)}
                aria-describedby={described("deposit")}
              />
              {err("deposit")}
            </div>
            <div className="field">
              <label htmlFor={ids.rent} data-mark="선택">월세 (원)</label>
              <MoneyInput
                id={ids.rent}
                hintId={`${ids.rent}-h`}
                value={input.rent}
                onChange={(v) => setInput((x) => ({ ...x, rent: v }))}
                placeholder="전세면 비워 두세요"
                aria-invalid={Boolean(errors.rent)}
                aria-describedby={described("rent")}
              />
              {err("rent")}
            </div>
          </div>

          <div className="field">
            <label htmlFor={ids.note} data-mark="선택">
              매물 링크 · 메모
            </label>
            <input
              id={ids.note}
              value={input.note}
              onChange={set("note")}
              placeholder="직방 링크를 붙여 넣거나 '정문 원룸'처럼 적어요"
              aria-invalid={Boolean(errors.note)}
              aria-describedby={described("note", `${ids.note}-hint`)}
            />
            <p className="hint" id={`${ids.note}-hint`}>
              메모는 방 이름으로 보여요
            </p>
            {err("note")}
          </div>

          <p className="privacy">🔒 이 기기에만 저장돼요 · <Link href="/privacy">자세히</Link></p>

          <button type="submit" className="primary" disabled={saving}>
            저장하고 이 방 보기
          </button>
        </form>
      )}
    </main>
  );
}
