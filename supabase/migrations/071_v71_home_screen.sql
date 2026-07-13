-- =============================================
-- TeaNote v71 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ホーム画面（ログイン後の最初の画面）用のテーブル。
--  ・announcements: お知らせ（管理者・製作者のみ投稿可、全ユーザー閲覧可）
--  ・home_links: 広告掲載欄・SNSリンク（管理者・製作者のみ編集可、全ユーザー閲覧可）

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements_select" on public.announcements;
create policy "announcements_select" on public.announcements
  for select using (auth.role() = 'authenticated');

drop policy if exists "announcements_write" on public.announcements;
create policy "announcements_write" on public.announcements
  for all using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create index if not exists idx_announcements_sort on public.announcements(sort_order);


create table if not exists public.home_links (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ad', 'sns')),  -- 'ad'=広告掲載欄, 'sns'=SNSリンク
  label text not null,                                -- 表示名（例: 公式X、スポンサー名）
  url text not null,
  image_url text,                                     -- 広告バナー画像（任意）
  icon text,                                           -- SNS用の絵文字/短いラベル（任意、例: 𝕏）
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_links enable row level security;

drop policy if exists "home_links_select" on public.home_links;
create policy "home_links_select" on public.home_links
  for select using (auth.role() = 'authenticated');

drop policy if exists "home_links_write" on public.home_links;
create policy "home_links_write" on public.home_links
  for all using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create index if not exists idx_home_links_sort on public.home_links(sort_order);
