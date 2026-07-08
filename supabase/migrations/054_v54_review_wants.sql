-- =============================================
-- TeaNote v54 マイグレーション（飲みたいリスト）
-- Supabase SQL Editor で実行してください
-- =============================================
-- コミュニティの評価に対して「飲みたい」を登録できるようにする。
-- 自分用のブックマーク（最大件数はアプリ側で制御・現在10件）。
-- 「何人が押したか」の集計・表示は行わない（本人だけが自分の登録を見る）。

create table if not exists public.review_wants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, review_id)
);

alter table public.review_wants enable row level security;

-- 自分の「飲みたい」だけ読み書きできる（一覧・登録・解除）
create policy "review_wants_select_own" on public.review_wants
  for select using (auth.uid() = user_id);
create policy "review_wants_insert_own" on public.review_wants
  for insert with check (auth.uid() = user_id);
create policy "review_wants_delete_own" on public.review_wants
  for delete using (auth.uid() = user_id);
