-- =============================================
-- TeaNote v69 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 詳細情報に「茶園」を登録できるようにする。
-- 評価カード画像で、紅茶名の下に茶園情報を表示するために使用する。

alter table public.reviews
  add column if not exists tea_garden text;

comment on column public.reviews.tea_garden is '茶園名（詳細情報で任意入力）。評価カード画像に表示。';
