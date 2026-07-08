-- =============================================
-- TeaNote v58 マイグレーション（公開件数の月次管理）
-- Supabase SQL Editor で実行してください
-- =============================================
-- コミュニティ公開の上限を「月ごと」に管理する。
-- 「公開操作をした日時」で当月分を数え、月が変わると0からリスタートする。
-- 上限を途中で変更しても、当月の公開済み分は遡って非公開にしない
-- （新しい上限は翌月の集計から効く）。
--
-- 仕組み: 公開操作をするたびに review_publish_log に1行記録し、
--         「当月に記録された件数」で上限判定する。

create table if not exists public.review_publish_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  published_at timestamptz not null default now()
);

alter table public.review_publish_log enable row level security;

-- 自分のログだけ読み書きできる
create policy "rpl_select_own" on public.review_publish_log
  for select using (auth.uid() = user_id);
create policy "rpl_insert_own" on public.review_publish_log
  for insert with check (auth.uid() = user_id);

create index if not exists idx_rpl_user_time
  on public.review_publish_log (user_id, published_at);

-- 当月（暦月）の公開操作回数を返す
create or replace function public.count_my_publishes_this_month()
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.review_publish_log
  where user_id = auth.uid()
    and published_at >= date_trunc('month', now())
    and published_at <  date_trunc('month', now()) + interval '1 month';
$$;

grant execute on function public.count_my_publishes_this_month() to authenticated;
