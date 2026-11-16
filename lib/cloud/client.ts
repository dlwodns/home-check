// Supabase 연결. 키(NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY)가 없으면 null → 앱은 로그인 없이 그대로 동작한다.
// 이 두 값은 원래 브라우저에 보이는 공개용이고, 실제 권한은 DB의 RLS(자기 줄만)로 막는다.
// 관리자 키(service_role · secret)는 이 앱 어디에도 쓰지 않는다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client =
    url && key && typeof window !== "undefined"
      ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "homecheck.auth.v1" } })
      : null;
  return client;
}

export const cloudEnabled = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
