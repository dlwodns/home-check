"use client";
// 후보 방 추가: 주소 · 보증금/월세 · (선택) 링크 · 메모 세 칸만. 저장하면 바로 그 방 화면으로 간다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { addRoom, MAX_ROOMS, newRoomId, roomHref, validateRoomInput, type RoomInput } from "@/lib/store/rooms";
import { todayKST } from "@/lib/registry/check";
import { useRooms } from "../../ui/useRooms";

const EMPTY: RoomInput = { address: "", deposit: "", rent: "", note: "" };

export default function RoomAddClient() {
  const router = useRouter();
  const { rooms, update, loaded } = useRooms();
  const [input, setInput] = useState<RoomInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof RoomInput, string>>>({});
  const ids = { address: useId(), deposit: useId(), rent: useId(), note: useId() };
  const full = loaded && rooms.length >= MAX_ROOMS;

  const set = (k: keyof RoomInput) => (e: React.ChangeEvent<HTMLInputElement>) => setInput((v) => ({ ...v, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateRoomInput(input);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    const id = newRoomId();
    update((s) => addRoom(s, v.draft, id, todayKST()));
    router.push(roomHref(id));
  };

  const err = (k: keyof RoomInput) =>
    errors[k] ? (
      <p className="error-text" id={`${ids[k]}-err`} role="alert">
        {errors[k]}
      </p>
    ) : null;
  const described = (k: keyof RoomInput, hint?: string) => [errors[k] ? `${ids[k]}-err` : "", hint ?? ""].filter(Boolean).join(" ") || undefined;

  return (
    <main className="container check">
      <nav className="topbar">
        <Link href="/" className="back" aria-label="내 후보 방으로">
          ←
        </Link>
        <span>후보 방 추가</span>
      </nav>
      <h1 className="title">어떤 방인가요?</h1>
      <p className="muted">세 가지만 적으면 돼요</p>

      {full ? (
        <p className="card warn">후보 방은 {MAX_ROOMS}개까지 담을 수 있어요. 안 쓰는 방을 지운 뒤 추가해 주세요.</p>
      ) : (
        <form onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor={ids.address}>주소</label>
            <input
              id={ids.address}
              value={input.address}
              onChange={set("address")}
              placeholder="예: OO동 123-4"
              autoComplete="off"
              aria-invalid={Boolean(errors.address)}
              aria-describedby={described("address", `${ids.address}-hint`)}
            />
            <p className="hint" id={`${ids.address}-hint`}>
              동 · 번지까지만 적어도 돼요. 호수는 적지 않아도 괜찮아요.
            </p>
            {err("address")}
          </div>

          <div className="row-2">
            <div className="field">
              <label htmlFor={ids.deposit}>보증금 (만 원)</label>
              <input
                id={ids.deposit}
                inputMode="numeric"
                value={input.deposit}
                onChange={set("deposit")}
                placeholder="예: 1000"
                aria-invalid={Boolean(errors.deposit)}
                aria-describedby={described("deposit")}
              />
              {err("deposit")}
            </div>
            <div className="field">
              <label htmlFor={ids.rent}>월세 (만 원)</label>
              <input
                id={ids.rent}
                inputMode="numeric"
                value={input.rent}
                onChange={set("rent")}
                placeholder="전세면 비워 두세요"
                aria-invalid={Boolean(errors.rent)}
                aria-describedby={described("rent")}
              />
              {err("rent")}
            </div>
          </div>

          <div className="field">
            <label htmlFor={ids.note}>
              매물 링크 · 메모 <span className="muted">(선택)</span>
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
              링크는 다시 열어 보는 바로가기로만 저장해요. 메모는 방 이름으로 보여요.
            </p>
            {err("note")}
          </div>

          <p className="privacy">🔒 이 휴대폰(브라우저)에만 저장돼요. 등기부등본은 다음 화면에서 올리고, 어디에도 보내지 않아요.</p>

          <button type="submit" className="primary">
            저장하고 이 방 보기
          </button>
        </form>
      )}
    </main>
  );
}
