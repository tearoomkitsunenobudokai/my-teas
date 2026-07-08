-- =============================================
-- TeaNote v51 マイグレーション（プロフィール画像）
-- Supabase SQL Editor で実行してください
-- =============================================
-- プロフィールのアバター画像を追加する。
-- 画像は Supabase Storage の 'avatars' バケットに保存し、
-- profiles.avatar_url にその公開URLを保存する。

-- ① profiles に avatar_url カラムを追加
alter table public.profiles add column if not exists avatar_url text;

-- ② 公開ビュー public_profiles に avatar_url を含める（コミュニティ表示用）
--    （050で作成したビューを作り直す）
create or replace view public.public_profiles as
select
  id,
  name,
  bio,
  favorite_tea,
  location_area,
  location_prefecture,
  location_visibility,
  avatar_url
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- ③ Storage バケット 'avatars' を作成（公開読み取り可）
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ④ Storage のアクセスポリシー
--    - 閲覧: 誰でも可（public バケット）
--    - アップロード/更新/削除: ログインユーザーが「自分のフォルダ」にのみ可能
--      ファイルパスを {user_id}/xxx.jpg の形にし、先頭フォルダ名が自分のIDのときだけ許可する。

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_own_insert" on storage.objects;
create policy "avatars_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_own_update" on storage.objects;
create policy "avatars_own_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_own_delete" on storage.objects;
create policy "avatars_own_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
