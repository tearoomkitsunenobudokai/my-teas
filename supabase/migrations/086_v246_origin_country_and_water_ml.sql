-- ============================================================
-- 086: 原産国の追加と、茶葉量の入力方法の変更
--   1) reviews.origin_country … 原産国（例: インド）
--   2) reviews.tea_grams      … 茶葉量(g)
--   3) reviews.water_ml       … 水量(ml)
--
-- これまで茶葉量は「g/100ml」という比率（tea_grams_per_100ml）で
-- 入力していたが、グラム(g)と水量(ml)をそれぞれ入力できるようにする。
-- 意味の異なる値を同じ列に入れると混乱するため、新しい列を追加し、
-- 既存列 tea_grams_per_100ml は過去データ保持のため残置する。
-- ============================================================

alter table public.reviews
  add column if not exists origin_country text,
  add column if not exists tea_grams      numeric,
  add column if not exists water_ml       numeric;

comment on column public.reviews.origin_country is '原産国（例: インド）。茶園と組み合わせて「デジュー農園（インド）」のように表示する';
comment on column public.reviews.tea_grams     is '茶葉量(g)。water_ml と組み合わせて「3.0g / 200ml」のように表示する';
comment on column public.reviews.water_ml      is '抽出に使った水量(ml)';

-- 既存データの移行はしない（g/100ml は比率であり、実量とは意味が異なるため）。
-- 過去データは tea_grams_per_100ml を引き続き参照して表示する。
