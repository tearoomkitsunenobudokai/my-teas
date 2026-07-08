-- =============================================
-- TeaNote v26 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================
-- reviews テーブルにブランド名カラムを追加する
-- 例: Harney & Sons, Fortnum & Mason, ルピシア など

alter table public.reviews
  add column if not exists brand_name text default null;
