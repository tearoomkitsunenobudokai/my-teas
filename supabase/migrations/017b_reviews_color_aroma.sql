-- =============================================
-- TeaNote v17b マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① reviews テーブルに評価ごとの水色・香り分析を追加
alter table public.reviews
  add column if not exists color_hex text,           -- この評価時の水色
  add column if not exists aroma_notes text[],       -- この評価時の香り（最大3つ）
  add column if not exists aroma_description text;   -- 香りの自由メモ
