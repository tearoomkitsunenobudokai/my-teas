-- =============================================
-- TeaNote v78 マイグレーション（紅茶おみくじのサーバー保存）
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- これまで、おみくじのコレクションはブラウザのlocalStorage（端末内）にのみ保存していたため、
-- 端末を変えるとコレクションが引き継がれず、キャッシュ削除で失われる状態だった。
-- サーバー（DB）保存に切り替え、どの端末からでも同じコレクションを見られるようにする。

-- ① おみくじの取得記録
--    「どのNo.をいつ最初に引いたか」「累計何回引いたか」を保持する。
create table if not exists public.omikuji_draws (
  user_id uuid not null references public.profiles(id) on delete cascade,
  omikuji_no int not null,
  first_drawn_at timestamptz not null default now(),
  draw_count int not null default 1,
  primary key (user_id, omikuji_no)
);

alter table public.omikuji_draws enable row level security;

-- 自分の記録のみ閲覧・追加・更新できる
drop policy if exists "omikuji_draws_select_own" on public.omikuji_draws;
create policy "omikuji_draws_select_own" on public.omikuji_draws
  for select using (auth.uid() = user_id);

drop policy if exists "omikuji_draws_insert_own" on public.omikuji_draws;
create policy "omikuji_draws_insert_own" on public.omikuji_draws
  for insert with check (auth.uid() = user_id);

drop policy if exists "omikuji_draws_update_own" on public.omikuji_draws;
create policy "omikuji_draws_update_own" on public.omikuji_draws
  for update using (auth.uid() = user_id);

-- 管理者は全ユーザーの記録を閲覧できる（利用状況の把握用）
drop policy if exists "omikuji_draws_select_admin" on public.omikuji_draws;
create policy "omikuji_draws_select_admin" on public.omikuji_draws
  for select using (public.is_current_user_admin());

create index if not exists idx_omikuji_draws_user on public.omikuji_draws(user_id);

-- ② おみくじを引いたときに記録する関数
--    既に持っているNo.なら draw_count を増やすだけ（first_drawn_at は最初の日時を保持）。
create or replace function public.record_omikuji_draw(p_omikuji_no int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;

  insert into public.omikuji_draws (user_id, omikuji_no)
  values (auth.uid(), p_omikuji_no)
  on conflict (user_id, omikuji_no)
  do update set draw_count = public.omikuji_draws.draw_count + 1;
end;
$$;

grant execute on function public.record_omikuji_draw(int) to authenticated;

-- ③ 端末に残っている既存コレクションをサーバーへ引き継ぐための関数
--    アプリ側が localStorage の配列を渡すと、まだDBに無いNo.だけ追加する。
--    （既にDBにあるものは draw_count を増やさない＝二重カウントを防ぐ）
create or replace function public.merge_omikuji_collection(p_numbers int[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added int := 0;
begin
  if auth.uid() is null or p_numbers is null then return 0; end if;

  insert into public.omikuji_draws (user_id, omikuji_no)
  select auth.uid(), n from unnest(p_numbers) as n
  on conflict (user_id, omikuji_no) do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

grant execute on function public.merge_omikuji_collection(int[]) to authenticated;
