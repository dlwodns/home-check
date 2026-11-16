-- 홈체크 F0: 계정에 저장하는 것 = 후보 방 목록과 진행 상황(체크 · 갈래 · 처음이에요/해 봤어요) 한 줄.
-- 등기부등본 원문 · 집주인 이름은 앱이 애초에 저장하지 않으므로 여기에도 없다.
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 안전하게 썼다.

create table if not exists public.user_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rooms jsonb not null default '{"v":1,"rooms":[]}'::jsonb,
  progress jsonb not null default '{"v":1,"mode":null,"branch":null,"checked":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  -- 한 사람 기록이 터무니없이 커지지 않게 (후보 방 20개 기준으로 넉넉한 크기)
  constraint user_state_size check (octet_length(rooms::text) + octet_length(progress::text) < 300000)
);

-- 자기 줄만 보고 · 쓰고 · 지울 수 있게 (RLS)
alter table public.user_state enable row level security;

drop policy if exists "own row: select" on public.user_state;
drop policy if exists "own row: insert" on public.user_state;
drop policy if exists "own row: update" on public.user_state;
drop policy if exists "own row: delete" on public.user_state;
create policy "own row: select" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "own row: insert" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own row: update" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own row: delete" on public.user_state for delete to authenticated using ((select auth.uid()) = user_id);

-- "새 테이블 자동 공개"를 끈 프로젝트라 필요한 권한만 직접 연다. 로그인 안 한 사용자(anon)는 아무것도 못 함
revoke all on public.user_state from anon;
grant select, insert, update, delete on public.user_state to authenticated;

-- 계정 삭제: 본인 계정만 지운다. user_state는 위의 on delete cascade로 함께 지워진다
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
