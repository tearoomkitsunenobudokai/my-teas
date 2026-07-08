-- =============================================
-- TeaNote v19 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① tea_id を NULL 許可に変更（お茶名を直接入力する場合は tea_id 不要）
alter table public.reviews
  alter column tea_id drop not null;

-- ② reviews テーブルに新しいカラムを追加
alter table public.reviews
  add column if not exists tea_name text,          -- お茶の名前（直接入力）
  add column if not exists shop_name text,         -- 飲んだ場所
  add column if not exists color_hex text,         -- 評価時の水色
  add column if not exists aroma_notes text[],     -- 香り分析（最大3つ）
  add column if not exists steep_seconds integer,  -- 淹れ時間（秒）
  add column if not exists brew_method text,       -- 抽出方法
  add column if not exists accompaniments text[];  -- 添え物

-- tea_id は任意（過去のお茶を選んだ場合のみ設定）
-- tea_name は必須（アプリ側でバリデーション）
