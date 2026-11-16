// 계정 저장(로그인했을 때만). 이 기기 저장이 기본이고, 계정은 같은 내용을 한 줄(user_state)로 따라 저장한다.
// 로그인 직후: 계정 기록을 받아 이 기기 기록과 합친 뒤(잃는 것 없이) 양쪽에 저장. 그 뒤로는 이 기기에서 바뀔 때마다 계정에 올린다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressStore } from "@/lib/store/progress";
import type { RoomsStore } from "@/lib/store/rooms";
import { mergeState, parseCloudRow, type CloudState } from "./merge";

export interface SyncDb {
  pull(): Promise<CloudState | null>;
  push(state: CloudState): Promise<void>;
  clear(): Promise<void>;
}

export function supabaseDb(sb: SupabaseClient, userId: string): SyncDb {
  return {
    async pull() {
      const { data, error } = await sb.from("user_state").select("rooms, progress").eq("user_id", userId).maybeSingle();
      if (error) throw new Error(`pull_${error.code ?? "error"}`);
      return data ? parseCloudRow(data) : null;
    },
    async push(state) {
      const { error } = await sb
        .from("user_state")
        .upsert({ user_id: userId, rooms: state.rooms, progress: state.progress, updated_at: new Date().toISOString() });
      if (error) throw new Error(`push_${error.code ?? "error"}`);
    },
    async clear() {
      const { error } = await sb.from("user_state").delete().eq("user_id", userId);
      if (error) throw new Error(`clear_${error.code ?? "error"}`);
    },
  };
}

export interface LocalStores {
  rooms: RoomsStore;
  progress: ProgressStore;
}

export const readLocal = (s: LocalStores): CloudState => ({ rooms: s.rooms.load(), progress: s.progress.load() });

/** 로그인 직후 한 번: 받아서 합치고, 이 기기와 계정 양쪽에 저장 */
export async function syncOnce(db: SyncDb, local: LocalStores): Promise<CloudState> {
  const remote = await db.pull();
  const mine = readLocal(local);
  const merged = remote ? mergeState(mine, remote) : mine;
  local.rooms.save(merged.rooms);
  local.progress.save(merged.progress);
  await db.push(merged);
  return merged;
}
