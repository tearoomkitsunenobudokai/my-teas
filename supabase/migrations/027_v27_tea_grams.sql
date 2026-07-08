-- =============================================
-- TeaNote v27 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================
-- 100mlあたりの茶葉グラム数を reviews テーブルに追加する
-- 例: 2.5g/100ml

alter table public.reviews
  add column if not exists tea_grams_per_100ml numeric(5,2) default null;
