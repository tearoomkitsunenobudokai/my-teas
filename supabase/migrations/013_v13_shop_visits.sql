-- =============================================
-- TeaNote v13 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① 訪問済み記録テーブル（ブックマークとは別管理）
create table if not exists public.shop_visits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  shop_id uuid references public.certified_shops(id) on delete cascade not null,
  visited_at date default current_date,
  memo text,
  created_at timestamptz default now(),
  unique(user_id, shop_id)  -- 1ユーザー1店舗につき1レコード（重複訪問は記録しない仕様）
);

alter table public.shop_visits enable row level security;
create policy "visits_select" on public.shop_visits for select using (auth.uid() = user_id);
create policy "visits_insert" on public.shop_visits for insert with check (auth.uid() = user_id);
create policy "visits_delete" on public.shop_visits for delete using (auth.uid() = user_id);

-- ② certified_count を「手動入力」から「自動集計」に変更
--    既存の手動カラムは残すが、実際の値はビューから取得するように運用を変更する。
--    アプリ側は profiles.certified_count を直接読まず、本ビューを参照する。
create or replace view public.profile_certified_stats as
select
  user_id,
  count(*) as certified_count
from public.shop_visits
group by user_id;

-- ③ 既存の手動入力値をリセット（自動集計に一本化するため）
update public.profiles set certified_count = 0;
