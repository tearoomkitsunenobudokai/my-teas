-- =============================================
-- TeaNote v9 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① reviews: score_aftertaste → score_richness（コク）にリネーム
alter table public.reviews
  rename column score_aftertaste to score_richness;

-- ② teas: 香り分析フィールドを追加
alter table public.teas
  add column if not exists aroma_notes text[],        -- 近い香り（タグ配列）
  add column if not exists aroma_description text;    -- 香り分析の自由記入
