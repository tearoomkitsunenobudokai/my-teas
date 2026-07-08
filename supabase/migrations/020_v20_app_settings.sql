-- =============================================
-- TeaNote v20 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- アプリ設定テーブル
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

-- 全ユーザーが読み取り可能
create policy "app_settings_select" on public.app_settings
  for select using (true);

-- 管理者のみ更新可能
create policy "app_settings_update" on public.app_settings
  for update using (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
create policy "app_settings_insert" on public.app_settings
  for insert with check (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- 初期値：1ユーザーあたり最大100件（0 = 無制限）
insert into public.app_settings (key, value, description)
values ('max_reviews_per_user', '0', '1ユーザーが登録できる評価の最大件数（0 = 無制限）')
on conflict (key) do nothing;
