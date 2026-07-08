-- =============================================
-- TeaNote v7 マイグレーション
-- =============================================

-- 認定店ブックマーク（1ユーザー最大10件）
create table if not exists public.shop_bookmarks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  shop_id uuid references public.certified_shops(id) on delete cascade not null,
  memo text,
  created_at timestamptz default now(),
  unique(user_id, shop_id)
);

alter table public.shop_bookmarks enable row level security;
create policy "bookmarks_select" on public.shop_bookmarks for select using (auth.uid() = user_id);
create policy "bookmarks_insert" on public.shop_bookmarks for insert with check (auth.uid() = user_id);
create policy "bookmarks_delete" on public.shop_bookmarks for delete using (auth.uid() = user_id);
