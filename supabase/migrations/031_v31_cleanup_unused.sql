-- =============================================
-- TeaNote v31 マイグレーション（未使用DB整理）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 実行前提: アプリ側は v79（teanote-v79.zip）以降が反映済みであること。
-- コード側で teas / tea_aroma_data への参照、
-- profiles.certified_count / location / favorite_tea_id への参照を
-- すべて削除した上で実行してください。

-- ① teas テーブルへの外部キー参照を先に外す
alter table public.reviews
  drop constraint if exists reviews_tea_id_fkey;

alter table public.profiles
  drop constraint if exists profiles_favorite_tea_id_fkey;

-- ② 未使用テーブルを削除
--    tea_aroma_data は teas に従属していたテーブルなので先に削除
drop table if exists public.tea_aroma_data;
drop table if exists public.teas;

-- ③ reviews.tea_id カラムを削除（019でnullable化されて以降、実質未使用）
alter table public.reviews
  drop column if exists tea_id;

-- ④ profiles の未使用カラムを削除
--    certified_count: shop_visitsからの自動集計に移行済み
--    location: location_area/location_prefecture/location_visibilityに移行済み（024）
--    favorite_tea_id: teas連携廃止によりfavorite_tea（自由入力）に一本化
alter table public.profiles
  drop column if exists certified_count,
  drop column if exists location,
  drop column if exists favorite_tea_id;
