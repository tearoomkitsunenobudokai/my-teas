-- =============================================
-- TeaNote v73 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① 広告枠（home_links kind='ad'）に掲載期間を追加
alter table public.home_links
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz;

comment on column public.home_links.start_at is '掲載開始日時（NULL=即時掲載）';
comment on column public.home_links.end_at is '掲載終了日時（NULL=無期限）';

-- ② バナー画像アップロード用のStorageバケット
insert into storage.buckets (id, name, public)
values ('home-ads', 'home-ads', true)
on conflict (id) do nothing;

-- 誰でも閲覧可（バナーはホーム画面で全ユーザーに表示するため）
drop policy if exists "home_ads_public_read" on storage.objects;
create policy "home_ads_public_read" on storage.objects
  for select using (bucket_id = 'home-ads');

-- アップロード・更新・削除は管理者・製作者のみ
drop policy if exists "home_ads_admin_write" on storage.objects;
create policy "home_ads_admin_write" on storage.objects
  for insert with check (bucket_id = 'home-ads' and public.is_current_user_admin());

drop policy if exists "home_ads_admin_update" on storage.objects;
create policy "home_ads_admin_update" on storage.objects
  for update using (bucket_id = 'home-ads' and public.is_current_user_admin());

drop policy if exists "home_ads_admin_delete" on storage.objects;
create policy "home_ads_admin_delete" on storage.objects
  for delete using (bucket_id = 'home-ads' and public.is_current_user_admin());

-- ③ SNS固定枠（X / Instagram / その他）の設定値
insert into public.app_settings (key, value, description)
values
  ('sns_x_url', '', 'ホーム画面のXリンク（未設定なら非表示）'),
  ('sns_instagram_url', '', 'ホーム画面のInstagramリンク（未設定なら非表示）'),
  ('sns_other_url', '', 'ホーム画面のその他リンク（未設定なら非表示）'),
  ('sns_other_label', 'その他', 'その他リンクの表示名')
on conflict (key) do nothing;
